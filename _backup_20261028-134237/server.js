'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'sentinel.db');
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function loadEnv() {
  try {
    const raw = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!m) return;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    });
  } catch (e) {}
}
loadEnv();

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mission_time TEXT NOT NULL,
  wall_time TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  message TEXT NOT NULL,
  delivery_status TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS incidents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  mission_time TEXT NOT NULL,
  wall_time TEXT NOT NULL,
  indicators_payload TEXT NOT NULL,
  trigger_text TEXT,
  checks_text TEXT,
  uncertainty_text TEXT,
  delivered TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS ai_evaluations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  incident_id INTEGER,
  source TEXT NOT NULL,
  model TEXT,
  anomaly_score INTEGER,
  severity TEXT,
  eval_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);
CREATE TABLE IF NOT EXISTS ml_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  classes TEXT NOT NULL,
  features INTEGER NOT NULL,
  samples INTEGER,
  epochs INTEGER,
  accuracy REAL,
  weights_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const insEvent = db.prepare('INSERT INTO events (mission_time, wall_time, severity, category, message, delivery_status) VALUES (?, ?, ?, ?, ?, ?)');
const insIncident = db.prepare('INSERT INTO incidents (incident_type, severity, mission_time, wall_time, indicators_payload, trigger_text, checks_text, uncertainty_text, delivered) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
const insEval = db.prepare('INSERT INTO ai_evaluations (incident_id, source, model, anomaly_score, severity, eval_text) VALUES (?, ?, ?, ?, ?, ?)');
const selEvents = db.prepare('SELECT id, mission_time, wall_time, severity, category, message, delivery_status FROM events ORDER BY id DESC LIMIT ?');
const selIncidents = db.prepare('SELECT id, incident_type, severity, mission_time, wall_time, indicators_payload, trigger_text, checks_text, uncertainty_text, delivered, created_at FROM incidents ORDER BY id DESC LIMIT ?');
const selLastEval = db.prepare('SELECT id, incident_id, source, model, anomaly_score, severity, eval_text, created_at FROM ai_evaluations ORDER BY id DESC LIMIT 1');
const insMlModel = db.prepare('INSERT INTO ml_models (classes, features, samples, epochs, accuracy, weights_json) VALUES (?, ?, ?, ?, ?, ?)');
const selLastMlModel = db.prepare('SELECT id, classes, features, samples, epochs, accuracy, weights_json, created_at FROM ml_models ORDER BY id DESC LIMIT 1');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};
const ALLOWED = new Set(Object.keys(MIME));

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > (limit || 262144)) {
        reject(new Error('payload demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const txt = (v, n) => String(v == null ? '' : v).slice(0, n || 1200);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : NaN);

function localAssessment(incident, ind) {
  const s = ind || {};
  const notes = [];
  let score = 0;
  const hr = num(s.hr), spo2 = num(s.spo2), press = num(s.press), temp = num(s.temp);
  const co2 = num(s.co2), batt = num(s.batt), act = num(s.activity), orient = num(s.orient);

  if (hr <= 52) { score += clamp((52 - hr) * 2.2, 6, 45); notes.push('FC ' + hr.toFixed(0) + ' lpm bajo el umbral simulado de 52'); }
  else if (hr >= 128) { score += clamp((hr - 128) * 1.6, 6, 40); notes.push('FC ' + hr.toFixed(0) + ' lpm sobre el umbral simulado de 128'); }
  if (spo2 <= 93) { score += clamp((93 - spo2) * 3, 4, 25); notes.push('SpO₂ ' + spo2.toFixed(1) + ' % bajo el umbral simulado de 93'); }
  if (press <= 84) { score += clamp((84 - press) * 1.6, 4, 30); notes.push('Presión ' + press.toFixed(1) + ' kPa bajo el umbral simulado de 84'); }
  if (co2 >= 1.1) { score += clamp((co2 - 1.1) * 26, 4, 30); notes.push('CO₂ ' + co2.toFixed(2) + ' % sobre el umbral simulado de 1.10'); }
  if (batt <= 25) { score += clamp((25 - batt) * 2, 4, 30); notes.push('Batería ' + batt.toFixed(0) + ' % bajo el umbral simulado de 25'); }
  if (act <= 6) { score += clamp(18 - act, 8, 18); notes.push('actimetría simulada en reposo/inmovilidad (' + act.toFixed(0) + ')'); }
  if (Math.abs(orient - 8) >= 58) { score += 20; notes.push('orientación simulada desviada ' + Math.abs(orient - 8).toFixed(0) + '°'); }
  if (temp <= 35.8 || temp >= 38.2) { score += 10; notes.push('temperatura simulada fuera de rango nominal (' + temp.toFixed(1) + ' °C)'); }

  score = Math.round(clamp(score, 0, 100));
  const sev = score >= 65 ? 'CRÍTICO' : score >= 35 ? 'ATENCIÓN' : 'BAJA';
  const type = txt(incident.type, 120) || 'POSIBLE COMBINADO';
  const checks = txt(incident.checks, 900) || 'Verificación cruzada de señales redundantes simuladas y contacto por radio.';
  const uncertainty = txt(incident.uncertainty, 700) || 'Señales simuladas con posible ruido de sensor.';
  const body = [
    '[IA local heurística — reglas ponderadas, SIN modelo entrenado con datos reales]',
    'Resumen: posible emergencia simulada de tipo ' + type + '. Puntaje de anomalía calculado: ' + score + '/100 (severidad ' + sev + ').',
    'Indicadores alterados: ' + (notes.length ? notes.join('; ') : 'sin desviaciones registradas en las señales simuladas') + '.',
    'Incertidumbres: ' + uncertainty + ' La FC o la inmovilidad por sí solas no confirman ningún diagnóstico.',
    'Comprobaciones recomendadas: ' + checks
  ].join('\n');
  return { source: 'local', model: 'heuristica-ponderada-v1', score, severity: sev, text: body };
}

async function openAIAssessment(incident, ind, local) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const system = [
    'Eres un asistente de operaciones para un prototipo educativo de simulación espacial. TODOS los datos son ficticios; no hay astronautas reales.',
    'No emitas diagnósticos médicos, no inventes hechos y no afirmes respaldo de NASA ni de ninguna agencia.',
    'Trata siempre la situación como "posible emergencia simulada".',
    'Responde en español, máximo 130 palabras, con exactamente estas cuatro secciones numeradas:',
    '1) Resumen; 2) Indicadores alterados; 3) Incertidumbres; 4) Comprobaciones recomendadas.',
    'Usa solo los datos entregados. Si falta información, dilo en Incertidumbres.'
  ].join(' ');
  const payload = {
    incidente: {
      tipo: txt(incident.type, 120),
      severidad_declarada: txt(incident.severity, 30),
      hora: txt(incident.wall, 40),
      condicion: txt(incident.trigger, 600),
      checks: txt(incident.checks, 600),
      incertidumbres: txt(incident.uncertainty, 600),
      payload: txt(incident.payload, 400)
    },
    indicadores_simulados: {
      fc_lpm: ind.hr, spo2_pct: ind.spo2, presion_kpa: ind.press, temp_c: ind.temp,
      co2_pct: ind.co2, bateria_pct: ind.batt, actividad: ind.activity, orientacion_deg: ind.orient
    },
    puntaje_heuristico_local: local.score,
    eventos_recientes: Array.isArray(incident.eventsTail) ? incident.eventsTail.slice(-8).map((e) => txt(e, 220)) : []
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: 'Datos del incidente simulado (JSON): ' + JSON.stringify(payload) }
        ]
      }),
      signal: ctrl.signal
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = j && j.choices && j.choices[0] && j.choices[0].message ? String(j.choices[0].message.content || '').trim() : '';
    if (!text) return null;
    return { source: 'openai', model: OPENAI_MODEL, score: local.score, severity: local.severity, text: text.slice(0, 2000) };
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function serveStatic(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400); return res.end('bad request'); }
  if (pathname === '/') pathname = '/index.html';
  const ext = path.extname(pathname).toLowerCase();
  if (!ALLOWED.has(ext)) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('no encontrado'); }
  const full = path.join(ROOT, path.normalize(pathname).replace(/^([/\\])+/, ''));
  if (!full.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end('prohibido'); }
  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('no encontrado'); }
    res.writeHead(200, { 'content-type': MIME[ext], 'cache-control': 'no-store' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname;

  try {
    if (route === '/api/health' && req.method === 'GET') {
      const events = db.prepare('SELECT COUNT(*) n FROM events').get().n;
      const incidents = db.prepare('SELECT COUNT(*) n FROM incidents').get().n;
      const aiEvals = db.prepare('SELECT COUNT(*) n FROM ai_evaluations').get().n;
      const mlModels = db.prepare('SELECT COUNT(*) n FROM ml_models').get().n;
      return json(res, 200, {
        ok: true,
        db: { type: 'sqlite', file: path.basename(DB_PATH), events, incidents, aiEvaluations: aiEvals, mlModels },
        ai: {
          enabled: Boolean(process.env.OPENAI_API_KEY),
          provider: process.env.OPENAI_API_KEY ? 'openai' : 'local-heuristic',
          model: process.env.OPENAI_API_KEY ? OPENAI_MODEL : 'heuristica-ponderada-v1'
        }
      });
    }

    if (route === '/api/events' && req.method === 'POST') {
      const body = await readBody(req);
      const list = Array.isArray(body.events) ? body.events : [body];
      const ids = [];
      const insertMany = db.transaction((items) => {
        items.forEach((e) => {
          const info = insEvent.run(
            txt(e.mt || e.mission_time, 40),
            txt(e.wall || e.wall_time, 40),
            txt(e.sev || e.severity || 'info', 20),
            txt(e.cat || e.category || 'SYS', 20),
            txt(e.msg || e.message, 2000),
            e.status ? txt(e.status, 40) : null
          );
          ids.push(Number(info.lastInsertRowid));
        });
      });
      insertMany(list.slice(0, 200));
      return json(res, 200, { ok: true, ids });
    }

    if (route === '/api/events' && req.method === 'GET') {
      const limit = clamp(Number(url.searchParams.get('limit')) || 200, 1, 500);
      const rows = selEvents.all(limit).map((r) => ({
        mt: r.mission_time, wall: r.wall_time, sev: r.severity, cat: r.category,
        msg: r.message, status: r.delivery_status, id: r.id
      }));
      return json(res, 200, { ok: true, events: rows });
    }

    if (route === '/api/incidents' && req.method === 'POST') {
      const b = await readBody(req);
      const info = insIncident.run(
        txt(b.type, 160), txt(b.severity, 30), txt(b.mt, 40), txt(b.wall, 40),
        txt(b.payload, 600), txt(b.trigger, 900), txt(b.checks, 1200), txt(b.uncertainty, 900), txt(b.delivered, 120)
      );
      return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
    }

    if (route === '/api/incidents' && req.method === 'GET') {
      const limit = clamp(Number(url.searchParams.get('limit')) || 50, 1, 200);
      return json(res, 200, { ok: true, incidents: selIncidents.all(limit) });
    }

    if (route === '/api/stats' && req.method === 'GET') {
      const events = db.prepare('SELECT COUNT(*) n FROM events').get().n;
      const incidents = db.prepare('SELECT COUNT(*) n FROM incidents').get().n;
      const bySeverity = db.prepare('SELECT severity, COUNT(*) n FROM incidents GROUP BY severity').all();
      const lastIncident = selIncidents.get(1) || null;
      return json(res, 200, { ok: true, events, incidents, bySeverity, lastIncident, lastAi: selLastEval.get() || null });
    }

    if (route === '/api/ai/alert' && req.method === 'POST') {
      const b = await readBody(req);
      const incident = b.incident || {};
      const ind = b.indicators || {};
      const local = localAssessment(incident, ind);
      const remote = await openAIAssessment(incident, ind, local);
      const chosen = remote || local;
      const incidentId = Number(b.incidentId) || null;
      insEval.run(incidentId, chosen.source, chosen.model, chosen.score, chosen.severity, chosen.text);
      return json(res, 200, {
        ok: true,
        source: chosen.source,
        model: chosen.model,
        score: chosen.score,
        severity: chosen.severity,
        text: chosen.text,
        note: chosen.source === 'openai'
          ? 'Evaluación generada por OpenAI en el servidor. Clave fuera del navegador. Datos simulados.'
          : 'IA local heurística (reglas ponderadas) sin modelo entrenado. Funciona sin clave ni Internet.'
      });
    }

    if (route === '/api/reset' && req.method === 'POST') {
      db.exec('DELETE FROM ai_evaluations; DELETE FROM incidents; DELETE FROM events;');
      return json(res, 200, { ok: true, message: 'historial de la simulación borrado de SQLite' });
    }

    if (route === '/api/ml/model' && req.method === 'POST') {
      const b = await readBody(req);
      const classes = Array.isArray(b.classes) ? b.classes.join(',') : txt(b.classes, 200);
      if (!classes) return json(res, 400, { ok: false, error: 'faltan las clases del modelo' });
      const info = insMlModel.run(
        txt(classes, 300),
        Math.max(1, Math.min(64, Number(b.features) || 8)) | 0,
        Number.isFinite(Number(b.samples)) ? Number(b.samples) : null,
        Number.isFinite(Number(b.epochs)) ? Math.round(Number(b.epochs)) : null,
        Number.isFinite(Number(b.accuracy)) ? Number(b.accuracy) : null,
        JSON.stringify(b.weights || {}).slice(0, 200000)
      );
      return json(res, 200, { ok: true, id: Number(info.lastInsertRowid) });
    }

    if (route === '/api/ml/model' && req.method === 'GET') {
      const row = selLastMlModel.get();
      if (!row) return json(res, 200, { ok: true, model: null });
      let weights = null;
      try { weights = JSON.parse(row.weights_json); } catch (e) { weights = null; }
      return json(res, 200, {
        ok: true,
        model: {
          id: row.id, classes: String(row.classes).split(','), features: row.features,
          samples: row.samples, epochs: row.epochs, accuracy: row.accuracy,
          weights: weights, created_at: row.created_at
        }
      });
    }

    if (route === '/api/ml/models' && req.method === 'GET') {
      const limit = clamp(Number(url.searchParams.get('limit')) || 10, 1, 50);
      const rows = db.prepare('SELECT id, classes, features, samples, epochs, accuracy, created_at FROM ml_models ORDER BY id DESC LIMIT ?').all(limit);
      return json(res, 200, { ok: true, models: rows.map(function (r) { return Object.assign({}, r, { classes: String(r.classes).split(',') }); }) });
    }

    if (route.startsWith('/api/')) return json(res, 404, { ok: false, error: 'ruta no encontrada' });

    if (req.method !== 'GET') { res.writeHead(405); return res.end('método no permitido'); }
    return serveStatic(req, res);
  } catch (e) {
    return json(res, 400, { ok: false, error: String(e.message || e) });
  }
});
console.error = console.error;
process.on('unhandledRejection', (r) => console.error('UNHANDLED', r));
server.listen(PORT, HOST, () => {
  console.log('SENTINEL RESCUE-X · servidor listo en http://' + HOST + ':' + PORT);
  console.log('Base de datos SQLite: ' + DB_PATH);
  console.log('IA de alerta: ' + (process.env.OPENAI_API_KEY ? 'OpenAI (' + OPENAI_MODEL + ') con fallback heurístico' : 'heurística local (sin OPENAI_API_KEY)'));
});

process.on('SIGINT', () => { try { db.close(); } catch (e) {} process.exit(0); });
process.on('SIGTERM', () => { try { db.close(); } catch (e) {} process.exit(0); });
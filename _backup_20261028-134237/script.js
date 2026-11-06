// SENTINEL RESCUE-X - Script Principal Funcional
// Versión: Restaurado y comprobado

'use strict';

// Elementos DOM
const $ = (id) => document.getElementById(id);

// Configuración de idioma (básico)
const I18N = {
  lang: 'es',
  setLang: (l) => { I18N.lang = l; document.documentElement.lang = l; },
  t: (k, args) => {
    const dict = {
      es: {
        'app.title': 'SENTINEL RESCUE-X',
        'brand.tag': 'Cuando el astronauta no puede pedir ayuda, su traje debe saber cómo actuar',
        'mc.status.h': 'ESTADO DE LA MISIÓN',
        'row.mission': 'Misión',
        'row.astronaut': 'Astronauta',
        'row.location': 'Ubicación lunar',
        'row.mtime': 'Tiempo de misión',
        'row.comm': 'Comunicación',
        'row.suit': 'Estado del traje',
        'ind.h': 'INDICADORES SIMULADOS',
        'ind.hr': 'Frecuencia cardíaca',
        'ind.spo2': 'Saturación O₂',
        'ind.press': 'Presión del traje',
        'ind.co2': 'CO₂ circuito',
        'ind.batt': 'Batería del traje',
        'ind.temp': 'Temperatura ref.',
        'ind.move': 'Movimiento',
        'ind.orient': 'Orientación',
        'u.bpm': 'lpm',
        'u.batt': 'carga',
        'u.act': 'actimetría sim',
        'u.orient': 'inclinación',
        'chart.h': 'TELEMETRÍA HISTÓRICA (90 CICLOS)',
        'chart.note': 'gráficos generados localmente',
        'legend.hr': 'FC lpm',
        'legend.spo2': 'SpO₂ %',
        'legend.press': 'Presión kPa',
        'legend.co2': 'CO₂ %',
        'legend.batt': 'Batería %',
        'sim.h': 'SIMULADOR DE EMERGENCIAS',
        'sim.note.head': 'cada botón inyecta un perfil de datos ficticios',
        'sc.normal.b': 'Funcionamiento normal',
        'sc.collapse.b': 'Posible desmayo',
        'sc.fall.b': 'Caída + inmovilidad',
        'sc.physio.b': 'Anomalía fisiológica',
        'sc.pressure.b': 'Descenso presión traje',
        'sc.co2.b': 'Aumento de CO2',
        'sc.comm.b': 'Pérdida de comunicación',
        'sc.battery.b': 'Batería baja',
        'console.h': 'CONSOLA DE SECUENCIA',
        'console.note': 'registro en vivo del motor de reglas',
        'stat.response': 'Tiempo de respuesta:',
        'stat.alerts': 'Alertas activas:',
        'stat.queue': 'Cola pendiente:',
        'btn.restore': 'RESTAURAR COMUNICACIÓN (SIM)',
        'cc.h': 'INCIDENTE',
        'cc.note': 'visto desde el Centro de Control',
        'cc.astronaut': 'Astronauta',
        'cc.active': 'Incidente activo',
        'cc.logged': 'Registrado',
        'cc.trigger': 'Condición que activó la alerta',
        'cc.payload': 'Datos al confirmar',
        'sev.crit': 'CRÍTICO',
        'sev.warn': 'ATENCIÓN',
        'comm.h': 'COMUNICACIONES (SIM)',
        'comm.note': 'modo sin conexión',
        'comm.state': 'Estado',
        'comm.queue': 'Cola de retransmisión',
        'comm.hint': 'Si el enlace se interrumpe...',
        'q.none': 'SIN MENSAJES PENDIENTES',
        'q.pending': '{0} mensaje(s) PENDIENTES en cola de retransmisión (conservados localmente)',
        'q.empty': 'La cola está vacía: los avisos se están entregando en tiempo real (simulado).',
        'st.pending': 'PENDIENTE',
        'st.sent': 'ENVIADO',
        'st.queued': 'EN COLA',
        'proto.h': 'PROTOCOLO Y RESCATE',
        'proto.note': 'fases simuladas del sistema',
        'proto.checks': 'Comprobaciones del protocolo (ficticias)',
        'proto.unc': 'Incertidumbres declaradas',
        'cc.rescueNote': 'El rover virtual se despliega automáticamente...',
        'ai.label': 'Evaluación de IA de alerta',
        'ai.note': 'La IA solo explica y prioriza el incidente...',
        'btn.report': 'GENERAR INFORME PARA EL CENTRO DE CONTROL',
        'rover.h': 'MAPA LUNAR — RUTA DE RESCATE (SIMULADA)',
        'rover.note': 'cuadrícula 16×11 · 1 celda = 40 u.n.',
        'rover.dist': 'Distancia estimada:',
        'rover.state': 'Estado:',
        'btn.roverStart': 'INICIAR RUTA DE RESCATE',
        'btn.roverStop': 'DETENER',
        'btn.block': 'SIMULAR BLOQUEO TOTAL (DEMO)',
        'btn.unblock': 'QUITAR BLOQUEO (DEMO)',
        'legend.astro': 'Astronauta',
        'legend.rover': 'Rover RX-1',
        'legend.obs': 'Obstáculo / crátero impracticable',
        'legend.route': 'Ruta calculada',
        'rover.hint': 'El rover es un personaje virtual de demostración...',
        'unit.dist': 'u.n.',
        'hist.h': 'RESULTADOS DE PRUEBAS REPRODUCIBLES',
        'hist.note': 'medidos sobre las ejecuciones reales de este navegador',
        'mtr.scenarios': 'Escenarios ejecutados',
        'mtr.alerts': 'Alertas activadas',
        'mtr.correct': 'Alertas correctas (tipo esperado)',
        'mtr.false': 'Falsas alarmas',
        'mtr.missed': 'Incidentes no detectados',
        'mtr.avg': 'Tiempo medio de respuesta del software',
        'mtr.comm': 'Estado de comunicaciones',
        'mtr.db': 'Eventos guardados en base de datos SQLite',
        'hlog.h': 'HISTORIAL COMPLETO DE EVENTOS',
        'f.all': 'Todos',
        'f.fisio': 'Fisiología',
        'f.comms': 'Comunicaciones',
        'f.rover': 'Rover',
        'f.sys': 'Sistema',
        'hist.empty': 'Sin eventos. Abre el SIMULADOR y activa un escenario...',
        'btn.export': 'EXPORTAR INFORME (.txt)',
        'btn.resetSim': 'REINICIAR SIMULACIÓN',
        'about.h': 'ACERCA DEL PROYECTO',
        'about.lema': '«Cuando el astronauta no puede pedir ayuda, su traje debe saber cómo actuar»',
        'about.problem.h': 'Problema que se pretende abordar',
        'about.problem.p': 'Durante una exploración lunar...',
        'about.solution.h': 'Solución propuesta',
        'about.solution.p': 'Un traje con un módulo SENTINEL...',
        'about.innov.h': 'Innovación',
        'about.innov.p': 'La detección opera en el propio traje...',
        'about.tech.h': 'Tecnologías utilizadas',
        'about.tech.li1': 'Frontend: HTML, CSS y JavaScript puro...',
        'about.tech.li2': 'Backend: Node.js con base de datos SQLite...',
        'about.tech.li3': 'IA de alerta: OpenAI opcional llamada desde el servidor...',
        'about.tech.li4': 'Motor ML: clasificador softmax entrenado en el navegador...',
        'about.tech.li5': 'App instalable (PWA): manifest + service worker...',
        'about.tech.li6': 'Sin servidor: la aplicación sigue abriendo index.html...',
        'about.db.h': 'Base de datos e IA de alerta',
        'about.db.p1': 'Con el servidor usa SQLite con cuatro tablas...',
        'about.db.p2': 'La IA de alerta se ejecuta al confirmarse un incidente...',
        'about.lim.h': 'Límites y riesgos',
        'about.lim.li1': 'Es un prototipo educativo...',
        'about.lim.li2': 'Las alertas responden a umbrales fijos programados...',
        'about.lim.li3': 'La inmovilidad o una FC baja no confirman un desmayo...',
        'about.lim.li4': 'La IA es un apoyo narrativo...',
        'about.lim.li5': 'La clave de OpenAI vive únicamente en el servidor...',
        'about.cmp.h': 'Qué funciona en el prototipo vs. qué exigiría un traje real',
        'about.cmp.th1': 'Prototipo (funciona hoy)',
        'about.cmp.th2': 'Traje real (a futuro)',
        'about.cmp.r1a': 'Sensores simulados generados por software',
        'about.cmp.r1b': 'Bio-monitores certificados...',
        'about.cmp.r2a': 'Reglas deterministas con umbrales fijos + ML opcional...',
        'about.cmp.r2b': 'Modelos validados clínicamente...',
        'about.cmp.r3a': 'Rover virtual animado en un mapa ficticio...',
        'about.cmp.r3b': 'Robótica autónoma certificada...',
        'about.cmp.r4a': 'Comunicación simulada con cola local...',
        'about.cmp.r4b': 'Enlaces reales DSN/orbitales...',
        'about.cmp.r5a': 'IA de alerta opcional...',
        'about.cmp.r5b': 'Modelos clínicos validados...',
        'about.cmp.r6a': 'Alertas en pantalla y sonido del navegador...',
        'about.cmp.r6b': 'Alertadores integrados al traje...',
        'about.res.h': 'Resultados de las pruebas',
        'about.res.p': 'Se calculan en vivo...',
        'about.app.h': 'Posibles aplicaciones futuras',
        'about.app.p': 'Monitoreo de expediciones polares o mineras...',
        'about.n.h': 'Aviso',
        'about.n.p': 'Proyecto educativo para la clase y preparación del NASA Space Apps Challenge 2026...',
        'foot.left': 'SENTINEL RESCUE-X · prototipo educativo · todos los datos son simulados',
        'foot.right': 'sin conexión real con NASA ni ninguna agencia',
      },
      en: {
        'app.title': 'SENTINEL RESCUE-X',
        'brand.tag': 'When the astronaut cannot call for help, their suit must know how to act',
        'mc.status.h': 'MISSION STATUS',
        'row.mission': 'Mission',
        'row.astronaut': 'Astronaut',
        'row.location': 'Lunar location',
        'row.mtime': 'Mission time',
        'row.comm': 'Communication',
        'row.suit': 'Suit status',
        'ind.h': 'SIMULATED INDICATORS',
        'ind.hr': 'Heart rate',
        'ind.spo2': 'O₂ saturation',
        'ind.press': 'Suit pressure',
        'ind.co2': 'CO₂ loop',
        'ind.batt': 'Suit battery',
        'ind.temp': 'Reference temp.',
        'ind.move': 'Movement',
        'ind.orient': 'Orientation',
        'u.bpm': 'bpm',
        'u.batt': 'charge',
        'u.act': 'sim actimetry',
        'u.orient': 'tilt',
        'chart.h': 'HISTORICAL TELEMETRY (90 CYCLES)',
        'chart.note': 'locally rendered graphs',
        'legend.hr': 'HR bpm',
        'legend.spo2': 'SpO₂ %',
        'legend.press': 'Pressure kPa',
        'legend.co2': 'CO₂ %',
        'legend.batt': 'Battery %',
        'sim.h': 'EMERGENCY SIMULATOR',
        'sim.note.head': 'each button injects a fictional data profile',
        'sc.normal.b': 'Normal operation',
        'sc.collapse.b': 'Possible fainting',
        'sc.fall.b': 'Fall + immobility',
        'sc.physio.b': 'Physiological anomaly',
        'sc.pressure.b': 'Suit pressure drop',
        'sc.co2.b': 'CO₂ increase',
        'sc.comm.b': 'Communication loss',
        'sc.battery.b': 'Low battery',
        'console.h': 'SEQUENCE CONSOLE',
        'console.note': 'live log of the rule engine',
        'stat.response': 'Response time:',
        'stat.alerts': 'Active alerts:',
        'stat.queue': 'Pending queue:',
        'btn.restore': 'RESTORE COMMUNICATION (SIM)',
        'cc.h': 'INCIDENT',
        'cc.note': 'as seen from the Control Center',
        'cc.astronaut': 'Astronaut',
        'cc.active': 'Active incident',
        'cc.logged': 'Logged',
        'cc.trigger': 'Condition that triggered the alert',
        'cc.payload': 'Data at confirmation',
        'sev.crit': 'CRITICAL',
        'sev.warn': 'WARNING',
        'comm.linkOk': 'NOMINAL LINK',
        'comm.noLink': 'NO LINK',
        'chip.commOk': 'COMMS: NOMINAL',
        'chip.commBad': 'COMMS: NO LINK',
        'cc.linkOk': 'NOMINAL LINK (SIMULATED)',
        'cc.linkBad': 'INTERRUPTED — LOCAL AUTONOMOUS MODE',
        'banner.crit': 'CRITICAL ALERT (POSSIBLE EMERGENCY) — {0}',
        'banner.critEsc': 'CRITICAL ALERT (POSSIBLE EMERGENCY ESCALATED) — {0}',
        'banner.warn': 'WARNING — {0}',
        'log.tx': 'Notice issued to the primary Control Center: {0}',
        'log.queued': 'No ground-suit link. Message held in the retransmission queue: {0}',
        'log.flushNone': 'Link restored. There were no pending messages in the queue.',
        'log.flush': 'Link restored. {0} message(s) marked SENT within the simulation (Control Center delivery: fictional).',
        'log.restoreAck': 'Operator requested restoring the link (SIMULATION).',
        'log.ack': 'Alert acknowledged by the operator. The simulated condition stays active until the “Normal operation” scenario is used.',
        'log.scenario': 'SCENARIO ACTIVATED — {0} · 100% simulated data.',
        'log.sc.normal': 'RECOVERED — nominal parameters restored and links reinstated (simulation).',
        'log.sc.collapse': 'Fictional progressive profile: bradycardia + loss of ambulatory activity.',
        'log.sc.fall': 'Fictional profile: impact detected, 92° orientation and zero activity.',
        'log.sc.physio': 'Fictional profile: oscillating heart pattern + mild fever (invented data).',
        'log.sc.pressure': 'Fictional profile: progressive leak in the suit pressure loop.',
        'log.sc.co2': 'Fictional profile: CO₂ scrubber saturated — concentration rising.',
        'log.sc.comm': 'INTERFERENCE — ground-suit link interrupted (SIMULATION). Detection rules keep running locally; any message stays in the retransmission queue.',
        'log.sc.battery': 'Fictional profile: accelerated drain of the suit battery.',
        'log.detect': 'DETECTION — signal “{0}” out of threshold. Starting persistence verification ({1} cycles, simulated)...',
        'log.detectOK': 'DETECTION — signal “{0}” back in nominal range.',
        'log.alert': 'AUTOMATIC ALERT — {0}. Persistent programmed threshold. {1}',
        'log.falseAlarm': 'TESTS: an alert fired during the “Normal operation” scenario — recorded as a false alarm.',
        'log.correct': 'TESTS: correct alert for the “{0}” scenario — software response time: {1} ms.',
        'log.missed': 'TESTS: the “{0}” scenario ended with no alert in 30 s — recorded as a missed incident.',
        'log.escalate': 'ESCALATION — {0} reaches the critical threshold. Contingency protocol and automatic rescue (SIMULATED).',
        'log.report': 'Report for the Control Center generated with the local template (no external AI).',
        'log.pathNone': 'Route planner: NO path to ASTR-02. Reason: obstacles (craters / total blockage) isolate their grid cell. Recheck the map or request external assistance (demonstration).',
        'log.pathCalc': 'Route computed with grid search (4 directions). Cells: {0} · Estimated distance: {1} {2}.',
        'log.rescueDone': 'Visual contact with {0}. Transfer to habitat/base recorded. Rescue operation complete (SIMULATION).',
        'log.roverStop': 'Virtual rover march stopped by the operator.',
        'log.roverCancel': 'Rescue operation cancelled (parameters restored).',
        'log.blockSet': 'DEMO: an obstacle wall fully seals the astronaut zone.',
        'log.blockTry': 'DEMO: access blocked. Press “START” to see how the planner explains that no route is available.',
        'log.blockClear': 'DEMO: blockage removed. The map has traversable routes again.',
        'ml.cls.normal': 'Normal operation',
        'ml.cls.collapse': 'Possible fainting',
        'ml.cls.fall': 'Fall + immobility',
        'ml.cls.physio': 'Physiological anomaly',
        'ml.cls.pressure': 'Suit pressure drop',
        'ml.cls.co2': 'CO₂ increase',
        'ml.cls.battery': 'Low battery',
        'ml.none': 'no runs yet',
        'ml.eval': 'independent validation',
        'ml.last': 'Last check against scenario',
        'ml.train': 'RETRAIN NOW',
        'ml.auto.on': 'LIVE LEARNING: ON',
        'ml.auto.off': 'LIVE LEARNING: OFF',
        'ml.gen': 'GENERATE +50 SYNTHETIC SAMPLES',
        'log.mlTrained': 'ML: model retrained · {0} samples · {1} epochs · validation accuracy {2}%.',
        'log.mlGen': 'ML: +{0} synthetic samples generated and added to the buffer.',
        'log.mlSample': 'ML: sample learned from the real run ({0}).',
        'log.mlServer': 'ML: model synced to the SQLite database (record #{0}).',
        'move.still': 'MOTIONLESS',
        'move.idle': 'STILL',
        'move.active': 'ACTIVE',
        's.normal': 'NORMAL',
        's.warn': 'WARNING',
        's.crit': 'CRITICAL',
        'tr.stable': '↔ steady',
        'tr.up': '↑ up',
        'tr.down': '↓ down',
        'rstate.wait': 'STANDBY',
        'rstate.auto': 'ON ROUTE (AUTO)',
        'rstate.route': 'ON ROUTE',
        'rstate.done': 'RESCUE COMPLETE',
        'rstate.noRoute': 'NO ROUTE AVAILABLE',
        'rt.wait': 'OPERATION ON STANDBY',
        'rt.running': 'RESCUE OPERATION IN PROGRESS (SIMULATED)',
        'rt.blocked': 'OPERATION BLOCKED — NO ROUTE',
        'rt.done': 'RESCUE OPERATION COMPLETE (SIMULATED)',
        'pr.normal': 'NORMAL PROTOCOL',
        'pr.verify': 'PROTOCOL UNDER VERIFICATION',
        'pr.conting': 'CONTINGENCY PROTOCOL ACTIVE',
        'ml.cls.normal': 'Normal operation',
        'ml.cls.collapse': 'Possible fainting',
        'ml.cls.fall': 'Fall + immobility',
        'ml.cls.physio': 'Physiological anomaly',
        'ml.cls.pressure': 'Suit pressure drop',
        'ml.cls.co2': 'CO₂ increase',
        'ml.cls.battery': 'Low battery',
        'deliv.sent': 'RECEIPT CONFIRMED AT CCP (SIMULATED)',
        'deliv.queued': 'QUEUED — NO LINK (will send on restore)',
        'deliv.resync': 'SENT (SYNCED WHEN LINK RESTORED)',
        'ai.calc': 'Assessing incident with AI…',
        'ai.b.calc': 'COMPUTING',
        'ai.b.openai': 'OPENAI · {0}',
        'ai.b.server': 'LOCAL AI (SERVER)',
        'ai.b.browser': 'LOCAL AI (BROWSER)',
        'ai.b.ml': 'ML ENGINE',
        'lai.head': '[Local browser AI — weighted rules, NO trained model]',
        'lai.summary': '1) Summary: possible simulated emergency of type {0}. Anomaly score: {1}/100 (severity {2}).',
        'lai.ind': '2) Altered indicators: {0}.',
        'lai.none': 'no registered deviations',
        'lai.unc': '3) Uncertainties: {0} HR or immobility alone do not confirm any diagnosis.',
        'lai.checks': '4) Recommended checks: {0}',
        'note.hrLow': 'HR {0} bpm below the simulated threshold of 52',
        'note.hrHigh': 'HR {0} bpm above the simulated threshold of 128',
        'note.spo2': 'SpO₂ {0} % below the simulated threshold of 93',
        'note.press': 'Pressure {0} kPa below the simulated threshold of 84',
        'note.co2': 'CO₂ {0} % above the simulated threshold of 1.10',
        'note.batt': 'Battery {0} % below the simulated threshold of 25',
        'note.act': 'simulated actimetry at rest/immobility ({0})',
        'note.orient': 'simulated orientation deviated {0}°',
        'note.temp': 'simulated temperature outside nominal range ({0} °C)',
        'rep.title': 'REPORT FOR THE CONTROL CENTER — SENTINEL RESCUE-X',
        'rep.engine': 'Alert engine: local deterministic rules · Support AI: {0}.',
        'rep.engineML': 'ML model: validation accuracy {0}% · samples {1} · epochs {2}.',
        'rep.record': 'Log time: {0} · {1}',
        'rep.mission': 'Mission: {0} · Astronaut: {1} · Location: {2}',
        'rep.comm': 'Communication status: {0}',
        'rep.suit': 'Suit status: {0}',
        'rep.ind': 'Latest simulated indicators: {0}',
        'rep.incActive': 'ACTIVE INCIDENT: {0} ({1}) logged at {2} ({3})',
        'rep.incNone': 'ACTIVE INCIDENT: none. No open alerts.',
        'rep.incTrigger': 'Condition that triggered the alert: {0}',
        'rep.incChecks': 'Protocol check: {0}',
        'rep.incUnc': 'Declared uncertainties: {0}',
        'rep.incDeliv': 'Reception at CCP: {0}',
        'rep.ai': 'AI EVALUATION ({0}, score {1}/100):',
        'rep.aiPend': 'AI EVALUATION: pending or unavailable. The deterministic alert was already issued and logged.',
        'rep.rescue': 'Rescue status (virtual): {0} · Pending queue: {1}',
        'rep.tests': 'Results in reproducible prototype tests (measured in this browser):',
        'rep.last': 'Last {0} events (reverse chronological):',
        'rep.disclaimer': 'NOTICE: this is a simulated report for demonstration. It claims no validation, endorsement or approval by any aerospace agency and cannot be used for real medical purposes.',
        'exp.h': '════ FULL HISTORY ({0} events) ════',
        'confirm.reset': 'Fully reset the simulation? The history and metrics saved in this browser{0} will be deleted.',
        'confirm.dbExtra': ' and the SQLite database records',
        'boot.sys': 'SYSTEM BOOT SENTINEL RESCUE-X — educational prototype. Indicators, motion and communication 100% SIMULATED locally.',
        'boot.server': 'Server active: history persisted in SQLite ({0} events). Alert AI: {1}.',
        'boot.off': 'No server: browser autonomous mode (localStorage). Run "node server.js" to use the SQLite database and the server AI.',
      }
    };
    const d = dict[I18N.lang] || dict.es;
    let v = d[k];
    if (v == null) v = dict.es[k];
    if (v == null) v = k;
    if (args != null) {
      const list = Array.isArray(args) ? args : [args];
      v = String(v).replace(/\{(\d+)\}/g, (m, i) => {
        const val = list[Number(i)];
        return val == null ? '' : String(val);
      });
    }
    return v;
  }
};

// Configuración base
const MISSION = { name: 'RESCUE-X', astronaut: 'ASTR-02 · HALLEY', location: 'Mare Imbrium — Sector 7 / EVA-04' };
const BASE = { hr: 72, spo2: 97.8, press: 101.3, temp: 36.8, co2: 0.42, batt: 86, activity: 42, orient: 8 };
const RULE = { hrLow: 52, hrHigh: 128, hrHighCrit: 138, spo2Warn: 93, pressWarn: 84, pressCrit: 68, co2Warn: 1.1, co2Crit: 2.0, battWarn: 25, battCrit: 12, actStill: 6, orientFall: 58, persist: 5 };
const DISK = 'sentinel-rescue-x-v1';

// Estado del sistema
let state = {
  t: 0, comm: true, suit: 'normal', activeAlerts: 0, scenario: null, pending: null,
  sim: Object.assign({}, BASE), targets: Object.assign({}, BASE), prevSim: Object.assign({}, BASE),
  immobCycles: 0, ruleTimers: {}, ruleFired: {}, incident: null, log: [], queue: [], histFilter: 'all',
  blockedDemo: false, rover: { path: [], idx: 0, running: false, arrived: false, auto: false },
  charts: { hr: [], spo2: [], press: [], co2: [], batt: [] },
  metrics: { scenarios: 0, alerts: 0, correct: 0, falseAlarms: 0, missed: 0, responseSum: 0, responseCount: 0 },
  soundOn: true
};

// Función de audio - alerta ruidosa
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function initAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
}

function playAlert(frequencies, duration, interval) {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  let t = audioCtx.currentTime;
  frequencies.forEach((f, i) => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.value = f;
    g.gain.value = 0.1;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(t + i * interval);
    o.stop(t + duration + i * interval);
    t += interval;
  });
}

function playCriticalAlert() {
  playAlert([200, 150, 100], 200, 300);
}

function playInfoAlert() {
  playAlert([440], 100, 0);
}

// Detección de sonido usando el micrófono
let soundStream = null;
let soundLevel = 0;

function startSoundDetection() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    console.log('Detección de sonido no soportada');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    .then(stream => {
      soundStream = stream;
      const tracker = audioCtx.createAnalyser();
      tracker.fftSize = 256;
      const track = audioCtx.createMediaStreamSource(stream);
      track.connect(tracker);
      const data = new Uint8Array(tracker.frequencyBinCount);
      setInterval(() => {
        tracker.getByteFrequencyData(data);
        let volume = 0;
        for (let i = 0; i < data.length; i++) volume += data[i];
        volume = volume / data.length;
        soundLevel = volume;
        if (volume > 500 && state.suit !== 'normal' && !state.incident) {
          playCriticalAlert();
          console.log('¡ALERTA SONIDA DETECTADA!');
        }
      }, 100);
    })
    .catch(err => console.log('No se pudo acceder al micrófono:', err.message));
}

// --- IMPLEMENTACIÓN DE FUNCIONES FALTANTES ---

function cargarEscenario(scenario) {
  state.scenario = scenario;
  state.metrics.scenarios++;
  
  // Definir targets según escenario
  const profiles = {
    normal: { hr: 72, spo2: 98, press: 101, temp: 36.6, co2: 0.4, batt: 80, activity: 40, orient: 5 },
    collapse: { hr: 45, spo2: 91, press: 101, temp: 36.2, co2: 0.5, batt: 70, activity: 2, orient: 10 },
    fall: { hr: 110, spo2: 95, press: 101, temp: 36.6, co2: 0.4, batt: 65, activity: 0, orient: 90 },
    physio: { hr: 145, spo2: 94, press: 101, temp: 38.5, co2: 0.4, batt: 60, activity: 10, orient: 15 },
    pressure: { hr: 115, spo2: 88, press: 60, temp: 35.5, co2: 0.4, batt: 50, activity: 15, orient: 20 },
    co2: { hr: 105, spo2: 92, press: 101, temp: 36.8, co2: 2.5, batt: 40, activity: 10, orient: 10 },
    comm: { hr: 72, spo2: 98, press: 101, temp: 36.6, co2: 0.4, batt: 80, activity: 40, orient: 5, comm: false },
    battery: { hr: 75, spo2: 98, press: 101, temp: 36.6, co2: 0.4, batt: 10, activity: 30, orient: 5 }
  };

  const p = profiles[scenario] || profiles.normal;
  state.targets = Object.assign({}, p);
  
  if (scenario === 'comm') state.comm = false;
  if (scenario === 'normal') state.comm = true;

  logToConsole(I18N.t('log.scenario', scenario));
}

function logToConsole(msg) {
  const con = $('emergencyConsole');
  const line = document.createElement('div');
  line.className = 'console-line';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  con.prepend(line);
}

function actualizarUI() {
  // Misión
  $('vAstronaut').textContent = MISSION.astronaut;
  $('vLocation').textContent = MISSION.location;
  $('missionClock').textContent = `T+${state.t.toFixed(1)}`;
  
  // Comms
  const commPill = $('commStatus');
  commPill.textContent = state.comm ? 'ENLACE NOMINAL' : 'ENLACE INTERRUMPIDO';
  commPill.className = `pill ${state.comm ? 'ok' : 'danger'}`;
  
  // Indicadores
  const inds = {
    vHr: state.sim.hr, vSpo2: state.sim.spo2, vPress: state.sim.press,
    vCo2: state.sim.co2, vBatt: state.sim.batt, vTemp: state.sim.temp,
    vOrient: state.sim.orient + '°'
  };
  for (let id in inds) {
    const el = $(id);
    if (el) el.textContent = inds[id];
  }
  $('vActivity').textContent = state.sim.activity > 10 ? 'ACTIVO' : 'INMÓVIL';
  
  // Suit status
  $('suitName').textContent = state.suit.toUpperCase();
  $('suitName').className = `pill ${state.suit === 'normal' ? 'ok' : 'danger'}`;
}

function simulationLoop() {
  state.t += 0.1;
  
  // Interpolación suave hacia targets
  for (let k in state.sim) {
    if (state.targets[k] !== undefined) {
      state.sim[k] += (state.targets[k] - state.sim[k]) * 0.1;
    }
  }
  
  checkRules();
  actualizarUI();
  
  // Sync 3D Astronaut movement based on state.suit
  if (window.updateAstronautState) {
    const visualState = state.suit === 'critical' ? 'COLLAPSED' : 'NORMAL';
    window.updateAstronautState(visualState);
  }
}

function checkRules() {
  let critical = false;
  let warn = false;

  if (state.sim.hr < RULE.hrLow || state.sim.hr > RULE.hrHigh) warn = true;
  if (state.sim.spo2 < RULE.spo2Warn) warn = true;
  if (state.sim.press < RULE.pressWarn) warn = true;
  if (state.sim.co2 > RULE.co2Warn) warn = true;
  if (state.sim.batt < RULE.battWarn) warn = true;
  if (state.sim.press < RULE.pressCrit) critical = true;

  if (critical) {
    state.suit = 'critical';
    triggerIncident('CRITICAL_EMERGENCY', 'Life support critical failure');
  } else if (warn) {
    state.suit = 'attention';
    triggerIncident('WARNING_ANOMALY', 'Physiological or system deviation');
  } else {
    state.suit = 'normal';
    if (state.incident) {
      state.incident = null;
      logToConsole(I18N.t('log.sc.normal'));
    }
  }
}

function triggerIncident(type, detail) {
  if (state.incident && state.incident.type === type) return;
  
  state.incident = { type, detail, startTime: state.t };
  logToConsole(`ALERT: ${type} - ${detail}`);
  
  if (window.updateAstronautState) {
    const visualState = state.suit === 'critical' ? 'COLLAPSED' : 'NORMAL';
    window.updateAstronautState(visualState);
  }

  if (type === 'CRITICAL_EMERGENCY') {
    startRescueSequence();
  }
}

function startRescueSequence() {
  if (state.rover.running) return;
  
  state.rover.running = true;
  state.rover.auto = true;
  logToConsole(I18N.t('log.rescueDone'), 'Rover RX-1');
  
  const rescueInterval = setInterval(() => {
    if (!state.rover.running) {
      clearInterval(rescueInterval);
      return;
    }
    
    // Simple linear approach to (0,0,0)
    const currentPos = window.roverModel ? window.roverModel.position : { x: -10, z: -5 };
    const dx = 0 - currentPos.x;
    const dz = 0 - currentPos.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    
    if (dist < 2) {
      state.rover.running = false;
      state.rover.arrived = true;
      logToConsole('Rescue operation complete: Astronaut secured.');
      clearInterval(rescueInterval);
    } else {
      const moveX = currentPos.x + (dx / dist) * 0.1;
      const moveZ = currentPos.z + (dz / dist) * 0.1;
      if (window.moveRover) window.moveRover(moveX, moveZ);
    }
  }, 100);
}


function filtrarHistorial(filter) {
  state.histFilter = filter;
  document.querySelectorAll('.filter').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
}

function actualizarIdioma() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = I18N.t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    el.innerHTML = I18N.t(el.getAttribute('data-i18n-html'));
  });
}

// Eventos del DOM
document.querySelectorAll('[data-scenario]').forEach(b => {
  b.addEventListener('click', () => cargarEscenario(b.dataset.scenario));
});

document.querySelectorAll('.nav-tab').forEach(b => {
  b.addEventListener('click', () => cambiarTab(b.dataset.tab));
});

document.querySelectorAll('.filter').forEach(b => {
  b.addEventListener('click', () => filtrarHistorial(b.dataset.filter));
});

// Rover Buttons
$('btnRoverStart')?.addEventListener('click', () => {
  logToConsole('Manual rescue override: deploying rover...');
  startRescueSequence();
});

$('btnRoverStop')?.addEventListener('click', () => {
  state.rover.running = false;
  logToConsole('Rescue operation halted by operator.');
});

$('btnToggle3D')?.addEventListener('click', () => {
  const active = !lunarIsActive;
  window.toggleLunarScene(active);
});

document.addEventListener('DOMContentLoaded', () => {
  initAudio();
  actualizarIdioma();
  
  // Initialize 3D Scene if the tab is open or available
  if (window.initLunarScene) {
    window.initLunarScene();
  }
  
  setInterval(simulationLoop, 100);
});

function cambiarTab(tabId) {
  document.querySelectorAll('.tab').forEach(section => {
    section.hidden = true;
    section.classList.remove('active');
  });
  const target = document.getElementById('tab-' + tabId);
  if (target) {
    target.hidden = false;
    target.classList.add('active');
  }
  document.querySelectorAll('.nav-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
}

window.I18N = I18N;
window.cambiarTab = cambiarTab;

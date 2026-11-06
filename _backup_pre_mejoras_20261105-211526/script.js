'use strict';

(function () {
  const LS_KEY = 'sentinel-rescue-x-v1';
  const LANG_DISK = 'sentinel-lang';
  const MAX_HISTORY = 400;
  const CHART_POINTS = 90;
  const DETECT_CYCLES = 3;
  const MISSED_MS = 30000;
  const TICK_MS = 1000;
  const ROVER_STEP_MS = 420;

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const t = (key, args) => (window.I18N ? window.I18N.t(key, args) : key);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const nowIso = () => new Date().toISOString();

  const BASE = { hr: 72, spo2: 97.8, press: 101.3, co2: 0.42, batt: 86, temp: 36.8, activity: 22, orient: 8 };
  const ASTRONAUT = 'ASTR-02 · HALLEY';
  const MISSION = 'ARTEMIS-LUNAR / EVA-04 (SIM)';
  const LOCATION = 'Mare Crisium · Sector E4 (SIM)';

  const SCENARIO_EXPECT = {
    normal: null, collapse: 'collapse', fall: 'fall', physio: 'physio',
    pressure: 'pressure', co2: 'co2', battery: 'battery', comm: null
  };
  const SCENARIO_LOG = {
    normal: 'log.sc.normal', collapse: 'log.sc.collapse', fall: 'log.sc.fall',
    physio: 'log.sc.physio', pressure: 'log.sc.pressure', co2: 'log.sc.co2',
    comm: 'log.sc.comm', battery: 'log.sc.battery'
  };
  const ML_CLASSES = ['normal', 'collapse', 'fall', 'physio', 'pressure', 'co2', 'battery'];
  const ML_FEATURES = 8;

  const GRID = {
    cols: 16,
    rows: 11,
    cell: 40,
    base: { c: 1, r: 8 },
    astro: { c: 13, r: 2 },
    obstacles: [
      [3, 1], [4, 2], [4, 3], [6, 4], [7, 5], [8, 5], [9, 5], [7, 6],
      [10, 8], [11, 8], [12, 8], [5, 7], [2, 4], [3, 4], [9, 9], [13, 5], [12, 6]
    ],
    wall: [[12, 2], [14, 2], [13, 1], [13, 3]]
  };

  const RULES = [
    { key: 'hrLow', test: (t) => t.hr <= 52, label: 'rl.hrBajo' },
    { key: 'hrHigh', test: (t) => t.hr >= 128, label: 'rl.hrAlto' },
    { key: 'spo2Low', test: (t) => t.spo2 <= 93, label: 'rl.spo2' },
    { key: 'pressLow', test: (t) => t.press <= 84, label: 'rl.presion' },
    { key: 'co2High', test: (t) => t.co2 >= 1.1, label: 'rl.co2' },
    { key: 'battLow', test: (t) => t.batt <= 25, label: 'rl.bateria' },
    { key: 'still', test: (t) => t.activity <= 6, label: 'note.act' },
    { key: 'tilt', test: (t) => Math.abs(t.orient - BASE.orient) >= 58, label: 'rl.caida' },
    { key: 'tempBad', test: (t) => t.temp <= 35.8 || t.temp >= 38.2, label: 'note.temp' }
  ];

  let state = null;
  let tickTimer = null;
  let roverTimer = null;
  let missedTimer = null;
  let saveTimer = null;
  let syncTimer = null;
  let healthTimer = null;
  let scenarioToken = 0;
  let map2d = null;
  let map2dHost = null;

  function defaultMl() {
    return {
      classes: ML_CLASSES.slice(),
      features: ML_FEATURES,
      W: null,
      b: null,
      samples: 0,
      epochs: 0,
      accuracy: null,
      buffer: [],
      auto: true,
      trained: false
    };
  }

  function defaultRover() {
    return {
      obstacles: GRID.obstacles.map((p) => [p[0], p[1]]),
      blocked: false,
      status: 'wait',
      route: [],
      index: 0,
      auto: false
    };
  }

  function defaultState() {
    return {
      version: 1,
      createdAt: Date.now(),
      missionStart: Date.now(),
      sound: true,
      scenario: 'normal',
      scenarioStart: Date.now(),
      expected: null,
      detect: { type: null, count: 0, logged: false },
      active: null,
      ai: null,
      commOk: true,
      queue: [],
      history: [],
      nextEventId: 1,
      metrics: { scenarios: 0, alerts: 0, correct: 0, falseAlarms: 0, missed: 0, latencies: [] },
      ml: defaultMl(),
      rover: defaultRover(),
      tel: Object.assign({}, BASE),
      telHistory: [],
      server: { online: false, ai: 'local-heuristic', model: 'heuristica-ponderada-v1', dbEvents: null, checked: 0 }
    };
  }

  function loadState() {
    let raw = null;
    try { raw = localStorage.getItem(LS_KEY); } catch (e) { raw = null; }
    const def = defaultState();
    if (!raw) return def;
    try {
      const parsed = JSON.parse(raw);
      const merged = Object.assign(def, parsed);
      merged.metrics = Object.assign(def.metrics, parsed.metrics || {});
      merged.ml = Object.assign(defaultMl(), parsed.ml || {});
      if (!Array.isArray(merged.ml.buffer)) merged.ml.buffer = [];
      merged.rover = Object.assign(defaultRover(), parsed.rover || {});
      if (!Array.isArray(merged.rover.obstacles) || !merged.rover.obstacles.length) merged.rover.obstacles = defaultRover().obstacles;
      if (!Array.isArray(merged.queue)) merged.queue = [];
      if (!Array.isArray(merged.history)) merged.history = [];
      if (!Array.isArray(merged.telHistory)) merged.telHistory = [];
      merged.tel = Object.assign({}, BASE, parsed.tel || {});
      merged.server = Object.assign(def.server, parsed.server || {});
      merged.rover.status = 'wait';
      merged.rover.route = [];
      merged.rover.index = 0;
      merged.rover.auto = false;
      if (!merged.nextEventId) merged.nextEventId = merged.history.length + 1;
      return merged;
    } catch (e) {
      return def;
    }
  }

  function save() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () {
      saveTimer = null;
      persistNow();
    }, 250);
  }

  function persistNow() {
    if (!state) return;
    try {
      const copy = Object.assign({}, state);
      copy.telHistory = state.telHistory.slice(-CHART_POINTS);
      copy.history = state.history.slice(-MAX_HISTORY);
      copy.rover = Object.assign({}, state.rover, { route: [], index: 0, auto: false, status: state.rover.status === 'done' ? 'done' : 'wait' });
      localStorage.setItem(LS_KEY, JSON.stringify(copy));
      const saved = $('vSaved');
      if (saved) saved.textContent = 'local · ' + new Date().toLocaleTimeString();
    } catch (e) {
      if (state.ml && state.ml.buffer && state.ml.buffer.length > 200) {
        state.ml.buffer = state.ml.buffer.slice(-200);
        try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e2) {}
      }
    }
  }

  function missionSeconds() {
    return Math.max(0, Math.floor((Date.now() - state.missionStart) / 1000));
  }

  function fmtClock(sec) {
    const s = Math.max(0, Math.floor(sec));
    const hh = String(Math.floor(s / 3600)).padStart(2, '0');
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    return 'T+' + hh + ':' + mm + ':' + ss;
  }

  function fmtWall(iso) {
    try { return new Date(iso).toLocaleTimeString(); } catch (e) { return '—'; }
  }

  function currentMissionTime() {
    return fmtClock(missionSeconds());
  }

  function severityLevelFor(type, tel) {
    if (type === 'collapse' || type === 'fall' || type === 'co2' || type === 'battery') return 'crit';
    if (type === 'pressure' && tel.press <= 84) return 'crit';
    let score = 0;
    if (tel.hr <= 52) score += clamp((52 - tel.hr) * 2.2, 6, 45);
    else if (tel.hr >= 128) score += clamp((tel.hr - 128) * 1.6, 6, 40);
    if (tel.spo2 <= 93) score += clamp((93 - tel.spo2) * 3, 4, 25);
    if (tel.press <= 84) score += clamp((84 - tel.press) * 1.6, 4, 30);
    if (tel.co2 >= 1.1) score += clamp((tel.co2 - 1.1) * 26, 4, 30);
    if (tel.batt <= 25) score += clamp((25 - tel.batt) * 2, 4, 30);
    if (tel.activity <= 6) score += clamp(18 - tel.activity, 8, 18);
    if (Math.abs(tel.orient - BASE.orient) >= 58) score += 20;
    if (tel.temp <= 35.8 || tel.temp >= 38.2) score += 10;
    return clamp(Math.round(score), 0, 100) >= 65 ? 'crit' : 'warn';
  }

  function anomalyScore(tel) {
    let score = 0;
    if (tel.hr <= 52) score += clamp((52 - tel.hr) * 2.2, 6, 45);
    else if (tel.hr >= 128) score += clamp((tel.hr - 128) * 1.6, 6, 40);
    if (tel.spo2 <= 93) score += clamp((93 - tel.spo2) * 3, 4, 25);
    if (tel.press <= 84) score += clamp((84 - tel.press) * 1.6, 4, 30);
    if (tel.co2 >= 1.1) score += clamp((tel.co2 - 1.1) * 26, 4, 30);
    if (tel.batt <= 25) score += clamp((25 - tel.batt) * 2, 4, 30);
    if (tel.activity <= 6) score += clamp(18 - tel.activity, 8, 18);
    if (Math.abs(tel.orient - BASE.orient) >= 58) score += 20;
    if (tel.temp <= 35.8 || tel.temp >= 38.2) score += 10;
    return Math.round(clamp(score, 0, 100));
  }

  function activeRuleList(tel) {
    return RULES.filter((r) => r.test(tel)).map((r) => r.key);
  }

  function classifyRules(list) {
    const has = (k) => list.indexOf(k) >= 0;
    if (has('hrLow') && has('still')) return 'collapse';
    if (has('tilt') && has('still')) return 'fall';
    if ((has('hrHigh') || has('hrLow')) && has('tempBad')) return 'physio';
    if (has('pressLow')) return 'pressure';
    if (has('co2High')) return 'co2';
    if (has('battLow')) return 'battery';
    if (list.length >= 2) return 'combined';
    return null;
  }

  function ruleLabels(list, tel) {
    const data = tel || state.tel;
    return list.map(function (key) {
      const r = RULES.filter((x) => x.key === key)[0];
      if (!r) return key;
      if (key === 'still') return t('note.act', [data.activity.toFixed(0)]);
      if (key === 'tempBad') return t('note.temp', [data.temp.toFixed(1)]);
      if (key === 'tilt') return t('note.orient', [Math.abs(data.orient - BASE.orient).toFixed(0)]);
      return t(r.label);
    }).join(', ');
  }

  function profileFor(scenario, elapsedSec) {
    const p = Object.assign({}, BASE);
    switch (scenario) {
      case 'collapse':
        p.hr = 38; p.spo2 = 94.2; p.press = 99.5; p.co2 = 0.55; p.batt = 79;
        p.temp = 36.1; p.activity = 0; p.orient = 11;
        break;
      case 'fall':
        p.hr = 104; p.spo2 = 94.6; p.press = 96.4; p.co2 = 0.62; p.batt = 76;
        p.temp = 36.3; p.activity = 0; p.orient = 92;
        break;
      case 'physio':
        p.hr = 138 + Math.sin(elapsedSec * 1.7) * 14;
        p.spo2 = 94.8; p.press = 100.2; p.co2 = 0.72; p.batt = 74;
        p.temp = 38.9; p.activity = 13; p.orient = 12;
        break;
      case 'pressure':
        p.hr = 110; p.spo2 = 93.8; p.press = Math.max(70, 101.3 - elapsedSec * 2.1);
        p.co2 = 0.64; p.batt = 78; p.temp = 36.6; p.activity = 10; p.orient = 16;
        break;
      case 'co2':
        p.hr = 116; p.spo2 = 91.6; p.press = 100.1;
        p.co2 = Math.min(1.9, 0.5 + elapsedSec * 0.075);
        p.batt = 77; p.temp = 36.9; p.activity = 9; p.orient = 14;
        break;
      case 'comm':
        p.hr = 88; p.spo2 = 96.4; p.press = 100.3; p.co2 = 0.5; p.batt = 81;
        p.temp = 36.7; p.activity = 18; p.orient = 9;
        break;
      case 'battery':
        p.hr = 92; p.spo2 = 95.9; p.press = 100.6;
        p.co2 = 0.55; p.batt = Math.max(6, 18 - Math.max(0, elapsedSec - 5) * 0.45);
        p.temp = 36.6; p.activity = 12; p.orient = 10;
        break;
      default:
        p.activity = 20 + Math.sin(elapsedSec * 0.6) * 5;
        break;
    }
    return p;
  }

  function stepTelemetry() {
    const elapsed = (Date.now() - (state.scenarioStart || Date.now())) / 1000;
    const target = profileFor(state.scenario, elapsed);
    const tel = state.tel;
    tel.hr += (target.hr - tel.hr) * 0.38 + rnd(-0.9, 0.9);
    tel.spo2 += (target.spo2 - tel.spo2) * 0.35 + rnd(-0.12, 0.12);
    tel.press += (target.press - tel.press) * 0.4 + rnd(-0.18, 0.18);
    tel.co2 += (target.co2 - tel.co2) * 0.38 + rnd(-0.012, 0.012);
    tel.batt += (target.batt - tel.batt) * 0.22 + rnd(-0.06, 0.06);
    tel.temp += (target.temp - tel.temp) * 0.3 + rnd(-0.03, 0.03);
    tel.activity += (target.activity - tel.activity) * 0.5 + rnd(-1.1, 1.1);
    tel.orient += (target.orient - tel.orient) * 0.42 + rnd(-0.6, 0.6);

    tel.hr = clamp(tel.hr, 28, 180);
    tel.spo2 = clamp(tel.spo2, 78, 100);
    tel.press = clamp(tel.press, 45, 110);
    tel.co2 = clamp(tel.co2, 0.2, 2.4);
    tel.batt = clamp(tel.batt, 0, 100);
    tel.temp = clamp(tel.temp, 34.5, 41);
    tel.activity = clamp(tel.activity, 0, 42);
    tel.orient = clamp(tel.orient, 0, 180);

    state.telHistory.push({ hr: tel.hr, spo2: tel.spo2, press: tel.press, co2: tel.co2, batt: tel.batt });
    if (state.telHistory.length > CHART_POINTS) state.telHistory.shift();
  }

  function seedTelemetry() {
    if (state.telHistory.length >= CHART_POINTS) return;
    const list = [];
    for (let i = state.telHistory.length; i < CHART_POINTS; i++) {
      list.push({
        hr: BASE.hr + rnd(-4, 4),
        spo2: BASE.spo2 + rnd(-0.5, 0.5),
        press: BASE.press + rnd(-1, 1),
        co2: BASE.co2 + rnd(-0.05, 0.05),
        batt: BASE.batt + rnd(-1, 1)
      });
    }
    state.telHistory = list.concat(state.telHistory).slice(-CHART_POINTS);
  }

  function mainTick() {
    stepTelemetry();
    evaluateDetection();
    updateMLPrediction();
    if (state.ml.auto) learnLiveSample();
    renderTelemetry();
    drawChart();
    renderRover();
    maybeSyncModel();
    save();
  }

  function evaluateDetection() {
    const list = activeRuleList(state.tel);
    const type = classifyRules(list);
    if (!type) {
      if (state.detect.count || state.detect.type) {
        if (state.detect.logged) log(t('log.detectOK', [ruleLabels(list, state.tel) || '—']), 'info', 'SYS');
        state.detect = { type: null, count: 0, logged: false };
      }
      return;
    }
    if (state.active && state.active.type === type) return;
    if (state.detect.type !== type) {
      state.detect = { type: type, count: 0, logged: false };
    }
    state.detect.count++;
    if (!state.detect.logged) {
      state.detect.logged = true;
      log(t('log.detect', [ruleLabels(list, state.tel), DETECT_CYCLES]), 'warn', type === 'fall' || type === 'collapse' ? 'FISIO' : 'SYS');
    }
    if (state.detect.count >= DETECT_CYCLES && (!state.active || state.active.type !== type)) {
      confirmAlert(type);
    }
  }

  function noteList(tel) {
    const notes = [];
    if (tel.hr <= 52) notes.push(t('note.hrLow', [tel.hr.toFixed(0)]));
    else if (tel.hr >= 128) notes.push(t('note.hrHigh', [tel.hr.toFixed(0)]));
    if (tel.spo2 <= 93) notes.push(t('note.spo2', [tel.spo2.toFixed(1)]));
    if (tel.press <= 84) notes.push(t('note.press', [tel.press.toFixed(1)]));
    if (tel.co2 >= 1.1) notes.push(t('note.co2', [tel.co2.toFixed(2)]));
    if (tel.batt <= 25) notes.push(t('note.batt', [tel.batt.toFixed(0)]));
    if (tel.activity <= 6) notes.push(t('note.act', [tel.activity.toFixed(0)]));
    if (Math.abs(tel.orient - BASE.orient) >= 58) notes.push(t('note.orient', [Math.abs(tel.orient - BASE.orient).toFixed(0)]));
    if (tel.temp <= 35.8 || tel.temp >= 38.2) notes.push(t('note.temp', [tel.temp.toFixed(1)]));
    return notes;
  }

  function confirmAlert(type) {
    const tel = Object.assign({}, state.tel);
    const level = severityLevelFor(type, tel);
    const mt = currentMissionTime();
    const wall = nowIso();
    const label = t('type.' + type);
    const checks = t('kb.' + type + '.checks');
    const uncertainty = t('kb.' + type + '.uncertainty');
    const trigger = t('kb.' + type + '.trigger');
    const payload = formatIndicators(tel);
    const active = {
      type: type,
      label: label,
      level: level,
      escalated: false,
      mt: mt,
      wall: wall,
      trigger: trigger,
      checks: checks,
      uncertainty: uncertainty,
      payload: payload,
      delivery: state.commOk ? 'sent' : 'queued',
      score: anomalyScore(tel),
      ai: null
    };
    const wasActive = state.active;
    state.active = active;
    state.metrics.alerts++;
    const expected = state.expected || SCENARIO_EXPECT[state.scenario];
    const latency = Math.max(0, Math.round(performance.now() - (state.scenarioStartWall || state.scenarioStart || Date.now())));
    log(t('log.alert', [label, ruleLabels(activeRuleList(tel), tel)]), level === 'crit' ? 'crit' : 'warn', type === 'comm' ? 'COMMS' : 'FISIO');
    if (!wasActive || wasActive.type !== type) showBanner(label, level === 'crit');
    if (level === 'crit' && state.rover.status !== 'route' && state.rover.status !== 'auto' && state.rover.status !== 'done') startRover(true);
    if (expected === type) {
      state.metrics.correct++;
      state.metrics.latencies.push(latency);
      log(t('log.correct', [t('sc.' + type + '.b'), latency]), 'info', 'SYS');
    } else if (expected) {
      state.metrics.falseAlarms++;
      log(t('log.falseAlarm'), 'warn', 'SYS');
    } else if (state.scenario === 'normal' || state.scenario === 'comm') {
      state.metrics.falseAlarms++;
      log(t('log.falseAlarm'), 'warn', 'SYS');
    }

    if (state.commOk) {
      log(t('log.tx', [label]), 'info', 'COMMS', t('st.sent'));
      active.delivery = 'sent';
    } else {
      addQueue(label + ' — ' + mt);
      log(t('log.queued', [label]), 'warn', 'COMMS', t('st.queued'));
      active.delivery = 'queued';
    }
    playAlertSound(level);

    if (state.detect.logged) {
      state.detect.logged = false;
      state.detect.count = 0;
    }
    state.expected = expected;
    state.ai = null;
    renderActive();
    renderStats();
    save();
    persistIncident(active);
    learnSample(tel, type);
  }

  function escalateIfNeeded() {
    if (!state.active) return;
    const level = severityLevelFor(state.active.type, state.tel);
    if (level === 'crit' && state.active.level !== 'crit') {
      state.active.level = 'crit';
      state.active.escalated = true;
      state.active.score = anomalyScore(state.tel);
      state.active.payload = formatIndicators(state.tel);
      log(t('log.escalate', [state.active.label]), 'crit', 'FISIO');
      showBanner(state.active.label, true, true);
      if (state.rover.status === 'wait' || state.rover.status === 'noRoute') startRover(true);
      save();
    }
  }

  function formatIndicators(tel) {
    return [
      'FC ' + tel.hr.toFixed(0) + ' lpm',
      'SpO2 ' + tel.spo2.toFixed(1) + '%',
      'P ' + tel.press.toFixed(1) + ' kPa',
      'CO2 ' + tel.co2.toFixed(2) + '%',
      'BAT ' + tel.batt.toFixed(0) + '%',
      'T ' + tel.temp.toFixed(1) + '°C',
      'ACT ' + tel.activity.toFixed(0),
      'ORI ' + tel.orient.toFixed(0) + '°'
    ].join(' · ');
  }

  function addQueue(text) {
    state.queue.push({ id: state.nextEventId++, mt: currentMissionTime(), wall: nowIso(), text: text, status: 'queued' });
    if (state.queue.length > 100) state.queue.shift();
    renderQueue();
    save();
  }

  function restoreComm() {
    state.commOk = true;
    log(t('log.restoreAck'), 'info', 'COMMS');
    const pending = state.queue.filter((q) => q.status !== 'sent');
    pending.forEach(function (q) { q.status = 'sent'; });
    if (state.active && state.active.delivery === 'queued') state.active.delivery = 'resync';
    log(pending.length ? t('log.flush', [pending.length]) : t('log.flushNone'), 'info', 'COMMS');
    renderStatic();
    renderComm();
    renderActive();
    renderStats();
    save();
  }

  function setScenario(name) {
    if (!SCENARIO_EXPECT.hasOwnProperty(name)) return;
    const previous = state.scenario;
    state.scenario = name;
    state.scenarioStart = Date.now();
    state.scenarioStartWall = performance.now();
    state.expected = SCENARIO_EXPECT[name];
    state.detect = { type: null, count: 0, logged: false };
    state.active = null;
    state.ai = null;
    state.metrics.scenarios++;
    const token = ++scenarioToken;
    if (missedTimer) { clearTimeout(missedTimer); missedTimer = null; }

    if (name === 'normal') {
      if (!state.commOk) {
        const pending = state.queue.filter(function (q) { return q.status !== 'sent'; });
        pending.forEach(function (q) { q.status = 'sent'; });
        if (pending.length) log(t('log.flush', [pending.length]), 'info', 'COMMS');
      }
      state.commOk = true;
      state.tel = Object.assign({}, BASE);
      state.rover.status = 'wait';
      state.rover.route = [];
      state.rover.index = 0;
      state.rover.auto = false;
      if (roverTimer) { clearInterval(roverTimer); roverTimer = null; }
      if (previous !== 'normal') log(t('log.roverCancel'), 'info', 'ROVER');
    }
    if (name === 'comm') {
      state.commOk = false;
      log(t('log.sc.comm'), 'warn', 'COMMS');
      addQueue(currentMissionTime() + ' · ' + t('log.sc.comm'));
    } else {
      log(t('log.scenario', [t('sc.' + name + '.b')]), name === 'normal' ? 'info' : 'warn', name === 'comm' ? 'COMMS' : 'SYS');
    }
    if (name !== 'comm') log(t(SCENARIO_LOG[name]), name === 'normal' ? 'info' : 'warn', 'SYS');

    if (state.expected) {
      missedTimer = setTimeout(function () {
        if (scenarioToken !== token) return;
        if (state.scenario !== name) return;
        if (state.active && state.active.type === state.expected) return;
        state.metrics.missed++;
        log(t('log.missed', [t('sc.' + name + '.b')]), 'warn', 'SYS');
        renderStats();
        save();
      }, MISSED_MS);
    }
    hideBanner();
    renderAll();
    save();
  }

  function checkEscalation() {
    if (!state.active) return;
    const level = severityLevelFor(state.active.type, state.tel);
    if (level === 'crit' && state.active.level !== 'crit') escalateIfNeeded();
    else if (level === 'warn' && state.active.level === 'crit' && state.scenario === 'normal') {
      state.active = null;
    }
  }

  function showBanner(label, critical, escalated) {
    const banner = $('alertBanner');
    const text = $('alertBannerText');
    if (!banner || !text) return;
    const key = critical ? (escalated ? 'banner.critEsc' : 'banner.crit') : 'banner.warn';
    text.textContent = t(key, [label]);
    banner.classList.remove('hidden');
    banner.classList.toggle('warn', !critical);
  }

  function hideBanner() {
    const banner = $('alertBanner');
    if (banner) banner.classList.add('hidden');
  }

  function acknowledge() {
    hideBanner();
    log(t('log.ack'), 'info', 'SYS');
  }

  function playAlertSound(level) {
    if (!state.sound) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!playAlertSound.ctx) playAlertSound.ctx = new Ctx();
      const ctx = playAlertSound.ctx;
      if (ctx.state === 'suspended') ctx.resume();
      const seq = level === 'crit' ? [880, 660, 880] : [660, 520];
      seq.forEach(function (freq, i) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + i * 0.22 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.19);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.22);
        osc.stop(ctx.currentTime + i * 0.22 + 0.2);
      });
    } catch (e) {}
  }

  function toggleSound() {
    state.sound = !state.sound;
    const btn = $('soundBtn');
    if (btn) btn.textContent = t(state.sound ? 'sound.on' : 'sound.off');
    if (state.sound) playAlertSound('warn');
    save();
  }

  function log(msg, sev, cat, status) {
    if (!msg) return;
    const ev = {
      id: state.nextEventId++,
      mt: currentMissionTime(),
      wall: nowIso(),
      sev: sev || 'info',
      cat: cat || 'SYS',
      msg: String(msg),
      status: status || null,
      synced: false
    };
    state.history.push(ev);
    if (state.history.length > MAX_HISTORY) state.history.shift();
    appendConsole(ev);
    renderHistory();
    renderStats();
    save();
    scheduleSync();
  }

  function appendConsole(ev) {
    const box = $('emergencyConsole');
    if (!box) return;
    const line = document.createElement('div');
    line.className = 'console-line sev-' + (ev.sev === 'crit' ? 'crit' : ev.sev === 'warn' ? 'warn' : 'info');
    line.textContent = '[' + ev.mt + '] [' + ev.cat + '] ' + ev.msg;
    box.appendChild(line);
    while (box.children.length > 90) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
  }

  function renderConsole() {
    const box = $('emergencyConsole');
    if (!box) return;
    box.innerHTML = '';
    state.history.slice(-80).forEach(appendConsole);
  }

  function syncEvents() {
    if (!state.server.online) return;
    const pending = state.history.filter((e) => !e.synced).slice(0, 80);
    if (!pending.length) return;
    const payload = pending.map(function (e) {
      return { mt: e.mt, wall: e.wall, sev: e.sev, cat: e.cat, msg: e.msg, status: e.status };
    });
    fetch('/api/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ events: payload })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.ok) return;
      pending.forEach(function (e) { e.synced = true; });
      save();
      refreshHealth();
    }).catch(function () {});
  }

  function scheduleSync() {
    if (syncTimer) return;
    syncTimer = setTimeout(function () {
      syncTimer = null;
      syncEvents();
    }, 1200);
  }

  function persistIncident(active) {
    const incident = {
      type: active.label,
      severity: t('sev.' + active.level),
      mt: active.mt,
      wall: active.wall,
      payload: active.payload,
      trigger: active.trigger,
      checks: active.checks,
      uncertainty: active.uncertainty,
      delivered: active.delivery
    };
    if (!state.server.online) {
      evaluateLocalAI(active);
      return;
    }
    fetch('/api/incidents', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(incident)
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.ok) { evaluateLocalAI(active); return; }
      return fetch('/api/ai/alert', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          incidentId: j.id,
          incident: {
            type: incident.type,
            severity: incident.severity,
            wall: incident.wall,
            trigger: incident.trigger,
            checks: incident.checks,
            uncertainty: incident.uncertainty,
            payload: incident.payload,
            eventsTail: state.history.slice(-8).map(function (e) { return e.msg; })
          },
          indicators: state.tel
        })
      }).then(function (r2) { return r2.ok ? r2.json() : null; }).then(function (ai) {
        if (ai && ai.ok) applyAI(active, ai);
        else evaluateLocalAI(active);
      });
    }).catch(function () { evaluateLocalAI(active); });
  }

  function applyAI(active, ai) {
    const sourceKey = ai.source === 'openai' ? 'ai.b.openai' : 'ai.b.server';
    const sourceLabel = ai.source === 'openai' ? t(sourceKey, [ai.model || '']) : t(sourceKey);
    active.ai = { source: ai.source, sourceLabel: sourceLabel, score: ai.score, severity: ai.severity, text: ai.text };
    state.ai = active.ai;
    renderActive();
    save();
  }

  function evaluateLocalAI(active) {
    const notes = noteList(state.tel);
    const score = anomalyScore(state.tel);
    const sev = t('sev.' + (score >= 65 ? 'crit' : 'warn'));
    const lines = [
      t('lai.head'),
      t('lai.summary', [active.label, score, sev]),
      t('lai.ind', [notes.length ? notes.join('; ') : t('lai.none')]),
      t('lai.unc', [active.uncertainty]),
      t('lai.checks', [active.checks])
    ];
    active.ai = {
      source: 'browser',
      sourceLabel: t('ai.b.browser'),
      score: score,
      severity: sev,
      text: lines.join('\n')
    };
    state.ai = active.ai;
    renderActive();
    save();
  }

  function renderTelemetry() {
    const tel = state.tel;
    setVal('vHr', tel.hr.toFixed(0));
    setVal('vSpo2', tel.spo2.toFixed(1));
    setVal('vPress', tel.press.toFixed(1));
    setVal('vCo2', tel.co2.toFixed(2));
    setVal('vBatt', tel.batt.toFixed(0) + '%');
    setVal('vTemp', tel.temp.toFixed(1));
    setVal('vActivity', tel.activity <= 6 ? t('move.still') : tel.activity <= 14 ? t('move.idle') : t('move.active'));
    setVal('vOrient', tel.orient.toFixed(0) + '°');

    setTrend('tHr', tel.hr - BASE.hr, 3);
    setTrend('tSpo2', tel.spo2 - BASE.spo2, 0.4);
    setTrend('tPress', tel.press - BASE.press, 1.2);
    setTrend('tCo2', tel.co2 - BASE.co2, 0.08);
    setTrend('tBatt', tel.batt - BASE.batt, 1);
    setTrend('tTemp', tel.temp - BASE.temp, 0.15);
    setTrend('tMove', tel.activity - BASE.activity, 3);
    setTrend('tOrient', tel.orient - BASE.orient, 4);

    setIndClass('indHr', tel.hr <= 52 || tel.hr >= 128 ? 'crit' : tel.hr <= 60 || tel.hr >= 115 ? 'warn' : '');
    setIndClass('indSpo2', tel.spo2 <= 90 ? 'crit' : tel.spo2 <= 93 ? 'warn' : '');
    setIndClass('indPress', tel.press <= 84 ? 'crit' : tel.press <= 92 ? 'warn' : '');
    setIndClass('indCo2', tel.co2 >= 1.3 ? 'crit' : tel.co2 >= 1.1 ? 'warn' : '');
    setIndClass('indBatt', tel.batt <= 12 ? 'crit' : tel.batt <= 25 ? 'warn' : '');
    setIndClass('indTemp', tel.temp >= 39 || tel.temp <= 35.5 ? 'crit' : tel.temp >= 38.2 || tel.temp <= 35.8 ? 'warn' : '');
    setIndClass('indMove', tel.activity <= 6 && Math.abs(tel.orient - BASE.orient) >= 58 ? 'crit' : tel.activity <= 6 ? 'warn' : '');
    setIndClass('indOrient', Math.abs(tel.orient - BASE.orient) >= 80 ? 'crit' : Math.abs(tel.orient - BASE.orient) >= 58 ? 'warn' : '');

    const anyCrit = ['indHr', 'indSpo2', 'indPress', 'indCo2', 'indBatt', 'indTemp', 'indMove', 'indOrient']
      .some((id) => $(id) && $(id).classList.contains('crit'));
    const anyWarn = ['indHr', 'indSpo2', 'indPress', 'indCo2', 'indBatt', 'indTemp', 'indMove', 'indOrient']
      .some((id) => $(id) && $(id).classList.contains('warn'));
    const level = anyCrit ? 'crit' : anyWarn ? 'warn' : 'normal';
    const suit = $('suitName');
    if (suit) {
      suit.textContent = t('s.' + level);
      suit.className = 'pill ' + (level === 'crit' ? 'bad' : level === 'warn' ? 'mid' : 'ok');
    }
    const visual = $('astroVisual');
    if (visual) {
      visual.classList.remove('st-normal', 'st-warn', 'st-crit');
      visual.classList.add('st-' + level);
    }
    if (window.updateAstronautState) {
      try {
        const collapsed = state.active && (state.active.type === 'collapse' || state.active.type === 'fall');
        window.updateAstronautState(collapsed || (tel.activity <= 3 && Math.abs(tel.orient - BASE.orient) > 45) ? 'COLLAPSED' : 'NORMAL');
      } catch (e) {}
    }
    const comm = $('commStatus');
    if (comm) {
      comm.textContent = t(state.commOk ? 'lab.linkOk' : 'lab.noLink');
      comm.className = 'pill ' + (state.commOk ? 'ok' : 'bad');
    }
    checkEscalation();
  }

  function setVal(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
  }

  function setTrend(id, diff, threshold) {
    const el = $(id);
    if (!el) return;
    let key = 'tr.stable';
    let cls = '';
    if (diff > threshold) { key = 'tr.up'; cls = 'pos'; }
    else if (diff < -threshold) { key = 'tr.down'; cls = 'neg'; }
    el.textContent = t(key);
    el.className = 'trend ' + cls;
  }

  function setIndClass(id, cls) {
    const el = $(id);
    if (!el) return;
    el.classList.remove('warn', 'crit');
    if (cls) el.classList.add(cls);
  }

  function renderClock() {
    setVal('missionClock', fmtClock(missionSeconds()));
  }

  function renderStatic() {
    $$('[data-mission-name]').forEach(function (el) { el.textContent = MISSION; });
    setVal('vAstronaut', ASTRONAUT);
    setVal('vAstronaut2', ASTRONAUT);
    setVal('vLocation', LOCATION);
    const sound = $('soundBtn');
    if (sound) sound.textContent = t(state.sound ? 'sound.on' : 'sound.off');
    const db = $('dbChip');
    if (db) {
      if (state.server.online) {
        const ai = state.server.ai === 'openai' ? t('ai.provider.openai') : t('ai.provider.local');
        db.textContent = t('chip.dbOn', [ai]);
        db.className = 'chip chip-ok';
      } else {
        db.textContent = t('chip.dbOff');
        db.className = 'chip';
      }
    }
    const comm = $('headerCommChip');
    if (comm) {
      comm.textContent = t(state.commOk ? 'chip.commOk' : 'chip.commBad');
      comm.className = 'chip ' + (state.commOk ? 'chip-ok' : 'chip-bad');
    }
    const btnBlock = $('btnBlockDemo');
    if (btnBlock) btnBlock.textContent = t(state.rover.blocked ? 'btn.unblock' : 'btn.block');
    const mlAuto = $('btnMlAuto');
    if (mlAuto) mlAuto.textContent = t(state.ml.auto ? 'ml.auto.on' : 'ml.auto.off');
    const restore = $('btnCommRestore');
    if (restore) restore.hidden = state.commOk;
  }

  function renderComm() {
    const mirror = $('ccCommMirror');
    if (mirror) {
      mirror.textContent = t(state.commOk ? 'cc.linkOk' : 'cc.linkBad');
      mirror.className = 'pill ' + (state.commOk ? 'ok' : 'bad');
    }
    const pending = state.queue.filter((q) => q.status !== 'sent').length;
    setVal('ccQueue', pending ? t('q.pending', [pending]) : t('q.none'));
    const restore = $('btnCommRestore');
    if (restore) restore.hidden = state.commOk;
    renderQueue();
  }

  function renderQueue() {
    const list = $('queueList');
    if (!list) return;
    list.innerHTML = '';
    if (!state.queue.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = t('q.empty');
      list.appendChild(p);
      return;
    }
    state.queue.slice(-20).reverse().forEach(function (q) {
      const row = document.createElement('div');
      row.className = 'qrow' + (q.status === 'sent' ? ' sent' : '');
      const time = document.createElement('span');
      time.className = 'q-time';
      time.textContent = q.mt;
      const msg = document.createElement('span');
      msg.className = 'q-msg';
      msg.textContent = q.text;
      const st = document.createElement('span');
      st.className = 'q-st';
      st.textContent = t(q.status === 'sent' ? 'st.sent' : 'st.queued');
      row.appendChild(time);
      row.appendChild(msg);
      row.appendChild(st);
      list.appendChild(row);
    });
  }

  function renderActive() {
    const a = state.active;
    const client = state.ai;
    setVal('ccIncident', a ? (a.escalated ? t('cc.incEsc', [a.label, t('sev.' + a.level)]) : t('cc.incText', [a.label, t('sev.' + a.level)])) : '—');
    setVal('ccIncidentTime', a ? a.mt + ' · ' + fmtWall(a.wall) : '—');
    setVal('ccTrigger', a ? a.trigger : '—');
    setVal('ccPayload', a ? a.payload : '—');
    setVal('ccChecks', a ? a.checks : '—');
    setVal('ccUncertainty', a ? a.uncertainty : '—');
    let protocol = 'pr.normal';
    if (a) protocol = a.level === 'crit' ? 'pr.conting' : 'pr.verify';
    else if (state.detect.type) protocol = 'pr.verify';
    const proto = $('ccProtocol');
    if (proto) {
      proto.textContent = t(protocol);
      proto.className = 'big-val' + (protocol === 'pr.conting' ? ' bad' : protocol === 'pr.verify' ? ' warn' : '');
    }
    const badge = $('aiSource');
    const text = $('aiText');
    if (client) {
      if (badge) {
        const cls = client.source === 'openai' ? 'openai' : client.source === 'ml' ? 'mid' : 'local';
        badge.textContent = client.sourceLabel || client.source;
        badge.className = 'ai-badge ' + cls;
      }
      if (text) text.textContent = client.text;
    } else if (a) {
      if (badge) { badge.textContent = t('ai.b.calc'); badge.className = 'ai-badge mid'; }
      if (text) text.textContent = t('ai.calc');
    } else {
      if (badge) { badge.textContent = '—'; badge.className = 'ai-badge'; }
      if (text) text.textContent = '—';
    }
  }

  function renderStats() {
    const m = state.metrics;
    setVal('statAlerts', String(m.alerts));
    setVal('statQueue', String(state.queue.filter((q) => q.status !== 'sent').length));
    setVal('statResponse', m.latencies.length ? Math.round(m.latencies[m.latencies.length - 1]) + ' ms' : '—');
    setVal('mtrScenarios', String(m.scenarios));
    setVal('mtrAlerts', String(m.alerts));
    setVal('mtrCorrect', String(m.correct));
    setVal('mtrFalse', String(m.falseAlarms));
    setVal('mtrMissed', String(m.missed));
    const avg = m.latencies.length ? Math.round(m.latencies.reduce((a, b) => a + b, 0) / m.latencies.length) : null;
    setVal('mtrAvg', avg == null ? '—' : avg + ' ms');
    setVal('mtrComm', t(state.commOk ? 'mtr.commOk' : 'mtr.commBad'));
    setVal('mtrDb', state.server.online && state.server.dbEvents != null ? String(state.server.dbEvents) : String(state.history.length));
    setVal('eventsCount', String(state.history.length));
    setVal('statAlerts', String(m.alerts));
  }

  function renderHistory() {
    const list = $('historyList');
    if (!list) return;
    const filter = (document.querySelector('.filter.active') || {}).dataset;
    const cat = filter && filter.filter ? filter.filter : 'all';
    const rows = state.history.filter((e) => cat === 'all' || e.cat === cat).slice().reverse().slice(0, 150);
    list.innerHTML = '';
    if (!rows.length) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = t('hist.empty');
      list.appendChild(p);
      return;
    }
    rows.forEach(function (e) {
      const row = document.createElement('div');
      row.className = 'hrow sev-' + (e.sev === 'crit' ? 'crit' : e.sev === 'warn' ? 'warn' : 'info');
      const mt = document.createElement('span'); mt.className = 'h-mission'; mt.textContent = e.mt;
      const c = document.createElement('span'); c.className = 'h-cat'; c.textContent = e.cat;
      const msg = document.createElement('span'); msg.className = 'h-msg'; msg.textContent = e.msg;
      const st = document.createElement('span'); st.className = 'h-st'; st.textContent = e.status || '';
      row.appendChild(mt); row.appendChild(c); row.appendChild(msg); row.appendChild(st);
      list.appendChild(row);
    });
    setVal('eventsCount', String(state.history.length));
  }

  function drawChart() {
    const canvas = $('telemetryChart');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(320, Math.floor(rect.width || 600));
    const h = Math.max(160, Math.floor(rect.height || 180));
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const padL = 34, padR = 10, padT = 10, padB = 20;
    const iw = w - padL - padR;
    const ih = h - padT - padB;

    ctx.strokeStyle = 'rgba(22,50,74,.75)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (ih / 4) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(125,144,171,.85)';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('100', padL - 5, padT + 8);
    ctx.fillText('50', padL - 5, padT + ih / 2 + 3);
    ctx.fillText('0', padL - 5, padT + ih + 3);

    const data = state.telHistory;
    if (!data.length) return;
    const series = [
      { key: 'hr', color: '#00d4ff', min: 20, max: 170 },
      { key: 'spo2', color: '#00e676', min: 78, max: 100 },
      { key: 'press', color: '#ff6b35', min: 45, max: 110 },
      { key: 'co2', color: '#ff3d5e', min: 0.2, max: 2.2 },
      { key: 'batt', color: '#ffb400', min: 0, max: 100 }
    ];
    const n = CHART_POINTS;
    const step = iw / (n - 1);
    series.forEach(function (s) {
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.92;
      data.forEach(function (p, i) {
        const x = padL + i * step;
        const v = clamp((p[s.key] - s.min) / (s.max - s.min), 0, 1);
        const y = padT + ih - v * ih;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(69,99,127,.9)';
    ctx.textAlign = 'left';
    ctx.fillText('90 · ' + t('chart.note'), padL, h - 6);
  }

  function featuresOf(tel) {
    return [
      (tel.hr - 28) / 152,
      (tel.spo2 - 78) / 22,
      (tel.press - 45) / 65,
      (tel.co2 - 0.2) / 2.2,
      tel.batt / 100,
      (tel.temp - 34) / 7,
      tel.activity / 42,
      tel.orient / 180
    ];
  }

  function mlRanges(cls) {
    const sets = {
      normal: { hr: [62, 86], spo2: [96, 99.5], press: [97, 103], co2: [0.3, 0.6], batt: [50, 95], temp: [36.2, 37.0], activity: [10, 30], orient: [2, 20] },
      collapse: { hr: [33, 51], spo2: [91, 96], press: [94, 101], co2: [0.4, 0.9], batt: [50, 90], temp: [35.8, 36.5], activity: [0, 4], orient: [2, 30] },
      fall: { hr: [76, 124], spo2: [91, 97], press: [86, 100], co2: [0.4, 1.0], batt: [48, 90], temp: [35.9, 37.2], activity: [0, 4], orient: [62, 115] },
      physio: { hr: [100, 152], spo2: [90, 96], press: [94, 102], co2: [0.4, 1.05], batt: [48, 90], temp: [38.2, 40], activity: [4, 20], orient: [2, 40] },
      pressure: { hr: [86, 132], spo2: [88, 96], press: [52, 83], co2: [0.4, 1.05], batt: [48, 90], temp: [35.9, 37.5], activity: [3, 20], orient: [2, 40] },
      co2: { hr: [92, 142], spo2: [84, 93], press: [94, 102], co2: [1.1, 2.2], batt: [48, 90], temp: [35.9, 37.6], activity: [2, 18], orient: [2, 40] },
      battery: { hr: [72, 112], spo2: [92, 98], press: [94, 102], co2: [0.4, 0.95], batt: [4, 25], temp: [35.8, 37.2], activity: [3, 18], orient: [2, 40] }
    };
    return sets[cls] || sets.normal;
  }

  function syntheticSample(cls) {
    const r = mlRanges(cls);
    const tel = {
      hr: rnd(r.hr[0], r.hr[1]),
      spo2: rnd(r.spo2[0], r.spo2[1]),
      press: rnd(r.press[0], r.press[1]),
      co2: rnd(r.co2[0], r.co2[1]),
      batt: rnd(r.batt[0], r.batt[1]),
      temp: rnd(r.temp[0], r.temp[1]),
      activity: rnd(r.activity[0], r.activity[1]),
      orient: rnd(r.orient[0], r.orient[1])
    };
    return { x: featuresOf(tel), y: ML_CLASSES.indexOf(cls) };
  }

  function ensureMlBuffer() {
    const ml = state.ml;
    if (!Array.isArray(ml.buffer)) ml.buffer = [];
    if (ml.buffer.length < 210) {
      ML_CLASSES.forEach(function (cls) {
        const count = Math.ceil((210 - ml.buffer.length) / ML_CLASSES.length);
        for (let i = 0; i < count; i++) ml.buffer.push(syntheticSample(cls));
      });
    }
  }

  function initWeights() {
    const ml = state.ml;
    if (!Array.isArray(ml.W) || ml.W.length !== ML_CLASSES.length || !Array.isArray(ml.W[0]) || ml.W[0].length !== ML_FEATURES) {
      ml.W = ML_CLASSES.map(function () { return new Array(ML_FEATURES).fill(0); });
      ml.b = new Array(ML_CLASSES.length).fill(0);
      ml.trained = false;
    }
    if (!Array.isArray(ml.b) || ml.b.length !== ML_CLASSES.length) ml.b = new Array(ML_CLASSES.length).fill(0);
    if (!ml.classes || ml.classes.length !== ML_CLASSES.length) ml.classes = ML_CLASSES.slice();
    if (!ml.features) ml.features = ML_FEATURES;
  }

  function softmax(z) {
    let max = -Infinity;
    for (let i = 0; i < z.length; i++) if (z[i] > max) max = z[i];
    let sum = 0;
    const out = new Array(z.length);
    for (let i = 0; i < z.length; i++) { out[i] = Math.exp(z[i] - max); sum += out[i]; }
    for (let i = 0; i < z.length; i++) out[i] /= sum || 1;
    return out;
  }

  function scores(x) {
    const W = state.ml.W;
    const b = state.ml.b;
    const z = new Array(ML_CLASSES.length);
    for (let c = 0; c < ML_CLASSES.length; c++) {
      let s = b[c];
      for (let f = 0; f < ML_FEATURES; f++) s += W[c][f] * x[f];
      z[c] = s;
    }
    return z;
  }

  function predict(x) {
    initWeights();
    const p = softmax(scores(x));
    const order = p.map(function (v, i) { return { i: i, p: v, cls: ML_CLASSES[i] }; })
      .sort(function (a, b) { return b.p - a.p; });
    return { probs: p, top: order };
  }

  function trainMl(epochs) {
    ensureMlBuffer();
    initWeights();
    const ml = state.ml;
    const data = ml.buffer;
    if (!data.length) return;
    const lr = 0.16;
    const e = Math.max(1, epochs || 6);
    const order = data.map(function (_, i) { return i; });
    for (let ep = 0; ep < e; ep++) {
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = order[i]; order[i] = order[j]; order[j] = tmp;
      }
      order.forEach(function (idx) {
        const sample = data[idx];
        const x = sample.x;
        if (!x || x.length !== ML_FEATURES) return;
        const p = softmax(scores(x));
        for (let c = 0; c < ML_CLASSES.length; c++) {
          const grad = p[c] - (c === sample.y ? 1 : 0);
          if (!Number.isFinite(grad)) continue;
          ml.b[c] -= lr * grad;
          for (let f = 0; f < ML_FEATURES; f++) {
            ml.W[c][f] -= lr * grad * (Number.isFinite(x[f]) ? x[f] : 0);
          }
        }
      });
    }
    ml.epochs += e;
    ml.samples = data.length;
    ml.trained = true;
    let ok = 0;
    const val = data.filter(function (_, i) { return i % 5 === 0; });
    val.forEach(function (s) {
      const p = predict(s.x);
      if (p.top[0].i === s.y) ok++;
    });
    ml.accuracy = val.length ? Math.round((ok / val.length) * 1000) / 10 : null;
    save();
    renderMlMeta();
    return ml.accuracy;
  }

  function learnLiveSample() {
    if (!state.ml.auto) return;
    if (state.tickCount == null) state.tickCount = 0;
    state.tickCount++;
    if (state.tickCount % 5 !== 0) return;
    const cls = state.scenario === 'comm' ? 'normal' : state.scenario;
    const y = ML_CLASSES.indexOf(cls);
    if (y < 0) return;
    learnSample(state.tel, cls, true);
  }

  function learnSample(tel, cls, quiet) {
    const y = ML_CLASSES.indexOf(cls === 'combined' ? 'physio' : cls);
    if (y < 0) return;
    if (!Array.isArray(state.ml.buffer)) state.ml.buffer = [];
    state.ml.buffer.push({ x: featuresOf(tel), y: y });
    if (state.ml.buffer.length > 700) state.ml.buffer.splice(0, state.ml.buffer.length - 700);
    if (!quiet) log(t('log.mlSample', [t('ml.cls.' + cls) || cls]), 'info', 'SYS');
    if (state.ml.buffer.length % 25 === 0) trainMl(4);
  }

  function updateMLPrediction() {
    ensureMlBuffer();
    initWeights();
    if (!state.ml.trained) trainMl(20);
    const p = predict(featuresOf(state.tel));
    state.mlPrediction = p;
    renderMlPrediction(p);
  }

  function renderMlPrediction(p) {
    const pred = p.top[0];
    const pill = $('mlPred');
    if (pill) {
      pill.textContent = t('ml.cls.' + pred.cls);
      const expected = state.scenario === 'comm' ? 'normal' : state.scenario;
      pill.className = 'pill ' + (pred.p >= 0.6 ? 'ok' : pred.p >= 0.35 ? 'mid' : '');
      if (expected) {
        pill.classList.remove('ok', 'mid');
        pill.classList.add(pred.cls === expected ? 'ok' : 'mid');
      }
    }
    setVal('mlConfTxt', (pred.p * 100).toFixed(1) + '%');
    const bar = $('mlConfBar');
    if (bar) bar.style.width = Math.round(pred.p * 100) + '%';
    const top = $('mlTop3');
    if (top) {
      top.innerHTML = '';
      p.top.slice(0, 3).forEach(function (o) {
        const div = document.createElement('div');
        div.textContent = t('ml.cls.' + o.cls) + ' · ' + (o.p * 100).toFixed(1) + '%';
        top.appendChild(div);
      });
    }
    const expected = state.scenario === 'comm' ? 'normal' : state.scenario;
    setVal('mlLastTruth', expected ? (pred.cls === expected ? t('ml.ok') : t('ml.mismatch')) : t('ml.none'));
  }

  function renderMlMeta() {
    setVal('mlSamples', String(state.ml.buffer ? state.ml.buffer.length : 0));
    setVal('mlEpochs', String(state.ml.epochs || 0));
    setVal('mlAcc', state.ml.accuracy == null ? '—' : state.ml.accuracy.toFixed(1) + '%');
    const auto = $('btnMlAuto');
    if (auto) auto.textContent = t(state.ml.auto ? 'ml.auto.on' : 'ml.auto.off');
  }

  function trainNow() {
    const acc = trainMl(30);
    log(t('log.mlTrained', [state.ml.buffer.length, state.ml.epochs, acc == null ? '—' : acc.toFixed(1)]), 'info', 'SYS');
    updateMLPrediction();
    syncModel();
  }

  function generateSamples() {
    ensureMlBuffer();
    for (let i = 0; i < 50; i++) {
      const cls = ML_CLASSES[i % ML_CLASSES.length];
      state.ml.buffer.push(syntheticSample(cls));
    }
    if (state.ml.buffer.length > 700) state.ml.buffer.splice(0, state.ml.buffer.length - 700);
    log(t('log.mlGen', [50]), 'info', 'SYS');
    trainMl(8);
    updateMLPrediction();
    save();
  }

  function toggleMlAuto() {
    state.ml.auto = !state.ml.auto;
    renderMlMeta();
    save();
  }

  function syncModel() {
    if (!state.server.online || !state.ml.trained) return;
    fetch('/api/ml/model', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        classes: ML_CLASSES,
        features: ML_FEATURES,
        samples: state.ml.buffer.length,
        epochs: state.ml.epochs,
        accuracy: state.ml.accuracy,
        weights: { W: state.ml.W, b: state.ml.b }
      })
    }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (j && j.ok) log(t('log.mlServer', [j.id]), 'info', 'SYS');
    }).catch(function () {});
  }

  function maybeSyncModel() {
    if (state.tickCount && state.tickCount % 120 === 0) syncModel();
  }

  function cellKey(c, r) { return c + ',' + r; }

  function obstaclesSet() {
    const set = new Set();
    state.rover.obstacles.forEach(function (p) { set.add(cellKey(p[0], p[1])); });
    if (state.rover.blocked) GRID.wall.forEach(function (p) { set.add(cellKey(p[0], p[1])); });
    return set;
  }

  function bfs(start, goal, blocked) {
    const q = [start];
    const prev = new Map();
    const seen = new Set([cellKey(start.c, start.r)]);
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      const cur = q.shift();
      if (cur.c === goal.c && cur.r === goal.r) {
        const path = [];
        let node = cur;
        while (node) {
          path.push(node);
          node = prev.get(cellKey(node.c, node.r));
        }
        return path.reverse();
      }
      for (let i = 0; i < dirs.length; i++) {
        const nc = cur.c + dirs[i][0];
        const nr = cur.r + dirs[i][1];
        if (nc < 0 || nr < 0 || nc >= GRID.cols || nr >= GRID.rows) continue;
        const k = cellKey(nc, nr);
        if (seen.has(k) || blocked.has(k)) continue;
        seen.add(k);
        prev.set(k, cur);
        q.push({ c: nc, r: nr });
      }
    }
    return null;
  }

  function startRover(auto) {
    if (state.rover.status === 'running' || state.rover.status === 'route' || state.rover.status === 'auto') return;
    const path = bfs(GRID.base, GRID.astro, obstaclesSet());
    if (!path) {
      state.rover.status = 'noRoute';
      state.rover.route = [];
      state.rover.index = 0;
      state.rover.auto = Boolean(auto);
      log(t('log.pathNone'), 'warn', 'ROVER');
      renderRover();
      renderActive();
      save();
      return;
    }
    state.rover.route = path;
    state.rover.index = 0;
    state.rover.status = auto ? 'auto' : 'route';
    state.rover.running = true;
    state.rover.auto = Boolean(auto);
    log(t('log.pathCalc', [path.length, (path.length - 1) * GRID.cell, t('unit.dist')]), 'info', 'ROVER');
    renderRover();
    renderActive();
    save();
    if (roverTimer) clearInterval(roverTimer);
    roverTimer = setInterval(stepRover, ROVER_STEP_MS);
  }

  function stepRover() {
    if (state.rover.status !== 'route' && state.rover.status !== 'auto') {
      if (roverTimer) { clearInterval(roverTimer); roverTimer = null; }
      return;
    }
    state.rover.index++;
    if (state.rover.index >= state.rover.route.length - 1) {
      state.rover.index = state.rover.route.length - 1;
      state.rover.status = 'done';
      state.rover.running = false;
      if (roverTimer) { clearInterval(roverTimer); roverTimer = null; }
      log(t('log.rescueDone', [ASTRONAUT]), 'info', 'ROVER');
    }
    renderRover();
    save();
  }

  function stopRover() {
    if (roverTimer) { clearInterval(roverTimer); roverTimer = null; }
    state.rover.status = 'wait';
    state.rover.running = false;
    state.rover.route = [];
    state.rover.index = 0;
    log(t('log.roverStop'), 'warn', 'ROVER');
    renderRover();
    renderActive();
    save();
  }

  function toggleBlock() {
    state.rover.blocked = !state.rover.blocked;
    if (state.rover.blocked) {
      if (roverTimer) { clearInterval(roverTimer); roverTimer = null; }
      state.rover.status = 'wait';
      state.rover.route = [];
      state.rover.index = 0;
      log(t('log.blockSet'), 'warn', 'ROVER');
      log(t('log.blockTry'), 'info', 'ROVER');
    } else {
      log(t('log.blockClear'), 'info', 'ROVER');
      if (state.rover.status === 'noRoute') state.rover.status = 'wait';
    }
    renderStatic();
    renderRover();
    renderActive();
    save();
  }

  function roverPos() {
    if (!state.rover.route.length) return GRID.base;
    return state.rover.route[Math.min(state.rover.index, state.rover.route.length - 1)] || GRID.base;
  }

  function renderRover() {
    const pos = roverPos();
    const route = state.rover.route;
    const total = route.length ? (route.length - 1) * GRID.cell : 0;
    const done = route.length ? state.rover.index * GRID.cell : 0;
    const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
    const stateEl = $('roverState');
    const key = state.rover.status === 'auto' ? 'rstate.auto' : state.rover.status === 'route' ? 'rstate.route' : state.rover.status === 'done' ? 'rstate.done' : state.rover.status === 'noRoute' ? 'rstate.noRoute' : 'rstate.wait';
    if (stateEl) {
      stateEl.textContent = t(key);
      stateEl.className = 'pill ' + (state.rover.status === 'done' ? 'ok' : state.rover.status === 'noRoute' ? 'bad' : state.rover.status === 'wait' ? '' : 'mid');
    }
    const dist = $('roverDist');
    if (dist) {
      if (state.rover.status === 'noRoute') dist.textContent = '—';
      else if (route.length) dist.textContent = Math.max(0, total - done) + ' ' + t('unit.dist');
      else dist.textContent = '—';
    }
    const prog = $('roverProg');
    if (prog) prog.style.width = (state.rover.status === 'done' ? 100 : pct) + '%';
    const start = $('btnRoverStart');
    const stop = $('btnRoverStop');
    if (start) start.disabled = state.rover.status === 'route' || state.rover.status === 'auto' || state.rover.status === 'done';
    if (stop) stop.disabled = !(state.rover.status === 'route' || state.rover.status === 'auto');
    const rescue = $('ccRescue');
    if (rescue) {
      const rk = state.rover.status === 'done' ? 'rt.done' : state.rover.status === 'noRoute' ? 'rt.blocked' : state.rover.status === 'wait' ? 'rt.wait' : 'rt.running';
      rescue.textContent = t(rk);
      rescue.className = 'big-val ' + (state.rover.status === 'done' ? 'ok' : state.rover.status === 'noRoute' ? 'bad' : state.rover.status === 'wait' ? 'ok' : 'warn');
    }
    update3dGrid();
    updateRoverVisual(pos);
  }

  function update3dGrid() {
    if (state.mapMode !== '3d' || !window.setLunarGrid) return;
    const key = state.rover.route.map(function (p) { return p.c + ',' + p.r; }).join('|') + '#' + state.rover.blocked;
    if (state.mapRouteKey === key) return;
    state.mapRouteKey = key;
    try {
      window.setLunarGrid({
        cols: GRID.cols,
        rows: GRID.rows,
        obstacles: state.rover.obstacles.concat(state.rover.blocked ? GRID.wall : []),
        route: state.rover.route.map(function (p) { return [p.c, p.r]; }),
        base: [GRID.base.c, GRID.base.r],
        astro: [GRID.astro.c, GRID.astro.r]
      });
    } catch (e) {}
  }

  function mapCoord(c, r) {
    return {
      x: (c - (GRID.cols - 1) / 2) * 1.25,
      z: (r - (GRID.rows - 1) / 2) * 1.25
    };
  }

  function updateRoverVisual(pos) {
    if (window.moveRover) {
      try {
        const p = mapCoord(pos.c, pos.r);
        window.moveRover(p.x, p.z);
        const a = mapCoord(GRID.astro.c, GRID.astro.r);
        if (window.placeAstronaut) window.placeAstronaut(a.x, a.z);
      } catch (e) {}
    }
    if (state.mapMode === '2d') draw2d();
  }

  function ensureMap(force) {
    const host = $('lunarScene');
    if (!host) return;
    if (force) { map2d = null; map2dHost = null; }
    if (state.mapMode === '2d') { draw2d(); return; }
    if (state.mapReady && !force) { updateRoverVisual(roverPos()); return; }
    if (window.THREE && typeof window.initLunarScene === 'function') {
      try {
        window.initLunarScene();
        state.mapMode = '3d';
        state.mapReady = true;
        state.mapRouteKey = null;
        if (map2d) map2d.style.display = 'none';
        update3dGrid();
        updateRoverVisual(roverPos());
        return;
      } catch (e) {
        state.mapReady = false;
      }
    }
    state.mapMode = '2d';
    draw2d();
  }

  function draw2d() {
    const host = $('lunarScene');
    if (!host) return;
    if (!map2d || map2dHost !== host) {
      host.innerHTML = '';
      map2d = document.createElement('canvas');
      map2d.style.width = '100%';
      map2d.style.height = '100%';
      map2d.style.display = 'block';
      host.appendChild(map2d);
      map2dHost = host;
    } else {
      map2d.style.display = 'block';
    }
    const rect = host.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(280, Math.floor(rect.width || 700));
    const h = Math.max(240, Math.floor(rect.height || 400));
    if (map2d.width !== Math.floor(w * dpr) || map2d.height !== Math.floor(h * dpr)) {
      map2d.width = Math.floor(w * dpr);
      map2d.height = Math.floor(h * dpr);
    }
    const ctx = map2d.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050b16';
    ctx.fillRect(0, 0, w, h);
    const pad = 22;
    const cw = (w - pad * 2) / GRID.cols;
    const ch = (h - pad * 2) / GRID.rows;
    const cell = Math.min(cw, ch);
    const ox = (w - cell * GRID.cols) / 2;
    const oy = (h - cell * GRID.rows) / 2;
    ctx.strokeStyle = 'rgba(22,50,74,.8)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= GRID.cols; c++) {
      ctx.beginPath(); ctx.moveTo(ox + c * cell, oy); ctx.lineTo(ox + c * cell, oy + GRID.rows * cell); ctx.stroke();
    }
    for (let r = 0; r <= GRID.rows; r++) {
      ctx.beginPath(); ctx.moveTo(ox, oy + r * cell); ctx.lineTo(ox + GRID.cols * cell, oy + r * cell); ctx.stroke();
    }
    const blocked = obstaclesSet();
    blocked.forEach(function (k) {
      const p = k.split(',');
      const c = Number(p[0]), r = Number(p[1]);
      ctx.fillStyle = 'rgba(100,116,139,.55)';
      ctx.fillRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4);
      ctx.strokeStyle = 'rgba(148,163,184,.5)';
      ctx.strokeRect(ox + c * cell + 2, oy + r * cell + 2, cell - 4, cell - 4);
    });
    if (state.rover.route.length) {
      ctx.strokeStyle = 'rgba(34,211,238,.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      state.rover.route.forEach(function (p, i) {
        const x = ox + (p.c + 0.5) * cell;
        const y = oy + (p.r + 0.5) * cell;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }
    function marker(p, color, label) {
      const x = ox + (p.c + 0.5) * cell;
      const y = oy + (p.r + 0.5) * cell;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(4, cell * 0.26), 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.65)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(230,242,255,.9)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(label, x, y - cell * 0.42);
    }
    marker(GRID.astro, '#fbbf24', 'ASTR-02');
    marker(roverPos(), '#22d3ee', 'RX-1');
    ctx.fillStyle = 'rgba(125,144,171,.85)';
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LUNAR GRID 16×11 · 1 CELL = 40 u.n.', 12, h - 8);
  }

  function showTab(name) {
    $$('.nav-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
    $$('.tab').forEach(function (sec) {
      const on = sec.id === 'tab-' + name;
      sec.hidden = !on;
      sec.classList.toggle('active', on);
    });
    if (name === 'rover') setTimeout(function () { ensureMap(); draw2dIfNeeded(); }, 40);
    if (name === 'control') setTimeout(drawChart, 40);
    if (name === 'history') { renderHistory(); renderStats(); refreshHealth(); }
  }

  function draw2dIfNeeded() {
    if (state.mapMode === '2d') draw2d();
  }

  function buildReport() {
    const a = state.active;
    const m = state.metrics;
    const lines = [];
    lines.push(t('rep.title'));
    lines.push(t('rep.record', [new Date().toLocaleString(), 'SENTINEL RESCUE-X']));
    lines.push(t('rep.mission', [MISSION, ASTRONAUT, LOCATION]));
    lines.push(t('rep.comm', [t(state.commOk ? 'lab.linkOk' : 'lab.noLink')]));
    const suit = $('suitName');
    lines.push(t('rep.suit', [suit ? suit.textContent : '—']));
    lines.push(t('rep.ind', [formatIndicators(state.tel)]));
    lines.push('');
    if (a) {
      lines.push(t('rep.incActive', [a.label, t('sev.' + a.level), a.mt, fmtWall(a.wall)]));
      lines.push(t('rep.incTrigger', [a.trigger]));
      lines.push(t('rep.incChecks', [a.checks]));
      lines.push(t('rep.incUnc', [a.uncertainty]));
      lines.push(t('rep.incDeliv', [t(a.delivery === 'sent' ? 'deliv.sent' : a.delivery === 'resync' ? 'deliv.resync' : 'deliv.queued')]));
      if (state.ai) {
        lines.push(t('rep.ai', [state.ai.sourceLabel || state.ai.source, state.ai.score]));
        lines.push(state.ai.text);
      } else {
        lines.push(t('rep.aiPend'));
      }
    } else {
      lines.push(t('rep.incNone'));
      lines.push(t('rep.aiPend'));
    }
    lines.push('');
    lines.push(t('rep.rescue', [t('rt.' + (state.rover.status === 'done' ? 'done' : state.rover.status === 'noRoute' ? 'blocked' : state.rover.status === 'wait' ? 'wait' : 'running')), state.queue.filter(function (q) { return q.status !== 'sent'; }).length]));
    lines.push(t('rep.engine', [state.server.online ? (state.server.ai === 'openai' ? 'OpenAI' : t('rep.iaLocal')) : t('rep.iaLocal')]));
    if (state.ml.trained && state.ml.accuracy != null) lines.push(t('rep.engineML', [state.ml.accuracy.toFixed(1), state.ml.buffer.length, state.ml.epochs]));
    lines.push('');
    lines.push(t('rep.tests'));
    lines.push('· ' + t('mtr.scenarios') + ': ' + m.scenarios);
    lines.push('· ' + t('mtr.alerts') + ': ' + m.alerts);
    lines.push('· ' + t('mtr.correct') + ': ' + m.correct);
    lines.push('· ' + t('mtr.false') + ': ' + m.falseAlarms);
    lines.push('· ' + t('mtr.missed') + ': ' + m.missed);
    lines.push('· ' + t('mtr.avg') + ': ' + (m.latencies.length ? Math.round(m.latencies.reduce(function (x, y) { return x + y; }, 0) / m.latencies.length) + ' ms' : '—'));
    lines.push('');
    lines.push(t('rep.last', [Math.min(10, state.history.length)]));
    state.history.slice(-10).reverse().forEach(function (e) {
      lines.push('[' + e.mt + '] [' + e.cat + '] ' + e.msg);
    });
    lines.push('');
    lines.push(t('rep.disclaimer'));
    return lines.join('\n');
  }

  function generateReport() {
    const text = buildReport();
    const out = $('reportOutput');
    if (out) {
      out.hidden = false;
      out.textContent = text;
      out.scrollTop = 0;
    }
    log(t('log.report'), 'info', 'SYS');
    return text;
  }

  function exportReport() {
    const text = generateReport();
    const header = '==== ' + t('exp.h', [state.history.length]) + ' ====\n';
    const blob = new Blob(['\ufeff' + header + text + '\n\n' + state.history.map(function (e) {
      return '[' + e.mt + '] [' + e.sev + '] [' + e.cat + '] ' + e.msg + (e.status ? ' · ' + e.status : '');
    }).join('\n')], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = URL.createObjectURL(blob);
    a.download = 'sentinel-rescue-x-informe-' + stamp + '.txt';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function resetSimulation() {
    const extra = state.server.online ? t('confirm.dbExtra') : '';
    if (!window.confirm(t('confirm.reset', [extra]))) return;
    if (state.server.online) {
      fetch('/api/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }).catch(function () {});
    }
    const fresh = defaultState();
    fresh.createdAt = state.createdAt;
    fresh.missionStart = state.missionStart;
    fresh.sound = state.sound;
    fresh.ml = state.ml;
    fresh.server = state.server;
    fresh.nextEventId = 1;
    state = fresh;
    seedTelemetry();
    scenarioToken++;
    if (roverTimer) { clearInterval(roverTimer); roverTimer = null; }
    if (missedTimer) { clearTimeout(missedTimer); missedTimer = null; }
    try { localStorage.removeItem(LS_KEY); } catch (e) {}
    hideBanner();
    state.tel = Object.assign({}, BASE);
    log(t('boot.sys'), 'info', 'SYS');
    renderAll();
    renderConsole();
    drawChart();
    if (state.mapReady) ensureMap(true);
    save();
  }

  function refreshServer() {
    if (location.protocol === 'file:' || navigator.onLine === false) {
      state.server.online = false;
      renderStatic();
      renderStats();
      return;
    }
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, 2500) : null;
    const opts = controller ? { signal: controller.signal } : {};
    fetch('/api/health', opts).then(function (r) { return r.ok ? r.json() : null; }).then(function (h) {
      if (!h || !h.ok) throw new Error('sin servidor');
      const was = state.server.online;
      state.server.online = true;
      state.server.ai = h.ai ? h.ai.provider : 'local-heuristic';
      state.server.model = h.ai ? h.ai.model : '';
      state.server.dbEvents = h.db ? h.db.events : null;
      state.server.checked = Date.now();
      if (timer) clearTimeout(timer);
      if (!was) onServerOnline();
      renderStatic();
      renderStats();
    }).catch(function () {
      if (timer) clearTimeout(timer);
      const was = state.server.online;
      state.server.online = false;
      state.server.checked = Date.now();
      if (was) renderStatic();
      renderStatic();
      renderStats();
    });
  }

  function onServerOnline() {
    fetch('/api/events?limit=100').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.events)) return;
      const seen = new Set(state.history.map(function (e) { return e.mt + '|' + e.cat + '|' + e.msg; }));
      j.events.slice().reverse().forEach(function (e) {
        const k = e.mt + '|' + e.cat + '|' + e.msg;
        if (seen.has(k)) return;
        seen.add(k);
        state.history.push({
          id: state.nextEventId++,
          mt: e.mt, wall: e.wall, sev: e.sev || 'info', cat: e.cat || 'SYS',
          msg: e.msg || '', status: e.status || null, synced: true
        });
      });
      if (state.history.length > MAX_HISTORY) state.history = state.history.slice(-MAX_HISTORY);
      renderConsole();
      renderHistory();
      save();
    }).catch(function () {});
    if (state.server.ai !== 'openai') log(t('boot.server', [state.server.dbEvents == null ? '—' : state.server.dbEvents, t('ai.provider.local')]), 'info', 'SYS');
    else log(t('boot.server', [state.server.dbEvents == null ? '—' : state.server.dbEvents, t('ai.provider.openai')]), 'info', 'SYS');
    scheduleSync();
    if (!state.ml.trained) loadServerModel();
  }

  function loadServerModel() {
    fetch('/api/ml/model').then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.ok || !j.model || !j.model.weights) return;
      const w = j.model.weights;
      if (!Array.isArray(w.W) || !Array.isArray(w.b)) return;
      if (w.W.length !== ML_CLASSES.length || !w.W[0] || w.W[0].length !== ML_FEATURES) return;
      state.ml.W = w.W;
      state.ml.b = w.b;
      state.ml.epochs = j.model.epochs || state.ml.epochs;
      state.ml.accuracy = j.model.accuracy;
      state.ml.trained = true;
      renderMlMeta();
      updateMLPrediction();
      save();
    }).catch(function () {});
  }

  function renderAll() {
    renderStatic();
    renderClock();
    renderTelemetry();
    renderActive();
    renderComm();
    renderQueue();
    renderStats();
    renderHistory();
    renderMlMeta();
    renderMlPrediction(state.mlPrediction || predict(featuresOf(state.tel)));
    renderRover();
    draw2dIfNeeded();
    setVal('vSaved', 'local');
  }

  function registerPwa() {
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !window.Capacitor) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    let deferred = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferred = e;
      const btn = $('btnInstall');
      if (btn) btn.hidden = false;
    });
    const btn = $('btnInstall');
    if (btn) btn.addEventListener('click', function () {
      if (!deferred) return;
      deferred.prompt();
      deferred.userChoice.then(function () { deferred = null; btn.hidden = true; });
    });
    window.addEventListener('appinstalled', function () {
      log(t('log.installed'), 'info', 'SYS');
      const b = $('btnInstall');
      if (b) b.hidden = true;
    });
  }

  function bindEvents() {
    $$('.nav-tab').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.dataset.tab); });
    });
    $$('[data-scenario]').forEach(function (b) {
      b.addEventListener('click', function () { setScenario(b.dataset.scenario); });
    });
    $$('.filter').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.filter').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        renderHistory();
      });
    });
    const on = function (id, fn) { const el = $(id); if (el) el.addEventListener('click', fn); };
    on('alertAck', acknowledge);
    on('soundBtn', toggleSound);
    on('btnResetTop', resetSimulation);
    on('btnReset', resetSimulation);
    on('btnCommRestore', restoreComm);
    on('btnRoverStart', function () { startRover(false); });
    on('btnRoverStop', stopRover);
    on('btnBlockDemo', toggleBlock);
    on('btnToggle3D', function () {
      if (state.mapMode === '2d' && window.THREE && typeof window.initLunarScene === 'function') {
        state.mapMode = '3d';
        state.mapReady = false;
        ensureMap(true);
      } else if (state.mapMode === '3d') {
        state.mapMode = '2d';
        $$('#lunarScene canvas').forEach(function (c) { c.style.display = 'none'; });
        draw2d();
      } else {
        ensureMap(true);
      }
    });
    on('btnReport', generateReport);
    on('btnExport', exportReport);
    on('btnMlTrain', trainNow);
    on('btnMlGen', generateSamples);
    on('btnMlAuto', toggleMlAuto);
    window.addEventListener('resize', function () {
      drawChart();
      if (state.mapMode === '2d') draw2d();
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refreshHealth();
    });
    window.addEventListener('online', refreshServer);
    window.addEventListener('offline', function () {
      state.server.online = false;
      renderStatic();
      renderStats();
    });
    if (window.I18N) {
      try { window.I18N.wire(); } catch (e) {}
    }
  }

  function refreshHealth() {
    if (healthTimer) return;
    healthTimer = setTimeout(function () {
      healthTimer = null;
      refreshServer();
    }, 800);
  }

  function init() {
    state = loadState();
    seedTelemetry();
    bindEvents();
    ensureMlBuffer();
    initWeights();
    if (!state.ml.trained) trainMl(24);
    state.tickCount = 0;
    state.scenarioStartWall = performance.now();
    if (!state.telHistory.length) seedTelemetry();
    log(t('boot.sys'), 'info', 'SYS');
    showTab('control');
    renderAll();
    renderConsole();
    drawChart();
    refreshServer();
    setInterval(renderClock, 1000);
    setInterval(refreshServer, 15000);
    tickTimer = setInterval(function () {
      mainTick();
      checkEscalation();
    }, TICK_MS);
    registerPwa();
    setTimeout(function () { if (!$('tab-control').hidden) drawChart(); }, 200);
    window.SENTINEL = {
      refreshAfterLang: function () {
        renderAll();
        renderConsole();
        drawChart();
        if (state.mapMode === '2d') draw2d();
        if (map2d) draw2d();
      },
      state: function () { return state; },
      setScenario: setScenario
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

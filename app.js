(() => {
  'use strict';

  // ---------- 상수 ----------
  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }; // 표준 튜닝 E A D G B E
  const STRINGS = [1, 2, 3, 4, 5, 6];
  const NAMES = {
    letter: {
      sharp: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'],
      flat:  ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'],
    },
    solfege: {
      sharp: ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'],
      flat:  ['도', '레♭', '레', '미♭', '미', '파', '솔♭', '솔', '라♭', '라', '시♭', '시'],
    },
  };
  const NATURAL = new Set([0, 2, 4, 5, 7, 9, 11]);
  // 관용 표기: 실제 악보에서 흔히 쓰는 쪽 (예: A♯보다 B♭, D♭m보다 C♯m)
  const AUTO_ACC = {
    note:  { 1: 'sharp', 3: 'flat', 6: 'sharp', 8: 'flat', 10: 'flat' },
    major: { 1: 'flat', 3: 'flat', 6: 'sharp', 8: 'flat', 10: 'flat' },
    minor: { 1: 'sharp', 3: 'flat', 6: 'sharp', 8: 'sharp', 10: 'flat' },
  };
  const MINOR_TYPES = new Set(['min', 'min7', 'dim', 'm7b5']);
  const DRILLS = {
    note:  { label: '단음' },
    tones: { label: '코드 구성음' },
    strum: { label: '코드 스트럼' },
    change: { label: '코드 전환' },
    board: { label: '지판 찍기' },
    piano: { label: '건반 코드' },
    scale: { label: '스케일' },
    triad: { label: '트라이어드' },
    interval: { label: '음정 모양' },
    ear:   { label: '귀 훈련' },
    guide: { label: '코드 가이드' },
    jam:   { label: '잼 트랙' },
    drum:  { label: '드럼' },
    stats: { label: '연습 기록' },
  };
  // 위 줄: 분류, 아래 줄: 그 분류의 탭
  const GROUPS = [
    { id: 'guitar', label: '🎸 기타 연습', drills: ['note', 'tones', 'strum', 'change', 'board', 'scale', 'triad', 'interval'] },
    { id: 'theory', label: '🎹 이론·귀', drills: ['piano', 'ear', 'guide'] },
    { id: 'jam', label: '🎶 합주', drills: ['jam'] },
    { id: 'drum', label: '🥁 드럼', drills: ['drum'] },
    { id: 'stats', label: '📈 기록', drills: ['stats'] },
  ];
  const groupOf = (drill) => GROUPS.find((g) => g.drills.includes(drill)) || GROUPS[0];
  const MIC_FREE = new Set(['board', 'piano']); // 화면을 눌러서 답하는 모드
  const PIANO_LOW = 60;  // 건반 시작 (C4)
  const PIANO_KEYS = 24; // 두 옥타브

  const TICK_MS = 25;          // 검출 주기
  const STABLE_FRAMES = 4;     // 같은 음이 이 횟수만큼 연속 감지되면 확정 (약 0.1초)
  const SILENCE_FRAMES = 10;   // 이만큼 조용하면 "음이 끊겼다"고 판단 (약 0.25초)
  const STRUM_SETTLE = 8;      // 스트럼 직후 이전 소리가 분석 창에서 빠질 때까지 대기 (약 0.2초)
  const STRUM_STABLE = 5;      // 같은 코드 판정이 이 횟수만큼 이어지면 확정
  const STRUM_CONFIDENT = 0.8; // 오답으로 셀 만큼 확실하게 다른 코드로 들리는 기준
  const CORRECT_DELAY_MS = 800;
  const CHORD_DELAY_MS = 1800;
  const REVEAL_DELAY_MS = 1600;
  const STORAGE_KEY = 'fretmaster.v1';

  const DEFAULTS = {
    drill: 'note',
    mode: 'string',
    strings: [...STRINGS],
    fretMin: 0,
    fretMax: 12,
    naming: 'letter',
    accidental: 'auto',
    naturalOnly: false,
    chordTypes: ['maj', 'min'],
    chordSet: 'common',
    forms: ['open'],
    inOrder: false,
    weakFocus: true,
    sound: true,
    sensitivity: 60,
    pianoLabels: true,
    boardTask: 'note',
  };

  // ---------- 저장소 ----------
  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, stats })); } catch { /* 저장 불가 환경은 무시 */ }
  }

  const saved = load();
  const settings = { ...DEFAULTS, ...(saved.settings || {}) };
  // 관용 표기(auto)가 생기기 전 저장된 설정이면 기본값으로 옮김
  if (saved.settings && !saved.settings.forms) settings.accidental = 'auto';
  // 잠깐 있었던 '건반 · 지판' 통합 탭
  if (settings.drill === 'click') settings.drill = 'board';
  let stats = saved.stats || {}; // key -> { seen, clean, cleanMs }

  // ---------- 상태 ----------
  const session = { correct: 0, wrong: 0, streak: 0, cleanMs: 0, cleanCount: 0 };
  let phase = 'idle'; // idle | ask | result
  let question = null;
  let lastKey = null;
  let nextTimer = null;
  let guide = null;       // 코드 가이드 (guide.js)
  let scales = null;      // 스케일 연습 (scales.js)
  const PAGES = new Set(['guide', 'scale', 'ear', 'drum', 'triad', 'interval', 'jam', 'change', 'stats']); // 자체 화면을 가진 탭 (모듈 파일)
  const pages = {};       // 탭 id → 모듈
  let pianoChord = null;  // 가이드에서 건반에 보여줄 코드

  const audio = { ctx: null, stream: null, analyser: null, buf: null, chromaAnalyser: null, spectrum: null, chroma: new Float32Array(12), timer: 0 };
  const detector = { candidate: null, count: 0, silent: 0, ignored: null };
  const strum = { armed: true, settle: 0, candidate: null, count: 0, silent: 0, avg: 0 };

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    tabs: $('drill-tabs'),
    prompt: $('prompt'), promptString: $('prompt-string'), promptNote: $('prompt-note'), promptTones: $('prompt-tones'), status: $('status'),
    start: $('btn-start'), hint: $('btn-hint'), skip: $('btn-skip'), reset: $('btn-reset'),
    detNote: $('det-note'), needle: $('det-needle'), level: $('level-bar'), gate: $('level-gate'), chroma: $('chroma'),
    board: $('fretboard'), piano: $('piano'), pianoLabels: $('set-piano-labels'), boardTask: $('set-board-task'),
    stCorrect: $('st-correct'), stWrong: $('st-wrong'), stStreak: $('st-streak'), stAvg: $('st-avg'),
    mode: $('set-mode'), strings: $('set-strings'), fretMin: $('set-fret-min'), fretMax: $('set-fret-max'),
    naming: $('set-naming'), accidental: $('set-accidental'), natural: $('set-natural'),
    chordTypes: $('set-chords'), chordSet: $('set-chordset'), forms: $('set-forms'), inOrder: $('set-inorder'),
    weak: $('set-weak'), sound: $('set-sound'), sens: $('set-sens'), sensVal: $('sens-val'),
  };

  const isBoard = () => settings.drill === 'board';
  const isPiano = () => settings.drill === 'piano';
  const isChordDrill = () => (isBoard() ? settings.boardTask === 'chord' : settings.drill !== 'note');

  // ---------- 음 이름 ----------
  function noteName(pc, acc = defaultAccidental(pc)) {
    return NAMES[settings.naming][acc][pc];
  }
  function noteNameWithOctave(midi) {
    return noteName(midi % 12) + (Math.floor(midi / 12) - 1);
  }
  function defaultAccidental(pc) {
    if (settings.accidental === 'auto') return AUTO_ACC.note[pc] || 'sharp';
    return settings.accidental === 'flat' ? 'flat' : 'sharp';
  }
  function pickAccidental(pc, type, stable = false) {
    if (settings.accidental === 'mixed' && !stable) return Math.random() < 0.5 ? 'sharp' : 'flat';
    if (settings.accidental !== 'auto' && settings.accidental !== 'mixed') return settings.accidental;
    const table = !type ? AUTO_ACC.note : MINOR_TYPES.has(type) ? AUTO_ACC.minor : AUTO_ACC.major;
    return table[pc] || 'sharp';
  }
  function gateLevel() {
    // 감도 1~100 → RMS 임계값 (감도가 높을수록 작은 소리도 인식)
    const k = (100 - settings.sensitivity) / 100;
    return 0.002 + 0.05 * k * k;
  }

  // ---------- 문제 출제 ----------
  function buildPool() {
    return isChordDrill() ? buildChordPool() : buildNotePool();
  }

  function buildNotePool() {
    const pool = new Map();
    for (const s of settings.strings) {
      for (let f = settings.fretMin; f <= settings.fretMax; f++) {
        const midi = OPEN_MIDI[s] + f;
        const pc = midi % 12;
        if (settings.naturalOnly && !NATURAL.has(pc)) continue;
        const prefix = isBoard() ? 'board:' : '';
        const key = prefix + (settings.mode === 'string' ? `${s}:${pc}` : `*:${pc}`);
        if (!pool.has(key)) {
          pool.set(key, { key, pc, string: settings.mode === 'string' ? s : null, targets: [] });
        }
        pool.get(key).targets.push({ s, f, midi });
      }
    }
    return [...pool.values()];
  }

  function buildChordPool() {
    const pool = [];
    for (let pc = 0; pc < 12; pc++) {
      if (settings.naturalOnly && !NATURAL.has(pc)) continue;
      for (const type of settings.chordTypes) {
        if (settings.drill !== 'strum') {
          if (settings.chordSet === 'common' && !FretChords.shapeOf(pc, type)) continue;
          pool.push({ key: `${settings.drill}:${pc}:${type}`, rootPc: pc, type, form: null });
          continue;
        }
        for (const form of settings.forms) {
          const hasShape = !!FretChords.shapeOf(pc, type, form);
          if (form === 'open') {
            // 오픈 코드가 없는 코드는 '모든 근음'일 때만, 운지 지정 없이 출제
            if (hasShape) pool.push({ key: `strum:${pc}:${type}:open`, rootPc: pc, type, form });
            else if (settings.chordSet === 'all') pool.push({ key: `strum:${pc}:${type}`, rootPc: pc, type, form: null });
          } else if (hasShape) {
            // 바레 코드는 12키 모두 흔히 쓰므로 코드 범위와 상관없이 출제
            pool.push({ key: `strum:${pc}:${type}:${form}`, rootPc: pc, type, form });
          }
        }
      }
    }
    return pool;
  }

  function weightOf(key) {
    if (!settings.weakFocus) return 1;
    const st = stats[key];
    if (!st || !st.seen) return 3;                      // 아직 안 나온 문제 우선
    const missRate = 1 - st.clean / st.seen;
    const avgMs = st.clean ? st.cleanMs / st.clean : 6000;
    const base = isChordDrill() ? 4000 : 1500;          // 코드는 원래 오래 걸리므로 기준을 늦춤
    const slow = Math.min(3, Math.max(0, (avgMs - base) / base));
    return 1 + missRate * 4 + slow;
  }

  function pickWeighted(items) {
    const weights = items.map((it) => weightOf(it.key));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }

  function nextQuestion() {
    clearTimeout(nextTimer);
    const pool = buildPool();
    if (!pool.length) {
      question = null;
      phase = 'idle';
      const why = isChordDrill() ? '코드 종류나 운지 형태를 바꿔 보세요. (E폼 바레에는 sus2·dim·aug가 없어요)' : '줄/프렛 범위를 확인하세요.';
      showPrompt('', '–', `설정에 맞는 문제가 없어요. ${why}`);
      renderTones();
      renderBoard();
      return;
    }
    const candidates = pool.length > 1 ? pool.filter((p) => p.key !== lastKey) : pool;
    const item = pickWeighted(candidates);
    const acc = isChordDrill() ? pickAccidental(item.rootPc, item.type) : pickAccidental(item.pc);

    question = { ...item, acc, startedAt: performance.now(), mistakes: 0, hinted: false, wrong: new Set(), found: new Set(), marks: [] };
    lastKey = item.key;
    phase = 'ask';
    strum.armed = false; // 이전 문제의 소리가 울리는 중일 수 있으니 새로 칠 때까지 대기

    if (!isChordDrill()) {
      const how = !isBoard() ? '기타로 쳐보세요' : item.string ? '지판에서 찾아 눌러 보세요' : '지판에서 아무 줄이나 눌러 보세요';
      showPrompt(item.string ? `${item.string}번 줄` : '아무 줄에서나', noteName(item.pc, acc), how);
    } else {
      question.chord = FretChords.build(item.rootPc, item.type, acc, settings.naming);
      if (settings.drill === 'tones') {
        showPrompt(
          settings.inOrder ? '구성음을 순서대로 하나씩' : '구성음을 하나씩 (아무 순서로)',
          question.chord.name,
          '한 음씩 쳐보세요',
        );
      } else if (isBoard()) {
        showPrompt(
          settings.inOrder ? '지판에서 구성음을 순서대로' : '지판에서 구성음 찾기',
          question.chord.name,
          '구성음 자리를 지판에서 눌러 보세요',
        );
      } else if (isPiano()) {
        showPrompt(
          settings.inOrder ? '건반으로 구성음을 순서대로' : '건반으로 구성음 완성하기',
          question.chord.name,
          '건반을 눌러 보세요',
        );
      } else {
        const form = item.form ? FretChords.FORMS[item.form].label : '운지 자유';
        showPrompt(form, question.chord.name, '코드를 잡고 한 번에 스트럼 해보세요');
      }
    }
    renderTones();
    renderChromaLabels();
    renderChromaTargets();
    renderPiano();
    renderBoard();
  }

  function showPrompt(stringText, note, status, cls = '') {
    el.promptString.innerHTML = stringText || '&nbsp;';
    el.promptNote.textContent = note;
    setStatus(status, cls);
  }

  function setStatus(text, cls = '') {
    el.status.textContent = text;
    // 클래스를 뺐다 넣어야 흔들림 애니메이션이 매번 다시 재생됨
    el.prompt.className = 'prompt';
    void el.prompt.offsetWidth;
    if (cls) el.prompt.classList.add(cls);
  }

  // 코드 구성음 칸 (R · 3 · 5 …)
  function renderTones(revealAll = false) {
    if (!question?.chord || !isChordDrill()) {
      el.promptTones.innerHTML = '';
      return;
    }
    const show = revealAll || settings.drill !== 'strum';
    el.promptTones.innerHTML = !show ? '' : question.chord.tones.map((t, i) => {
      const found = question.found.has(i) || revealAll;
      return `<div class="tone${found ? ' found' : ''}${t.role === 'R' ? ' root' : ''}">` +
        `<small>${t.role}</small><b>${found ? t.name : '?'}</b></div>`;
    }).join('');
  }

  function recordResult(clean, ms) {
    const st = stats[question.key] || (stats[question.key] = { seen: 0, clean: 0, cleanMs: 0 });
    st.seen++;
    if (clean) { st.clean++; st.cleanMs += ms; }
    persist();
  }

  // ---------- 판정 공통 ----------
  function finishCorrect(statusText, marks, delay) {
    const ms = performance.now() - question.startedAt;
    const clean = question.mistakes === 0 && !question.hinted;
    recordResult(clean, ms);
    session.correct++;
    session.streak = clean ? session.streak + 1 : 0;
    if (clean) { session.cleanMs += ms; session.cleanCount++; }
    updateStats();

    phase = 'result';
    setStatus(`${statusText} · ${(ms / 1000).toFixed(1)}초`, 'correct');
    renderTones(true);
    renderPiano();
    renderBoard(marks);
    if (isPiano() || (isBoard() && isChordDrill())) playChord();
    else playChime();
    nextTimer = setTimeout(nextQuestion, delay);
  }

  // 같은 실수는 한 문제에 한 번만 센다
  function countMistake(id) {
    if (question.wrong.has(id)) return false;
    question.wrong.add(id);
    question.mistakes++;
    session.wrong++;
    session.streak = 0;
    updateStats();
    return true;
  }

  // ---------- 단음 판정 ----------
  function onStableNote(midi) {
    if (settings.drill === 'scale') { scales.onNote(midi); return; }
    if (settings.drill === 'guide') { guide.onNote(midi); return; }
    if (phase !== 'ask' || !question) return;
    if (settings.drill === 'note') judgeNote(midi);
    else if (settings.drill === 'tones') judgeTone(midi);
  }

  function judgeNote(midi) {
    const hits = question.targets.filter((t) => t.midi === midi);
    if (hits.length) {
      const where = hits.map((t) => `${t.s}번 줄 ${t.f}프렛`).join(', ');
      finishCorrect(`정답! ${where}`, question.targets.map((t) => ({ ...t, cls: t.midi === midi ? 'correct' : 'answer' })), CORRECT_DELAY_MS);
      return;
    }

    if (!countMistake(midi)) return;
    setStatus(`${noteNameWithOctave(midi)} — 다시 해보세요`, 'wrong');
    // 지정된 줄 위에서 친 음이라면 어디였는지 표시
    const marks = [];
    if (question.string) {
      const f = midi - OPEN_MIDI[question.string];
      if (f >= 0 && f <= boardFrets()) marks.push({ s: question.string, f, midi, cls: 'wrong' });
    }
    renderBoard(question.hinted ? marks.concat(hintMarks()) : marks);
  }

  // ---------- 코드 구성음 판정 ----------
  function judgeTone(midi, pos = null) {
    const { tones } = question.chord;
    const pc = midi % 12;
    const idx = tones.findIndex((t) => t.pc === pc);
    if (idx >= 0 && question.found.has(idx)) return; // 이미 찾은 음

    const expected = tones.findIndex((_, i) => !question.found.has(i));
    if (idx < 0) {
      if (countMistake(pc)) setStatus(`${noteNameWithOctave(midi)} — ${question.chord.name}의 구성음이 아니에요`, 'wrong');
      return;
    }
    if (settings.inOrder && idx !== expected) {
      if (countMistake(pc)) setStatus(`순서대로: 먼저 ${tones[expected].role}음을 찾으세요`, 'wrong');
      return;
    }

    question.found.add(idx);
    const tone = tones[idx];
    const where = pos ? [{ ...pos, midi }] : positionsOf(midi);
    question.marks.push(...where.map((p) => ({ ...p, label: tone.name, cls: tone.role === 'R' ? 'root' : 'tone' })));
    renderTones();

    if (question.found.size === tones.length) {
      finishCorrect(`완성! ${question.chord.name} = ${tones.map((t) => t.name).join(' · ')}`, answerMarks(), CHORD_DELAY_MS);
      return;
    }
    const left = tones.length - question.found.size;
    setStatus(`${tone.role}음 ${tone.name} ✓ — ${left}개 남음`);
    renderBoard(question.hinted ? hintMarks().concat(question.marks) : question.marks);
  }

  // 지판 위에서 이 음높이가 나는 자리 (선택한 줄만)
  function positionsOf(midi) {
    const out = [];
    for (const s of settings.strings) {
      const f = midi - OPEN_MIDI[s];
      if (f >= 0 && f <= boardFrets()) out.push({ s, f, midi });
    }
    return out;
  }

  // 연습 범위 안의 모든 구성음 자리
  function chordMarks(hint = false) {
    return rangeMarks(question.chord, hint);
  }

  function rangeMarks(chord, hint = false) {
    const marks = [];
    for (const s of settings.strings) {
      for (let f = settings.fretMin; f <= settings.fretMax; f++) {
        const midi = OPEN_MIDI[s] + f;
        const tone = chord.tones.find((t) => t.pc === midi % 12);
        if (!tone) continue;
        const cls = tone.role === 'R' ? 'root' : hint ? 'hint' : 'tone';
        marks.push({ s, f, midi, label: tone.name, cls });
      }
    }
    return marks;
  }

  // 스트럼 모드는 대표 운지 모양으로, 그 외에는 범위 안 구성음 전체로 보여줌
  function answerMarks(hint = false) {
    const shape = settings.drill === 'strum' && question.form && FretChords.shapeOf(question.rootPc, question.type, question.form);
    if (!shape) return chordMarks(hint);
    return shapeMarks(question.chord, shape, question.form, hint);
  }

  function shapeMarks(chord, shape, form, hint = false) {
    const marks = [];
    // 바레: 가장 낮은 프렛을 두 줄 이상 같이 누르면 막대로 표시
    const lowest = Math.min(...shape.filter((p) => p.f).map((p) => p.f));
    const barred = shape.filter((p) => p.f === lowest).map((p) => p.s);
    if (form !== 'open' && barred.length >= 2) {
      marks.push({ cls: 'barre', f: lowest, s1: Math.min(...barred), s2: Math.max(...barred) });
    }
    return marks.concat(shape.map(({ s, f }) => {
      if (f === null) return { s, f: 0, label: '×', cls: 'muted' };
      const midi = OPEN_MIDI[s] + f;
      const tone = chord.tones.find((t) => t.pc === midi % 12);
      return { s, f, midi, label: tone.name, cls: tone.role === 'R' ? 'root' : hint ? 'hint' : 'tone' };
    }));
  }

  // 바레 코드면 "(6번 줄 8프렛)" 같은 위치 설명
  function formWhere() {
    if (!question.form || question.form === 'open') return '';
    return ` (${FretChords.FORMS[question.form].string}번 줄 ${FretChords.rootFret(question.rootPc, question.form)}프렛)`;
  }

  // ---------- 코드 스트럼 판정 ----------
  function feedStrum(level) {
    const gate = gateLevel();
    const prevAvg = strum.avg;
    strum.avg = strum.avg * 0.7 + level * 0.3;

    if (level <= gate) {
      strum.silent++;
      strum.candidate = null;
      strum.count = 0;
      if (strum.silent >= SILENCE_FRAMES) arm();
      return;
    }
    strum.silent = 0;

    // 소리가 갑자기 커지면 새로 친 것으로 봄
    if (level > prevAvg * 1.8 && level > gate * 2) arm();
    if (!strum.armed || phase !== 'ask' || !question) return;
    if (strum.settle > 0) { strum.settle--; return; }

    const { chroma } = audio;
    let candidate = null;
    if (FretChords.matches(chroma, question.rootPc, question.type)) {
      candidate = 'OK';
    } else {
      const b = FretChords.best(chroma);
      if (b.score >= STRUM_CONFIDENT) candidate = `${b.rootPc}:${b.type}`;
    }

    if (candidate !== strum.candidate) {
      strum.candidate = candidate;
      strum.count = 1;
      return;
    }
    if (candidate === null || ++strum.count !== STRUM_STABLE) return;

    strum.armed = false;
    if (candidate === 'OK') {
      finishCorrect(`정답! ${question.chord.name}${formWhere()} = ${question.chord.tones.map((t) => t.name).join(' · ')}`, answerMarks(), CHORD_DELAY_MS);
      return;
    }
    if (countMistake(candidate)) {
      const [r, t] = candidate.split(':');
      setStatus(`들린 코드: ${FretChords.build(+r, t, question.acc, settings.naming).name} — 다시 쳐보세요`, 'wrong');
    }
  }

  function arm() {
    strum.armed = true;
    strum.settle = strum.silent >= SILENCE_FRAMES ? 0 : STRUM_SETTLE;
    strum.candidate = null;
    strum.count = 0;
  }

  // ---------- 힌트 / 건너뛰기 ----------
  function hintMarks() {
    if (isChordDrill()) return answerMarks(true);
    return question.targets.map((t) => ({ ...t, cls: 'hint' }));
  }

  function giveHint() {
    if (phase !== 'ask' || !question) return;
    question.hinted = true;
    setStatus(isPiano() ? '파란 테두리 건반이 구성음이에요' : isBoard() && !isChordDrill() ? '파란 점 자리를 눌러 보세요' : isChordDrill() ? '지판에 구성음 위치를 표시했어요 (주황 = 근음)' : '파란 점 위치를 쳐보세요', 'reveal');
    if (settings.drill === 'strum') renderTones(true);
    renderChromaTargets();
    renderPiano();
    renderBoard(settings.drill === 'strum' ? hintMarks() : hintMarks().concat(question.marks));
  }

  function skip() {
    if (phase !== 'ask' || !question) return;
    recordResult(false, 0);
    session.wrong++;
    session.streak = 0;
    updateStats();
    phase = 'result';
    if (isChordDrill()) {
      setStatus(`${question.chord.name} = ${question.chord.tones.map((t) => t.name).join(' · ')}`, 'reveal');
      renderTones(true);
      renderPiano();
      renderBoard(answerMarks(true));
    } else {
      const where = question.targets.map((t) => `${t.s}번 줄 ${t.f}프렛`).join(', ');
      setStatus(`정답 위치: ${where}`, 'reveal');
      renderBoard(question.targets.map((t) => ({ ...t, cls: 'hint' })));
    }
    nextTimer = setTimeout(nextQuestion, isChordDrill() ? CHORD_DELAY_MS + 600 : REVEAL_DELAY_MS);
  }

  // 귀 훈련처럼 자체 문제를 내는 탭의 결과를 위쪽 점수에 반영
  function scoreExternal(ok, clean = false, ms = 0) {
    if (ok) {
      session.correct++;
      session.streak = clean ? session.streak + 1 : 0;
      if (clean) { session.cleanMs += ms; session.cleanCount++; }
    } else {
      session.wrong++;
      session.streak = 0;
    }
    updateStats();
  }

  // 스케일·가이드톤 연습에서 쓰는 마이크
  async function micStart() {
    if (!audio.ctx) await startAudio();
    document.body.classList.add('listening');
  }
  function micStop() {
    document.body.classList.remove('listening');
    if (!audio.ctx) return;
    stopAudio();
    el.level.style.width = '0';
    el.detNote.textContent = '–';
    el.needle.style.opacity = 0;
  }

  let loggedCorrect = 0;
  let loggedWrong = 0;
  function updateStats() {
    if (session.correct > loggedCorrect) FretLog.answer(true, session.correct - loggedCorrect);
    if (session.wrong > loggedWrong) FretLog.answer(false, session.wrong - loggedWrong);
    loggedCorrect = session.correct;
    loggedWrong = session.wrong;
    el.stCorrect.textContent = session.correct;
    el.stWrong.textContent = session.wrong;
    el.stStreak.textContent = session.streak;
    el.stAvg.textContent = session.cleanCount ? (session.cleanMs / session.cleanCount / 1000).toFixed(1) + '초' : '–';
  }

  // ---------- 오디오 ----------
  async function startAudio() {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('이 브라우저는 마이크 입력을 지원하지 않아요.');
    }
    // 클릭 직후(사용자 제스처 안)에 만들어야 자동재생 정책에 막히지 않음
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (err) {
      ctx.close();
      throw err;
    }
    if (ctx.state === 'suspended') await ctx.resume();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);

    // 코드 인식용: 저음까지 음 하나하나를 구분하려면 주파수 해상도가 높아야 함
    const chromaAnalyser = ctx.createAnalyser();
    chromaAnalyser.fftSize = 16384;
    chromaAnalyser.smoothingTimeConstant = 0.5;
    source.connect(chromaAnalyser);

    Object.assign(audio, {
      ctx, stream, analyser, chromaAnalyser,
      buf: new Float32Array(analyser.fftSize),
      spectrum: new Float32Array(chromaAnalyser.frequencyBinCount),
    });
    // rAF는 창이 가려지면 멈추거나 느려지므로 고정 간격 타이머 사용
    audio.timer = setInterval(tick, TICK_MS);
  }

  function stopAudio() {
    clearInterval(audio.timer);
    audio.stream?.getTracks().forEach((t) => t.stop());
    audio.ctx?.close();
    Object.assign(audio, { ctx: null, stream: null, analyser: null, buf: null, chromaAnalyser: null, spectrum: null, timer: 0 });
  }

  function tick() {
    const { analyser, buf, ctx } = audio;
    if (!analyser || MIC_FREE.has(settings.drill) || settings.drill === 'guide') return;
    analyser.getFloatTimeDomainData(buf);
    const level = FretPitch.rms(buf);
    const loud = level > gateLevel();

    if (settings.drill === 'change') {
      if (loud) {
        audio.chromaAnalyser.getFloatFrequencyData(audio.spectrum);
        FretPitch.chroma(audio.spectrum, ctx.sampleRate, audio.chromaAnalyser.fftSize, audio.chroma);
        lastActive = Date.now();
      } else {
        audio.chroma.fill(0);
      }
      updateLevel(level);
      updateChroma(loud);
      pages.change.onFrame(level, audio.chroma, loud, gateLevel());
      return;
    }
    if (loud) lastActive = Date.now();

    if (settings.drill === 'strum') {
      if (loud) {
        audio.chromaAnalyser.getFloatFrequencyData(audio.spectrum);
        FretPitch.chroma(audio.spectrum, ctx.sampleRate, audio.chromaAnalyser.fftSize, audio.chroma);
      } else {
        audio.chroma.fill(0);
      }
      updateLevel(level);
      updateChroma(loud);
      feedStrum(level);
      return;
    }

    let midi = null;
    let cents = 0;
    if (loud) {
      const r = FretPitch.detect(buf, ctx.sampleRate);
      if (r) {
        const m = FretPitch.freqToMidi(r.freq);
        midi = Math.round(m);
        cents = Math.round((m - midi) * 100);
      }
    }
    updateLevel(level);
    updateTuner(level, midi, cents);
    feedDetector(midi);
  }

  function feedDetector(midi) {
    if (midi === null) {
      detector.silent++;
      if (detector.silent >= SILENCE_FRAMES) {
        detector.ignored = null; // 음이 끊겼으니 같은 음을 다시 쳐도 인정
        detector.candidate = null;
        detector.count = 0;
      }
      return;
    }
    detector.silent = 0;

    if (midi === detector.candidate) {
      detector.count++;
    } else {
      detector.candidate = midi;
      detector.count = 1;
    }

    if (detector.count === STABLE_FRAMES) {
      if (midi === detector.ignored) return;  // 앞 문제에서 울리던 음은 무시
      detector.ignored = midi;
      onStableNote(midi);
    }
  }

  function updateLevel(level) {
    const scale = (v) => Math.min(100, (Math.sqrt(v) / Math.sqrt(0.3)) * 100);
    el.level.style.width = scale(level) + '%';
    el.gate.style.left = scale(gateLevel()) + '%';
  }

  function updateTuner(level, midi, cents) {
    if (midi === null) {
      el.needle.style.opacity = 0;
      if (level <= gateLevel()) el.detNote.textContent = '–';
      return;
    }
    el.detNote.textContent = noteNameWithOctave(midi);
    el.needle.style.opacity = 1;
    el.needle.style.left = 50 + cents + '%';
    el.needle.style.background = Math.abs(cents) <= 10 ? 'var(--good)' : 'var(--accent)';
  }

  // ---------- 크로마 막대 (스트럼 모드) ----------
  function initChroma() {
    el.chroma.innerHTML = Array.from({ length: 12 }, (_, pc) =>
      `<div class="cbar" data-pc="${pc}"><div class="cfill"></div><small></small></div>`).join('');
    renderChromaLabels();
  }

  function renderChromaLabels() {
    // 코드 구성음은 코드 철자 그대로 (예: Gm7이면 A♯이 아니라 B♭)
    const tones = question?.chord?.tones || [];
    el.chroma.querySelectorAll('.cbar small').forEach((s, pc) => {
      s.textContent = tones.find((t) => t.pc === pc)?.name ?? noteName(pc);
    });
  }

  function renderChromaTargets() {
    const show = question?.chord && (question.hinted || phase === 'result');
    const pcs = show ? new Set(question.chord.tones.map((t) => t.pc)) : new Set();
    el.chroma.querySelectorAll('.cbar').forEach((b, pc) => b.classList.toggle('target', pcs.has(pc)));
  }

  function updateChroma(loud) {
    const fills = el.chroma.querySelectorAll('.cfill');
    fills.forEach((f, pc) => { f.style.height = audio.chroma[pc] * 100 + '%'; });
    if (!loud) { el.detNote.textContent = '–'; return; }
    const b = FretChords.best(audio.chroma);
    el.detNote.textContent = b.score >= STRUM_CONFIDENT
      ? FretChords.build(b.rootPc, b.type, question?.acc || 'sharp', settings.naming).name
      : '?';
  }

  // ---------- 지판 찍기 ----------
  function onBoardClick(s, f) {
    const midi = OPEN_MIDI[s] + f;
    playTone(midi, 0, 1.6, 0.2);
    if (PAGES.has(settings.drill)) { pages[settings.drill].onClick(s, f, midi); return; }
    if (!isBoard() || phase !== 'ask' || !question) return;
    if (isChordDrill()) boardChord(s, f, midi);
    else boardNote(s, f, midi);
  }

  function boardNote(s, f, midi) {
    const pcOk = midi % 12 === question.pc;
    const stringOk = !question.string || question.string === s;
    if (pcOk && stringOk) {
      const marks = question.marks.concat({ s, f, midi, cls: 'correct' });
      finishCorrect(`정답! ${s}번 줄 ${f}프렛`, marks, CORRECT_DELAY_MS);
      return;
    }
    countMistake(`${s}:${f}`);
    const why = pcOk ? ` — ${question.string}번 줄에서 찾아보세요` : ' — 다시 해보세요';
    setStatus(`${s}번 줄 ${f}프렛은 ${noteName(midi % 12, question.acc)}${why}`, 'wrong');
    question.marks.push({ s, f, midi, cls: 'wrong' });
    renderBoard(question.hinted ? question.marks.concat(hintMarks()) : question.marks);
  }

  function flashWrong(key) {
    key.classList.remove('wrong');
    void key.offsetWidth;
    key.classList.add('wrong');
  }

  function boardChord(s, f, midi) {
    const { tones } = question.chord;
    const idx = tones.findIndex((t) => t.pc === midi % 12);
    const already = idx >= 0 && question.found.has(idx);
    if (already) {
      // 이미 찾은 음을 다른 자리에서 또 눌렀으면 그 자리도 표시만
      if (!question.marks.some((m) => m.s === s && m.f === f)) {
        question.marks.push({ s, f, midi, label: tones[idx].name, cls: tones[idx].role === 'R' ? 'root' : 'tone' });
      }
    } else {
      judgeTone(midi, { s, f });
      if (phase !== 'ask') return; // 완성
    }
    const marks = question.hinted ? hintMarks().concat(question.marks) : question.marks.slice();
    if (idx < 0 || (settings.inOrder && !question.found.has(idx))) marks.push({ s, f, midi, cls: 'wrong' });
    renderBoard(marks);
  }

  // ---------- 피아노 ----------
  const BLACK = new Set([1, 3, 6, 8, 10]);

  function initPiano() {
    const whites = [];
    const blacks = [];
    let w = 0;
    const whiteCount = [...Array(PIANO_KEYS).keys()].filter((i) => !BLACK.has((PIANO_LOW + i) % 12)).length;
    for (let i = 0; i < PIANO_KEYS; i++) {
      const midi = PIANO_LOW + i;
      if (BLACK.has(midi % 12)) {
        const left = (w / whiteCount) * 100;
        blacks.push(`<button type="button" class="key black" data-midi="${midi}" style="left:calc(${left}% - var(--bw) / 2)"><span></span></button>`);
      } else {
        whites.push(`<button type="button" class="key white" data-midi="${midi}"><span></span></button>`);
        w++;
      }
    }
    el.piano.innerHTML = whites.join('') + blacks.join('');
    el.piano.style.setProperty('--whites', whiteCount);
    el.piano.addEventListener('pointerdown', (e) => {
      const key = e.target.closest('.key');
      if (!key) return;
      e.preventDefault();
      onPianoKey(+key.dataset.midi, key);
    });
  }

  function onPianoKey(midi, key) {
    playTone(midi);
    if (!isPiano() || phase !== 'ask' || !question) return;
    const before = question.mistakes;
    const isTone = question.chord.tones.some((t) => t.pc === midi % 12);
    judgeTone(midi);
    renderPiano();
    // 틀린 건반은 잠깐 빨갛게
    if (!isTone || question.mistakes > before) flashWrong(key);
  }

  function renderPiano() {
    if (!el.piano.childElementCount) return;
    const isGuide = settings.drill === 'guide';
    const chord = isGuide ? pianoChord : isPiano() ? question?.chord : null;
    const found = new Set();
    const hint = new Set();
    const names = new Map();
    if (isGuide && chord) chord.tones.forEach((t) => { found.add(t.pc); names.set(t.pc, t.name); });
    if (chord && !isGuide) {
      chord.tones.forEach((t, i) => {
        const revealed = question.found.has(i) || phase === 'result';
        if (revealed) found.add(t.pc);
        else if (question.hinted) hint.add(t.pc);
        if (revealed) names.set(t.pc, t.name);
      });
    }
    el.piano.querySelectorAll('.key').forEach((k) => {
      const pc = +k.dataset.midi % 12;
      k.classList.toggle('found', found.has(pc));
      k.classList.toggle('root', !!chord && found.has(pc) && pc === chord.rootPc);
      k.classList.toggle('hint', hint.has(pc));
      const label = names.get(pc)
        ?? (!settings.pianoLabels ? ''
          : BLACK.has(pc) ? `${noteName(pc, 'sharp')}<br>${noteName(pc, 'flat')}` : noteName(pc));
      k.firstElementChild.innerHTML = label;
    });
  }

  // 마이크용 컨텍스트와 별개인 출력 전용 오디오 (피아노는 마이크 없이 동작)
  function outCtx() {
    if (!audio.out) audio.out = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.out.state === 'suspended') audio.out.resume();
    return audio.out;
  }

  function playTone(midi, when = 0, dur = 1.4, vol = 0.22) {
    const ctx = outCtx();
    const t = ctx.currentTime + when;
    const f = 440 * 2 ** ((midi - 69) / 12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(ctx.destination);
    // 삼각파 + 배음 약간으로 건반 느낌
    [[1, 'triangle', 1], [2, 'sine', 0.25], [3, 'sine', 0.08]].forEach(([h, type, amp]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = f * h;
      g.gain.value = amp;
      o.connect(g).connect(env);
      o.start(t);
      o.stop(t + dur);
    });
  }

  // 정답이면 코드를 펼쳐서 한 번, 같이 한 번
  function playChord() {
    if (!settings.sound) return;
    const { rootPc, type } = question;
    const midis = FretChords.TYPES[type].tones.map(([semi]) => 48 + rootPc + semi);
    midis.forEach((m, i) => playTone(m, i * 0.12, 1.2, 0.16));
    const t = midis.length * 0.12 + 0.1;
    midis.forEach((m) => playTone(m, t, 1.8, 0.12));
  }

  // 정답 효과음: 검출 범위(1400Hz)보다 높은 음이라 마이크에 다시 잡혀도 오답 처리되지 않음
  function playChime() {
    if (!settings.sound) return;
    const ctx = audio.ctx || outCtx();
    const t0 = ctx.currentTime;
    [1760, 2349].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = t0 + i * 0.08;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  // ---------- 지판 그리기 ----------
  const FB = { left: 54, top: 24, fretW: 56, gap: 26 };
  const boardFrets = () => Math.max(12, settings.fretMax);
  const fx = (f) => (f === 0 ? FB.left - 22 : FB.left + (f - 0.5) * FB.fretW);
  const sy = (s) => FB.top + (s - 1) * FB.gap;

  // 휴대폰 세로 화면에서는 지판을 세로로 (코드 다이어그램처럼 6번 줄이 왼쪽, 위가 0프렛)
  const FV = { top: 50, left: 44, gap: 46, fretH: 50 };
  const verticalQuery = window.matchMedia('(max-width: 640px) and (orientation: portrait)');
  let lastMarks = [];
  verticalQuery.addEventListener('change', () => renderBoard(lastMarks));

  function renderBoard(marks = []) {
    lastMarks = marks;
    const vertical = verticalQuery.matches;
    const n = Math.max(boardFrets(), ...marks.map((m) => m.f ?? 0));
    const parts = [];
    let width, height;
    // 줄 s, 프렛 f의 좌표
    const pos = vertical
      ? (st, f) => ({ x: FV.left + (6 - st) * FV.gap, y: f === 0 ? FV.top - 24 : FV.top + (f - 0.5) * FV.fretH })
      : (st, f) => ({ x: fx(f), y: sy(st) });
    const activeString = phase !== 'idle' && question?.string;

    if (vertical) {
      const x0 = FV.left - 16, x1 = FV.left + 5 * FV.gap + 16;
      width = x1 + 14;
      height = FV.top + n * FV.fretH + 14;
      parts.push(`<rect class="fb-board" x="${x0}" y="${FV.top}" width="${x1 - x0}" height="${n * FV.fretH}" rx="3"/>`);
      for (let f = 1; f <= n; f++) {
        const y = FV.top + (f - 0.5) * FV.fretH;
        if (f % 12 === 0) {
          parts.push(`<circle class="fb-inlay" cx="${FV.left + 1.5 * FV.gap}" cy="${y}" r="6"/><circle class="fb-inlay" cx="${FV.left + 3.5 * FV.gap}" cy="${y}" r="6"/>`);
        } else if ([3, 5, 7, 9].includes(f % 12)) {
          parts.push(`<circle class="fb-inlay" cx="${FV.left + 2.5 * FV.gap}" cy="${y}" r="6"/>`);
        }
        if (f < settings.fretMin || f > settings.fretMax) {
          parts.push(`<rect class="fb-out" x="${x0}" y="${FV.top + (f - 1) * FV.fretH}" width="${x1 - x0}" height="${FV.fretH}"/>`);
        }
        parts.push(`<line class="fb-fret" x1="${x0}" y1="${FV.top + f * FV.fretH}" x2="${x1}" y2="${FV.top + f * FV.fretH}"/>`);
      }
      parts.push(`<rect class="fb-nut" x="${x0}" y="${FV.top - 4}" width="${x1 - x0}" height="6"/>`);
      for (const st of STRINGS) {
        const x = pos(st, 0).x;
        const active = st === activeString ? ' active' : '';
        const dim = settings.strings.includes(st) ? '' : ' style="opacity:.3"';
        parts.push(`<line class="fb-string${active}" x1="${x}" y1="${FV.top - 40}" x2="${x}" y2="${height - 10}" stroke-width="${1 + (st - 1) * 0.45}"${dim}/>`);
        parts.push(`<text class="fb-label${active}" x="${x}" y="10">${st}</text>`);
      }
      for (let f = 0; f <= n; f++) parts.push(`<text class="fb-num" x="16" y="${pos(1, f).y + 4}">${f}</text>`);
    } else {
      width = FB.left + n * FB.fretW + 12;
      const bottom = sy(6);
      height = bottom + 40;
      const midY = (sy(1) + bottom) / 2;
      parts.push(`<rect class="fb-board" x="${FB.left}" y="${FB.top - 12}" width="${n * FB.fretW}" height="${bottom - FB.top + 24}" rx="3"/>`);
      for (let f = 1; f <= n; f++) {
        const x = fx(f);
        if (f % 12 === 0) {
          parts.push(`<circle class="fb-inlay" cx="${x}" cy="${sy(2) + FB.gap / 2}" r="6"/>`);
          parts.push(`<circle class="fb-inlay" cx="${x}" cy="${sy(4) + FB.gap / 2}" r="6"/>`);
        } else if ([3, 5, 7, 9].includes(f % 12)) {
          parts.push(`<circle class="fb-inlay" cx="${x}" cy="${midY}" r="6"/>`);
        }
      }
      // 연습 범위 밖 프렛은 어둡게
      for (let f = 1; f <= n; f++) {
        if (f < settings.fretMin || f > settings.fretMax) {
          parts.push(`<rect class="fb-out" x="${FB.left + (f - 1) * FB.fretW}" y="${FB.top - 12}" width="${FB.fretW}" height="${bottom - FB.top + 24}"/>`);
        }
      }
      for (let f = 1; f <= n; f++) {
        const x = FB.left + f * FB.fretW;
        parts.push(`<line class="fb-fret" x1="${x}" y1="${FB.top - 12}" x2="${x}" y2="${bottom + 12}"/>`);
      }
      parts.push(`<rect class="fb-nut" x="${FB.left - 4}" y="${FB.top - 12}" width="6" height="${bottom - FB.top + 24}"/>`);
      for (const st of STRINGS) {
        const y = sy(st);
        const active = st === activeString ? ' active' : '';
        const dim = settings.strings.includes(st) ? '' : ' style="opacity:.3"';
        parts.push(`<line class="fb-string${active}" x1="${FB.left - 36}" y1="${y}" x2="${width - 12}" y2="${y}" stroke-width="${1 + (st - 1) * 0.45}"${dim}/>`);
        parts.push(`<text class="fb-label${active}" x="10" y="${y}">${st}</text>`);
      }
      for (let f = 0; f <= n; f++) parts.push(`<text class="fb-num" x="${fx(f)}" y="${bottom + 30}">${f}</text>`);
    }

    const r = vertical ? 13 : 11;
    for (const m of marks) {
      if (m.cls === 'spacer') continue; // 지판 길이만 늘리는 표시
      if (m.cls === 'barre') {
        const a = pos(m.s1, m.f), b = pos(m.s2, m.f);
        const x = Math.min(a.x, b.x) - 9, y = Math.min(a.y, b.y) - 9;
        parts.push(`<rect class="fb-barre" x="${x}" y="${y}" width="${Math.abs(a.x - b.x) + 18}" height="${Math.abs(a.y - b.y) + 18}" rx="9"/>`);
        continue;
      }
      const { x, y } = pos(m.s, m.f);
      const label = m.label ?? noteName(m.midi % 12, question?.acc === 'flat' ? 'flat' : 'sharp');
      const fill = m.color ? ` style="fill:${m.color}"` : '';
      const title = m.title ? `<title>${m.title}</title>` : '';
      parts.push(
        `<g class="fb-mark ${m.cls}${m.still ? '' : ' pop'}">${title}<circle cx="${x}" cy="${y}" r="${r}"${fill}/>` +
        `<text x="${x}" y="${y}"${m.textColor ? ` style="fill:${m.textColor}"` : ''}>${label}</text></g>`,
      );
    }

    // 지판을 눌러 답하는 탭: 칸마다 투명한 클릭 영역
    if (isBoard() || PAGES.has(settings.drill)) {
      for (const st of STRINGS) {
        for (let f = 0; f <= n; f++) {
          let x, y, w, h;
          if (vertical) {
            x = pos(st, 0).x - FV.gap / 2; w = FV.gap;
            y = f === 0 ? FV.top - 44 : FV.top + (f - 1) * FV.fretH; h = f === 0 ? 42 : FV.fretH;
          } else {
            x = f === 0 ? FB.left - 44 : FB.left + (f - 1) * FB.fretW; w = f === 0 ? 40 : FB.fretW;
            y = sy(st) - FB.gap / 2; h = FB.gap;
          }
          parts.push(`<rect class="fb-hit" data-s="${st}" data-f="${f}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
        }
      }
    }

    el.board.innerHTML = `<svg class="${vertical ? 'vertical' : 'horizontal'}" viewBox="0 0 ${width} ${height}" role="img" aria-label="기타 지판">${parts.join('')}</svg>`;
  }

  // ---------- 모드 탭 ----------
  function renderTabs() {
    const group = groupOf(settings.drill);
    el.tabs.innerHTML =
      `<div class="tab-groups">${GROUPS.map((g) =>
        `<button type="button" data-group="${g.id}" class="${g === group ? 'on' : ''}">${g.label}</button>`).join('')}</div>` +
      (group.drills.length > 1
        ? `<div class="tab-drills" role="tablist">${group.drills.map((id) =>
          `<button type="button" data-drill="${id}" role="tab" class="${id === settings.drill ? 'on' : ''}" aria-selected="${id === settings.drill}">${DRILLS[id].label}</button>`).join('')}</div>`
        : '');
  }

  function initTabs() {
    renderTabs();
    el.tabs.addEventListener('click', (e) => {
      const groupBtn = e.target.closest('button[data-group]');
      if (groupBtn) {
        // 분류를 바꾸면 그 분류에서 마지막으로 쓴 탭으로
        const g = GROUPS.find((x) => x.id === groupBtn.dataset.group);
        const last = settings.lastDrill?.[g.id];
        switchDrill(g.drills.includes(last) ? last : g.drills[0]);
        return;
      }
      const btn = e.target.closest('button[data-drill]');
      if (btn) switchDrill(btn.dataset.drill);
    });
    initPages();
  }

  function switchDrill(target) {
      if (!DRILLS[target] || target === settings.drill) return;
      const from = settings.drill;
      const fromMicFree = MIC_FREE.has(from) || PAGES.has(from);
      if (PAGES.has(from)) pages[from].deactivate();
      settings.drill = target;
      settings.lastDrill = { ...settings.lastDrill, [groupOf(target).id]: target };
      persist();
      applyDrill();
      if (PAGES.has(settings.drill)) {
        stopSession('');
        pages[settings.drill].activate();
      } else if (MIC_FREE.has(settings.drill)) {
        if (audio.ctx) stopSession(); // 마이크는 필요 없으니 끔
        startClickDrill();
      } else if (fromMicFree) {
        stopSession('시작을 누르고 마이크 사용을 허용하세요');
      } else if (phase !== 'idle') {
        nextQuestion();
      } else {
        renderTones();
        renderBoard();
      }
  }

  function initPages() {
    guide = FretGuide.init({
      settings, persist, noteName, renderBoard, playTone,
      shapeMarks, rangeMarks,
      accFor: (pc, type) => pickAccidental(pc, type, true),
      showOnPiano: (chord) => { pianoChord = chord; renderPiano(); },
      voicing: (rootPc, type, form) => {
        const shape = FretChords.shapeOf(rootPc, type, form);
        return shape ? shape.filter((p) => p.f !== null).map((p) => OPEN_MIDI[p.s] + p.f) : null;
      },
      chime: playChime,
      startMic: micStart,
      stopMic: micStop,
    });
    scales = FretScales.init({
      settings, persist, noteName, noteNameWithOctave, renderBoard, playTone,
      accFor: (pc, type) => pickAccidental(pc, type, true),
      chime: playChime,
      startMic: micStart,
      stopMic: micStop,
    });
    const ear = FretEar.init({
      settings, persist, playTone, noteNameWithOctave, renderBoard,
      accFor: (pc, type) => pickAccidental(pc, type, true),
      score: scoreExternal,
    });
    const common = {
      settings, persist, noteName, noteNameWithOctave, renderBoard, playTone,
      accFor: (pc, type) => pickAccidental(pc, type, true),
      score: scoreExternal, chime: playChime, startMic: micStart, stopMic: micStop,
      shapeMarks, getStats: () => stats,
    };
    Object.assign(pages, {
      guide, scale: scales, ear,
      drum: FretDrum.init({ settings, persist }),
      triad: FretTriads.init(common),
      interval: FretIntervals.init(common),
      jam: FretJam.init(common),
      change: FretChange.init(common),
      stats: FretStats.init(common),
    });
    FretMetronome.init({ settings, persist });

    applyDrill();
    if (MIC_FREE.has(settings.drill)) startClickDrill();
    if (PAGES.has(settings.drill)) pages[settings.drill].activate();

    el.board.addEventListener('pointerdown', (e) => {
      const hit = e.target.closest('.fb-hit');
      if (!hit) return;
      e.preventDefault();
      onBoardClick(+hit.dataset.s, +hit.dataset.f);
    });
  }

  function startClickDrill() {
    el.hint.disabled = el.skip.disabled = false;
    nextQuestion();
  }

  function applyDrill() {
    renderTabs();
    document.body.dataset.drill = settings.drill;
    // 모드에 해당하는 설정만 보이기
    document.querySelectorAll('[data-for]').forEach((n) => {
      n.hidden = !n.dataset.for.split(' ').includes(settings.drill);
    });
    el.detNote.textContent = '–';
    el.needle.style.opacity = 0;
    detector.ignored = null;
  }

  // ---------- 설정 UI ----------
  function initSettings() {
    el.strings.innerHTML = STRINGS.map((s) =>
      `<label><input type="checkbox" value="${s}">${s}번 (${NAMES.letter.sharp[OPEN_MIDI[s] % 12]})</label>`,
    ).join('');
    el.forms.innerHTML = Object.entries(FretChords.FORMS).map(([id, f]) =>
      `<label><input type="checkbox" value="${id}">${f.label}</label>`,
    ).join('');
    el.chordTypes.innerHTML = Object.entries(FretChords.TYPES).map(([id, t]) =>
      `<label><input type="checkbox" value="${id}">${t.label}</label>`,
    ).join('');

    const syncForm = () => {
      el.mode.value = settings.mode;
      el.fretMin.value = settings.fretMin;
      el.fretMax.value = settings.fretMax;
      el.naming.value = settings.naming;
      el.accidental.value = settings.accidental;
      el.natural.checked = settings.naturalOnly;
      el.inOrder.checked = settings.inOrder;
      el.weak.checked = settings.weakFocus;
      el.sound.checked = settings.sound;
      el.sens.value = settings.sensitivity;
      el.sensVal.textContent = settings.sensitivity;
      el.strings.querySelectorAll('input').forEach((i) => { i.checked = settings.strings.includes(+i.value); });
      el.chordTypes.querySelectorAll('input').forEach((i) => { i.checked = settings.chordTypes.includes(i.value); });
      el.chordSet.value = settings.chordSet;
      el.pianoLabels.checked = settings.pianoLabels;
      el.boardTask.value = settings.boardTask;
      el.forms.querySelectorAll('input').forEach((i) => { i.checked = settings.forms.includes(i.value); });
    };
    syncForm();

    const onChange = (requeue) => () => {
      settings.mode = el.mode.value;
      settings.naming = el.naming.value;
      settings.accidental = el.accidental.value;
      settings.naturalOnly = el.natural.checked;
      settings.inOrder = el.inOrder.checked;
      settings.chordSet = el.chordSet.value;
      settings.pianoLabels = el.pianoLabels.checked;
      settings.boardTask = el.boardTask.value;
      settings.weakFocus = el.weak.checked;
      settings.sound = el.sound.checked;
      settings.sensitivity = +el.sens.value;

      let lo = clampFret(el.fretMin.value);
      let hi = clampFret(el.fretMax.value);
      if (lo > hi) [lo, hi] = [hi, lo];
      settings.fretMin = lo;
      settings.fretMax = hi;

      const picked = [...el.strings.querySelectorAll('input:checked')].map((i) => +i.value);
      settings.strings = picked.length ? picked : settings.strings; // 최소 한 줄은 유지
      const types = [...el.chordTypes.querySelectorAll('input:checked')].map((i) => i.value);
      settings.chordTypes = types.length ? types : settings.chordTypes; // 최소 한 종류는 유지
      const forms = [...el.forms.querySelectorAll('input:checked')].map((i) => i.value);
      settings.forms = forms.length ? forms : settings.forms;

      syncForm();
      renderChromaLabels();
      renderPiano();
      persist();
      if (settings.drill === 'guide') guide.render();
      else if (PAGES.has(settings.drill)) pages[settings.drill].render();
      else if (requeue && phase !== 'idle') nextQuestion();
      else renderBoard();
    };

    [el.mode, el.fretMin, el.fretMax, el.natural, el.naming, el.accidental, el.inOrder, el.chordSet, el.boardTask]
      .forEach((x) => x.addEventListener('change', onChange(true)));
    el.strings.addEventListener('change', onChange(true));
    el.chordTypes.addEventListener('change', onChange(true));
    el.forms.addEventListener('change', onChange(true));
    [el.weak, el.sound, el.sens, el.pianoLabels].forEach((x) => x.addEventListener('change', onChange(false)));
    el.sens.addEventListener('input', () => { el.sensVal.textContent = el.sens.value; settings.sensitivity = +el.sens.value; });

    el.reset.addEventListener('click', () => {
      if (!confirm('지금까지 쌓인 약점 기록을 지울까요?')) return;
      stats = {};
      persist();
    });
  }

  function clampFret(v) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.min(24, Math.max(0, n)) : 0;
  }

  // ---------- 시작 / 정지 ----------
  function stopSession(message = '정지됨 — 다시 시작하려면 시작을 누르세요') {
    stopAudio();
    clearTimeout(nextTimer);
    phase = 'idle';
    question = null;
    el.start.textContent = '시작';
    el.start.classList.remove('stop');
    el.hint.disabled = el.skip.disabled = true;
    el.detNote.textContent = '–';
    el.needle.style.opacity = 0;
    el.level.style.width = '0';
    audio.chroma.fill(0);
    updateChroma(false);
    showPrompt('', '🎸', message);
    renderTones();
    renderChromaTargets();
    renderPiano();
    renderBoard();
  }

  async function toggle() {
    if (MIC_FREE.has(settings.drill) || PAGES.has(settings.drill)) return;
    if (audio.ctx) {
      stopSession();
      return;
    }

    el.start.disabled = true;
    el.status.textContent = '마이크 연결 중…';
    try {
      await startAudio();
      el.start.textContent = '정지';
      el.start.classList.add('stop');
      el.hint.disabled = el.skip.disabled = false;
      nextQuestion();
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? '마이크 권한이 거부됐어요. 브라우저 주소창의 권한 설정을 확인하세요.'
        : `마이크를 열 수 없어요: ${err.message}`;
      showPrompt('', '🎸', msg, 'wrong');
    } finally {
      el.start.disabled = false;
    }
  }

  el.start.addEventListener('click', toggle);
  el.hint.addEventListener('click', giveHint);
  el.skip.addEventListener('click', skip);

  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea') || e.repeat) return;
    if (e.code === 'Space' && settings.drill === 'guide') { e.preventDefault(); guide.togglePlay(); }
    else if (e.code === 'Space' && settings.drill === 'ear') { e.preventDefault(); pages.ear.replay(); }
    else if (e.code === 'Space' && settings.drill === 'drum') { e.preventDefault(); pages.drum.toggle(); }
    else if (e.code === 'Space' && settings.drill === 'jam') { e.preventDefault(); pages.jam.toggle(); }
    else if (e.code === 'Space' && settings.drill === 'change') { e.preventDefault(); pages.change.toggle(); }
    else if (e.code === 'KeyH' && (settings.drill === 'triad' || settings.drill === 'interval')) pages[settings.drill].giveUp();
    else if (e.code === 'KeyH' && settings.drill === 'ear') pages.ear.giveUp();
    else if (e.code === 'Space') { e.preventDefault(); skip(); }
    else if (e.code === 'KeyH') giveHint();
    else if (e.code === 'Enter' && !audio.ctx) toggle();
  });

  // ---------- 연습 시간 기록 ----------
  let lastActive = 0;
  ['pointerdown', 'keydown'].forEach((t) => document.addEventListener(t, () => { lastActive = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastActive < 60000) FretLog.tick(15);
  }, 15000);

  // ---------- 앱 설치 (PWA) ----------
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* 오프라인 지원만 빠질 뿐 앱은 그대로 동작 */ });
  }
  let installPrompt = null;
  const installBtn = $('btn-install');
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installBtn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { installBtn.hidden = true; });

  initChroma();
  initPiano();
  initSettings();
  initTabs();
  updateStats();
  renderBoard();
})();

// 코드 가이드: 코드 보기 + 5도권으로 코드 진행 만들기
(function (global) {
  'use strict';

  // 5도권 순서 (C에서 시계 방향으로 5도씩 위)
  const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const MINOR_LIKE = new Set(['min', 'min7', 'dim', 'm7b5']);

  // 키 안의 코드: [근음까지 반음, 3화음, 7화음, 따로 표시할 설명]
  const DIATONIC = {
    major: [
      [0, 'maj', 'maj7'], [2, 'min', 'min7'], [4, 'min', 'min7'], [5, 'maj', 'maj7'],
      [7, 'maj', 'dom7'], [9, 'min', 'min7'], [11, 'dim', 'm7b5'],
    ],
    minor: [
      [0, 'min', 'min7'], [2, 'dim', 'm7b5'], [3, 'maj', 'maj7'], [5, 'min', 'min7'],
      [7, 'min', 'min7'], [8, 'maj', 'maj7'], [10, 'maj', 'dom7'],
      [7, 'maj', 'dom7', '화성단음계'], // 단조에서 자주 빌려 쓰는 V
    ],
  };

  const NUMERAL_BASE = {
    major: ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'],
    minor: ['I', '♭II', 'II', 'III', '♯III', 'IV', '♯IV', 'V', 'VI', '♯VI', 'VII', '♯VII'],
  };
  const NUMERAL_SUFFIX = {
    maj: '', min: '', dom7: '7', maj7: 'M7', min7: '7', sus2: 'sus2', sus4: 'sus4', dim: '°', aug: '+', m7b5: 'ø7',
  };

  // 진행 프리셋: 키의 으뜸음 기준 [반음, 종류]
  const PRESETS = [
    { name: 'I–V–vi–IV (팝 진행)', steps: [[0, 'maj'], [7, 'maj'], [9, 'min'], [5, 'maj']] },
    { name: 'I–vi–IV–V (50년대 진행)', steps: [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'maj']] },
    { name: 'vi–IV–I–V', steps: [[9, 'min'], [5, 'maj'], [0, 'maj'], [7, 'maj']] },
    { name: 'I–IV–V–I', steps: [[0, 'maj'], [5, 'maj'], [7, 'maj'], [0, 'maj']] },
    { name: 'ii–V–I (재즈)', steps: [[2, 'min7'], [7, 'dom7'], [0, 'maj7']] },
    { name: 'iii–vi–ii–V–I (5도권 진행)', steps: [[4, 'min7'], [9, 'min7'], [2, 'min7'], [7, 'dom7'], [0, 'maj7']] },
    { name: '캐논 진행', steps: [[0, 'maj'], [7, 'maj'], [9, 'min'], [4, 'min'], [5, 'maj'], [0, 'maj'], [5, 'maj'], [7, 'maj']] },
    { name: '12마디 블루스', steps: [[0, 'dom7'], [0, 'dom7'], [0, 'dom7'], [0, 'dom7'], [5, 'dom7'], [5, 'dom7'], [0, 'dom7'], [0, 'dom7'], [7, 'dom7'], [5, 'dom7'], [0, 'dom7'], [7, 'dom7']] },
    { name: 'i–VI–III–VII (단조)', mode: 'minor', steps: [[0, 'min'], [8, 'maj'], [3, 'maj'], [10, 'maj']] },
    { name: 'i–VII–VI–V (안달루시아)', mode: 'minor', steps: [[0, 'min'], [10, 'maj'], [8, 'maj'], [7, 'maj']] },
    { name: 'ii°–V–i (단조 재즈)', mode: 'minor', steps: [[2, 'm7b5'], [7, 'dom7'], [0, 'min7']] },
  ];

  const MAX_PROG = 32;
  const OPEN_MIDI = FretInst.open; // 현재 악기의 개방현 (instrument.js)
  // 가이드톤: 코드 성격을 정하는 3음과 7음 (sus 코드는 3음 자리의 2·4음)
  const GUIDE_ROLES = new Set(['3', '♭3', '2', '4', '7', '♭7']);
  const isSeventh = (role) => role.includes('7');

  function guideTones(chord) {
    return chord.tones.filter((t) => GUIDE_ROLES.has(t.role));
  }

  // 반음 단위의 가장 가까운 이동 (-6 ~ +5)
  function interval(x, y) {
    let d = (((y - x) % 12) + 12) % 12;
    if (d > 6) d -= 12;
    return d;
  }

  // 앞 코드의 가이드톤이 다음 코드의 어느 음으로 가장 가깝게 이어지는지
  function voiceLead(a, b) {
    if (!a.length || !b.length) return [];
    if (a.length === 2 && b.length === 2) {
      const straight = Math.abs(interval(a[0].pc, b[0].pc)) + Math.abs(interval(a[1].pc, b[1].pc));
      const crossed = Math.abs(interval(a[0].pc, b[1].pc)) + Math.abs(interval(a[1].pc, b[0].pc));
      return straight <= crossed ? [[a[0], b[0]], [a[1], b[1]]] : [[a[0], b[1]], [a[1], b[0]]];
    }
    return a.map((x) => [x, b.reduce((best, y) => (Math.abs(interval(x.pc, y.pc)) < Math.abs(interval(x.pc, best.pc)) ? y : best))]);
  }

  function moveText(d) {
    if (d === 0) return '유지';
    const size = Math.abs(d) === 1 ? '반음' : Math.abs(d) === 2 ? '온음' : `${Math.abs(d)}반음`;
    return `${size}${d < 0 ? '↓' : '↑'}`;
  }
  const $ = (id) => document.getElementById(id);

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.guide || {};
    const st = {
      key: saved.key || { pc: 0, mode: 'major' },
      chord: saved.chord || { rootPc: 0, type: 'maj' },
      form: saved.form || 'open',
      prog: saved.prog || [],
      sevenths: !!saved.sevenths,
      bpm: saved.bpm || 90,
      beats: saved.beats || 2,
      loop: !!saved.loop,
    };
    const play = { on: false, i: -1, timer: 0 };
    let active = false;

    const el = {
      circle: $('g-circle'), key: $('g-key'), sevenths: $('g-sevenths'),
      diatonic: $('g-diatonic'), suggest: $('g-suggest'),
      name: $('g-name'), numeral: $('g-numeral'), tones: $('g-tones'), types: $('g-types'), forms: $('g-forms'),
      listen: $('g-listen'), add: $('g-add'), setKey: $('g-setkey'),
      play: $('g-play'), loop: $('g-loop'), bpm: $('g-bpm'), beats: $('g-beats'), preset: $('g-preset'), clear: $('g-clear'),
      prog: $('g-prog'), count: $('g-prog-count'),
      gt: $('g-gt'), gtInput: $('g-gt-input'), gtTimed: $('g-gt-timed'), gtMsg: $('g-gt-msg'), flow: $('g-flow'), legend: $('g-legend'),
    };
    // 가이드톤 연습 상태
    const gt = { on: false, input: 'click', i: 0, need: new Set(), total: 0, marks: [], results: [], mistakes: 0, wrong: new Set(), timers: [] };

    function save() {
      settings.guide = { key: st.key, chord: st.chord, form: st.form, prog: st.prog, sevenths: st.sevenths, bpm: st.bpm, beats: st.beats, loop: st.loop };
      ctx.persist();
    }

    // ---------- 이론 ----------
    const build = (rootPc, type) => FretChords.build(rootPc, type, ctx.accFor(rootPc, type), settings.naming);
    const keyName = (key) => build(key.pc, key.mode === 'minor' ? 'min' : 'maj').name;

    function numeral(rootPc, type) {
      const iv = (rootPc - st.key.pc + 12) % 12;
      let n = NUMERAL_BASE[st.key.mode][iv];
      if (MINOR_LIKE.has(type)) n = n.replace(/[IV]+/, (m) => m.toLowerCase());
      return n + NUMERAL_SUFFIX[type];
    }

    function diatonicChords() {
      return DIATONIC[st.key.mode].map(([iv, triad, seventh, note]) => ({
        rootPc: (st.key.pc + iv) % 12,
        type: st.sevenths ? seventh : triad,
        note,
      }));
    }

    // 이 키 안에서 그 근음이 가지는 성격(장/단)으로 코드 종류 정하기
    function qualityFor(rootPc, family) {
      const hit = DIATONIC[st.key.mode].find(([iv, triad]) =>
        (st.key.pc + iv) % 12 === rootPc && (family === null || MINOR_LIKE.has(triad) === (family === 'minor')));
      if (hit) return st.sevenths ? hit[2] : hit[1];
      const minor = family === 'minor';
      if (st.sevenths) return minor ? 'min7' : 'dom7';
      return minor ? 'min' : 'maj';
    }

    function suggestions(from) {
      const out = [];
      const push = (label, rootPc, type) => {
        if (out.some((o) => o.rootPc === rootPc && o.type === type)) return;
        out.push({ label, rootPc, type });
      };
      const r = from.rootPc;
      push('5도 아래', (r + 5) % 12, qualityFor((r + 5) % 12, null));
      push('5도 위', (r + 7) % 12, qualityFor((r + 7) % 12, null));
      if (MINOR_LIKE.has(from.type)) push('관계 장조', (r + 3) % 12, st.sevenths ? 'maj7' : 'maj');
      else push('관계 단조', (r + 9) % 12, st.sevenths ? 'min7' : 'min');
      push('V7 (이 코드로)', (r + 7) % 12, 'dom7');
      return out;
    }

    // ---------- 동작 ----------
    function select(chord, { sound = true } = {}) {
      st.chord = { rootPc: chord.rootPc, type: chord.type };
      // 고른 운지가 없는 코드면 있는 운지로
      if (FretInst.isBass && !['all', 'guide'].includes(st.form)) st.form = 'all'; // 베이스는 코드 운지 없음
      if (!['all', 'guide'].includes(st.form) && !FretChords.shapeOf(chord.rootPc, chord.type, st.form)) {
        st.form = ['open', 'a', 'e'].find((f) => FretChords.shapeOf(chord.rootPc, chord.type, f)) || 'all';
      }
      if (sound) strum(st.chord);
      save();
      render();
    }

    function append(chord) {
      if (st.prog.length >= MAX_PROG) return;
      // 진행의 첫 코드는 보통 으뜸화음이므로 키로 삼음
      if (!st.prog.length) st.key = { pc: chord.rootPc, mode: MINOR_LIKE.has(chord.type) ? 'minor' : 'major' };
      st.prog.push({ rootPc: chord.rootPc, type: chord.type });
    }

    function pick(chord) {
      append(chord);
      select(chord);
    }

    function strum(chord) {
      const midis = ctx.voicing(chord.rootPc, chord.type, ['all', 'guide'].includes(st.form) ? 'open' : st.form)
        || ctx.voicing(chord.rootPc, chord.type, 'open')
        || FretChords.TYPES[chord.type].tones.map(([semi]) => 48 + chord.rootPc + semi);
      midis.forEach((m, i) => ctx.playTone(m, i * 0.035, 1.6, 0.12));
    }

    function startPlay() {
      if (!st.prog.length) return;
      play.on = true;
      play.i = -1;
      step();
    }

    function stopPlay() {
      play.on = false;
      play.i = -1;
      clearTimeout(play.timer);
      renderProg();
      el.play.textContent = '▶ 재생';
    }

    function step() {
      play.i++;
      if (play.i >= st.prog.length) {
        if (!st.loop) { stopPlay(); return; }
        play.i = 0;
      }
      el.play.textContent = '■ 정지';
      select(st.prog[play.i]);
      play.timer = setTimeout(step, (60000 / st.bpm) * st.beats);
    }

    // ---------- 가이드톤 연습 ----------
    function gtMsg(text, cls = '') {
      el.gtMsg.textContent = text;
      el.gtMsg.className = `g-gt-msg ${cls}`;
    }

    async function startGT() {
      if (!st.prog.length) { gtMsg('코드 진행 없음', 'bad'); return; }
      stopPlay();
      stopGT(false);
      gt.input = el.gtInput.value;
      if (gt.input === 'mic') {
        try {
          await ctx.startMic();
        } catch (err) {
          gtMsg(err.name === 'NotAllowedError' ? '마이크 권한 거부됨' : `마이크 오류: ${err.message}`, 'bad');
          return;
        }
      }
      gt.on = true;
      gt.results = [];
      gt.mistakes = 0;
      el.gt.textContent = '■ 중지';
      enterChord(0);
    }

    function stopGT(showMsg = true) {
      gt.timers.forEach(clearTimeout);
      gt.timers = [];
      const was = gt.on;
      if (was && gt.input === 'mic') ctx.stopMic();
      gt.on = false;
      gt.marks = [];
      el.gt.textContent = '가이드톤 연습';
      if (was && showMsg) gtMsg('중지됨');
      if (active) render();
    }

    function enterChord(i) {
      gt.timers.forEach(clearTimeout);
      gt.timers = [];
      gt.i = i;
      const c = st.prog[i];
      const chord = build(c.rootPc, c.type);
      const tones = guideTones(chord);
      gt.need = new Set(tones.map((t) => t.pc));
      gt.total = gt.need.size;
      gt.marks = [];
      gt.wrong = new Set();
      // 마이크로 연습할 땐 코드 소리를 내지 않음 (마이크가 그 소리를 들으면 안 되므로)
      select(c, { sound: gt.input === 'click' });
      gtMsg(`${chord.name}: ${tones.map((t) => t.role).join(' · ')}음 ${gt.input === 'mic' ? '치기' : '누르기'}`);
      if (el.gtTimed.checked) {
        const beat = 60000 / st.bpm;
        for (let b = 0; b < st.beats; b++) gt.timers.push(setTimeout(() => FretMetronome.click(b === 0), b * beat));
        gt.timers.push(setTimeout(finishChord, beat * st.beats));
      }
    }

    function finishChord() {
      gt.results[gt.i] = gt.need.size === 0 ? 'ok' : gt.need.size < gt.total ? 'half' : 'miss';
      advance();
    }

    function advance() {
      if (gt.i + 1 < st.prog.length) { enterChord(gt.i + 1); return; }
      if (el.gtTimed.checked && st.loop) { gt.results = []; enterChord(0); return; }
      const ok = gt.results.filter((r) => r === 'ok').length;
      const mistakes = gt.mistakes;
      stopGT(false);
      gtMsg(`완료 · ${st.prog.length}개 중 ${ok}개 성공 · 실수 ${mistakes}회`, 'good');
      ctx.chime();
    }

    function hit(pc, cells) {
      if (!gt.on) return;
      const c = st.prog[gt.i];
      const chord = build(c.rootPc, c.type);
      const tone = guideTones(chord).find((t) => t.pc === pc);
      if (tone) {
        if (!gt.need.has(pc)) return; // 이미 찾은 음
        gt.need.delete(pc);
        gt.marks.push(...cells.map((cell) => ({ ...cell, label: tone.name, cls: isSeventh(tone.role) ? 'hint' : 'tone', still: true })));
        if (!gt.need.size) {
          gtMsg(`${chord.name} 완성`, 'good');
          if (!el.gtTimed.checked) {
            gt.results[gt.i] = 'ok';
            gt.timers.push(setTimeout(advance, 600));
          }
        } else {
          gtMsg(`${tone.role}음 ${tone.name}`);
        }
        render();
        return;
      }
      if (!gt.wrong.has(pc)) { gt.wrong.add(pc); gt.mistakes++; }
      const other = chord.tones.find((t) => t.pc === pc);
      gtMsg(other
        ? `오답: ${other.name} (${other.role === 'R' ? '근' : other.role}음, 가이드톤 아님)`
        : `오답: ${ctx.noteName(pc)} (${chord.name} 구성음 아님)`, 'bad');
    }

    function positions(midi) {
      const out = [];
      for (const [s, open] of Object.entries(OPEN_MIDI)) {
        const f = midi - open;
        if (f >= 0 && f <= 15) out.push({ s: +s, f, midi });
      }
      return out;
    }

    // ---------- 그리기 ----------
    function wedge(r1, r2, a0, a1) {
      const p = (r, a) => [170 + r * Math.cos((a * Math.PI) / 180), 170 + r * Math.sin((a * Math.PI) / 180)];
      const [x1, y1] = p(r2, a0), [x2, y2] = p(r2, a1), [x3, y3] = p(r1, a1), [x4, y4] = p(r1, a0);
      return `M${x1} ${y1}A${r2} ${r2} 0 0 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
    }

    function renderCircle() {
      const k = FIFTHS.indexOf(st.key.mode === 'minor' ? (st.key.pc + 3) % 12 : st.key.pc);
      const near = new Set([(k + 11) % 12, k, (k + 1) % 12]);
      const selMinor = MINOR_LIKE.has(st.chord.type);
      const selIdx = FIFTHS.indexOf(selMinor ? (st.chord.rootPc + 3) % 12 : st.chord.rootPc);
      const parts = [];
      FIFTHS.forEach((pc, i) => {
        const c = -90 + i * 30;
        const rings = [
          { ring: 'outer', r1: 106, r2: 162, rootPc: pc, type: 'maj', tonic: st.key.mode === 'major' && i === k, sel: !selMinor && i === selIdx },
          { ring: 'inner', r1: 60, r2: 106, rootPc: (pc + 9) % 12, type: 'min', tonic: st.key.mode === 'minor' && i === k, sel: selMinor && i === selIdx },
        ];
        for (const g of rings) {
          const cls = ['cw-seg', g.ring, near.has(i) ? 'in-key' : '', g.tonic ? 'tonic' : '', g.sel ? 'sel' : ''].join(' ');
          const mid = (g.r1 + g.r2) / 2;
          const tx = 170 + mid * Math.cos((c * Math.PI) / 180);
          const ty = 170 + mid * Math.sin((c * Math.PI) / 180);
          parts.push(
            `<g class="${cls}" data-ring="${g.ring}" data-i="${i}"><path d="${wedge(g.r1, g.r2, c - 15, c + 15)}"/>` +
            `<text x="${tx}" y="${ty}">${build(g.rootPc, g.type).name}</text></g>`,
          );
        }
      });
      // 가운데: 현재 키와 조표
      const sig = k <= 6 ? (k ? `♯ ${k}개` : '♯♭ 없음') : `♭ ${12 - k}개`;
      parts.push(`<circle class="cw-center" cx="170" cy="170" r="56"/>`);
      parts.push(`<text class="cw-key" x="170" y="160">${keyName(st.key)}</text>`);
      parts.push(`<text class="cw-sig" x="170" y="186">${st.key.mode === 'minor' ? '단조' : '장조'} · ${sig}</text>`);
      el.circle.innerHTML = parts.join('');
    }

    const chordBtn = (c, extra = '') =>
      `<button type="button" class="g-chord" data-root="${c.rootPc}" data-type="${c.type}">` +
      `<small>${extra || numeral(c.rootPc, c.type)}</small><b>${build(c.rootPc, c.type).name}</b></button>`;

    function renderRows() {
      el.diatonic.innerHTML = diatonicChords().map((c) => chordBtn(c, c.note ? `${numeral(c.rootPc, c.type)} (${c.note})` : '')).join('');
      const from = st.prog[st.prog.length - 1] || st.chord;
      el.suggest.innerHTML = suggestions(from).map((c) => chordBtn(c, c.label)).join('');
    }

    function renderViewer() {
      const chord = build(st.chord.rootPc, st.chord.type);
      el.name.textContent = chord.name;
      el.numeral.textContent = `${keyName(st.key)} 키 · ${numeral(st.chord.rootPc, st.chord.type)}`;
      const guideView = gt.on || st.form === 'guide';
      el.tones.innerHTML = chord.tones.map((t) => {
        const isGuide = GUIDE_ROLES.has(t.role);
        const hidden = gt.on && isGuide && gt.need.has(t.pc); // 연습 중엔 아직 못 찾은 가이드톤은 가림
        const cls = hidden ? 'tone' : `tone found${t.role === 'R' ? ' root' : ''}${guideView && !isGuide ? ' dim' : ''}`;
        return `<div class="${cls}"><small>${t.role}</small><b>${hidden ? '?' : t.name}</b></div>`;
      }).join('');
      el.legend.hidden = !guideView;
      el.types.innerHTML = Object.entries(FretChords.TYPES).map(([id, t]) =>
        `<button type="button" data-type="${id}" class="${id === st.chord.type ? 'on' : ''}">${t.label}</button>`).join('');
      const forms = [...Object.entries(FretChords.FORMS).map(([id, f]) => [id, f.label]), ['all', '구성음 전체'], ['guide', '가이드톤 (3·7음)']];
      el.forms.innerHTML = forms.map(([id, label]) => {
        const ok = id === 'all' || id === 'guide' || (!FretInst.isBass && FretChords.shapeOf(st.chord.rootPc, st.chord.type, id));
        return `<button type="button" data-form="${id}" class="${id === st.form ? 'on' : ''}"${ok ? '' : ' disabled'}>${label}</button>`;
      }).join('');

      if (gt.on) {
        ctx.showOnPiano({ rootPc: chord.rootPc, tones: guideTones(chord).filter((t) => !gt.need.has(t.pc)) });
        ctx.renderBoard(gt.marks);
        return;
      }
      if (st.form === 'guide') {
        const g = guideTones(chord);
        ctx.showOnPiano({ rootPc: chord.rootPc, tones: g });
        ctx.renderBoard(ctx.rangeMarks({ tones: g }).map((m) => ({ ...m, cls: g.find((t) => t.name === m.label && isSeventh(t.role)) ? 'hint' : 'tone' })));
        return;
      }
      ctx.showOnPiano(chord);
      const shape = !FretInst.isBass && st.form !== 'all' && FretChords.shapeOf(st.chord.rootPc, st.chord.type, st.form);
      ctx.renderBoard(shape ? ctx.shapeMarks(chord, shape, st.form) : ctx.rangeMarks(chord));
    }

    function renderProg() {
      el.count.textContent = st.prog.length ? `${st.prog.length}개 · ${keyName(st.key)} 키` : '';
      el.prog.innerHTML = !st.prog.length
        ? '<p class="g-empty">5도권이나 코드를 누르면 추가됨</p>'
        : st.prog.map((c, i) => {
          const chord = build(c.rootPc, c.type);
          const now = i === play.i || (gt.on && i === gt.i);
          const result = gt.results[i] ? ` ${gt.results[i]}` : '';
          // 연습 중에는 가이드톤 답을 숨김
          const gts = gt.on ? '' : `<em>${guideTones(chord).map((t) => t.name).join('·')}</em>`;
          return `<div class="g-step${now ? ' playing' : ''}${result}" data-i="${i}">` +
            `<small>${numeral(c.rootPc, c.type)}</small><b>${chord.name}</b>${gts}` +
            `<button type="button" class="g-del" data-del="${i}" aria-label="삭제">×</button></div>`;
        }).join('');
      el.play.disabled = !st.prog.length;
      el.gt.disabled = !st.prog.length;
      renderFlow();
    }

    // 가이드톤 흐름: 코드가 바뀔 때 3·7음이 어디로 움직이는지
    function renderFlow() {
      if (st.prog.length < 2 || gt.on) { el.flow.innerHTML = ''; return; }
      const rows = [];
      for (let i = 0; i + 1 < st.prog.length; i++) {
        const a = build(st.prog[i].rootPc, st.prog[i].type);
        const b = build(st.prog[i + 1].rootPc, st.prog[i + 1].type);
        const moves = voiceLead(guideTones(a), guideTones(b)).map(([x, y]) => {
          const d = interval(x.pc, y.pc);
          return `<span class="${Math.abs(d) <= 1 ? 'smooth' : ''}">${x.name}(${x.role}) → ${y.name}(${y.role}) <small>${moveText(d)}</small></span>`;
        });
        rows.push(`<div class="g-flow-row"><b>${a.name} → ${b.name}</b>${moves.join('')}</div>`);
      }
      el.flow.innerHTML = `<div class="g-title">가이드톤 흐름 <small>초록: 반음 이동 또는 유지</small></div>${rows.join('')}`;
    }

    function renderKeySelect() {
      const opts = [];
      for (const pc of FIFTHS) opts.push([`${pc}:major`, `${keyName({ pc, mode: 'major' })} 장조`]);
      for (const pc of FIFTHS) opts.push([`${(pc + 9) % 12}:minor`, `${keyName({ pc: (pc + 9) % 12, mode: 'minor' })} 단조`]);
      el.key.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
      el.key.value = `${st.key.pc}:${st.key.mode}`;
    }

    function render() {
      if (!active) return;
      renderKeySelect();
      renderCircle();
      renderRows();
      renderViewer();
      renderProg();
      el.sevenths.checked = st.sevenths;
      el.loop.checked = st.loop;
      el.bpm.value = st.bpm;
      el.beats.value = st.beats;
    }

    // ---------- 이벤트 ----------
    el.preset.innerHTML = '<option value="">프리셋</option>' +
      PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
    el.bpm.innerHTML = [60, 75, 90, 105, 120, 140].map((b) => `<option value="${b}">${b} BPM</option>`).join('');
    el.beats.innerHTML = [[1, '코드당 1박'], [2, '코드당 2박'], [4, '코드당 4박 (한 마디)']]
      .map(([v, t]) => `<option value="${v}">${t}</option>`).join('');

    el.circle.addEventListener('click', (e) => {
      const g = e.target.closest('.cw-seg');
      if (!g) return;
      const pc = FIFTHS[+g.dataset.i];
      if (g.dataset.ring === 'outer') pick({ rootPc: pc, type: qualityFor(pc, 'major') });
      else pick({ rootPc: (pc + 9) % 12, type: qualityFor((pc + 9) % 12, 'minor') });
    });
    const chordClick = (e) => {
      const b = e.target.closest('.g-chord');
      if (b) pick({ rootPc: +b.dataset.root, type: b.dataset.type });
    };
    el.diatonic.addEventListener('click', chordClick);
    el.suggest.addEventListener('click', chordClick);

    el.key.addEventListener('change', () => {
      const [pc, mode] = el.key.value.split(':');
      st.key = { pc: +pc, mode };
      save();
      render();
    });
    el.sevenths.addEventListener('change', () => { st.sevenths = el.sevenths.checked; save(); render(); });
    el.types.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-type]');
      if (b) select({ rootPc: st.chord.rootPc, type: b.dataset.type });
    });
    el.forms.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-form]');
      if (!b || b.disabled) return;
      st.form = b.dataset.form;
      select(st.chord);
    });
    el.listen.addEventListener('click', () => strum(st.chord));
    el.add.addEventListener('click', () => { append(st.chord); save(); render(); });
    el.setKey.addEventListener('click', () => {
      st.key = { pc: st.chord.rootPc, mode: MINOR_LIKE.has(st.chord.type) ? 'minor' : 'major' };
      save();
      render();
    });

    el.prog.addEventListener('click', (e) => {
      const del = e.target.closest('.g-del');
      if (del) {
        if (gt.on) return;
        st.prog.splice(+del.dataset.del, 1);
        if (play.on && play.i >= st.prog.length) play.i = -1;
        save();
        render();
        return;
      }
      const stepEl = e.target.closest('.g-step');
      if (stepEl && !gt.on) select(st.prog[+stepEl.dataset.i]);
    });
    el.play.addEventListener('click', () => (play.on ? stopPlay() : startPlay()));
    el.loop.addEventListener('change', () => { st.loop = el.loop.checked; save(); });
    el.bpm.addEventListener('change', () => { st.bpm = +el.bpm.value; save(); });
    el.beats.addEventListener('change', () => { st.beats = +el.beats.value; save(); });
    el.clear.addEventListener('click', () => { stopPlay(); stopGT(false); gt.results = []; st.prog = []; save(); render(); });
    el.gt.addEventListener('click', () => (gt.on ? stopGT() : startGT()));
    el.preset.addEventListener('change', () => {
      const p = PRESETS[+el.preset.value];
      el.preset.value = '';
      if (!p) return;
      stopPlay();
      st.key = { pc: st.key.pc, mode: p.mode || 'major' };
      st.prog = p.steps.map(([iv, type]) => ({ rootPc: (st.key.pc + iv) % 12, type }));
      select(st.prog[0], { sound: false });
    });

    return {
      activate() { active = true; render(); },
      deactivate() { stopPlay(); stopGT(false); active = false; },
      render,
      togglePlay() { if (gt.on) return; if (play.on) stopPlay(); else startPlay(); },
      onNote(midi) { if (gt.on && gt.input === 'mic') hit(midi % 12, positions(midi)); },
      // 진행 분석기에서 보낸 진행 받기
      setProgression(prog, key) {
        stopPlay();
        stopGT(false);
        gt.results = [];
        st.prog = prog.map((c) => ({ rootPc: c.rootPc, type: c.type }));
        st.key = { pc: key.pc, mode: key.mode };
        if (st.prog[0]) st.chord = { ...st.prog[0] };
        save();
      },
      onClick(s, f, midi) { if (gt.on && gt.input === 'click') hit(midi % 12, [{ s, f, midi }]); },
    };
  }

  global.FretGuide = { init, PRESETS };
})(window);

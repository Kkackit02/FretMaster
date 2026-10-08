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
    maj: '', min: '', dom7: '7', maj7: 'maj7', min7: '7', sus2: 'sus2', sus4: 'sus4', dim: '°', aug: '+', m7b5: 'ø7',
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
    };

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
      push('5도 아래로 (해결)', (r + 5) % 12, qualityFor((r + 5) % 12, null));
      push('5도 위로', (r + 7) % 12, qualityFor((r + 7) % 12, null));
      if (MINOR_LIKE.has(from.type)) push('관계 장조', (r + 3) % 12, st.sevenths ? 'maj7' : 'maj');
      else push('관계 단조', (r + 9) % 12, st.sevenths ? 'min7' : 'min');
      push('이 코드로 가는 V7', (r + 7) % 12, 'dom7');
      return out;
    }

    // ---------- 동작 ----------
    function select(chord, { sound = true } = {}) {
      st.chord = { rootPc: chord.rootPc, type: chord.type };
      // 고른 운지가 없는 코드면 있는 운지로
      if (st.form !== 'all' && !FretChords.shapeOf(chord.rootPc, chord.type, st.form)) {
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
      const midis = ctx.voicing(chord.rootPc, chord.type, st.form === 'all' ? 'open' : st.form)
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
      el.numeral.textContent = `${keyName(st.key)} 키에서 ${numeral(st.chord.rootPc, st.chord.type)}`;
      el.tones.innerHTML = chord.tones.map((t) =>
        `<div class="tone found${t.role === 'R' ? ' root' : ''}"><small>${t.role}</small><b>${t.name}</b></div>`).join('');
      el.types.innerHTML = Object.entries(FretChords.TYPES).map(([id, t]) =>
        `<button type="button" data-type="${id}" class="${id === st.chord.type ? 'on' : ''}">${t.label}</button>`).join('');
      const forms = [...Object.entries(FretChords.FORMS).map(([id, f]) => [id, f.label]), ['all', '구성음 전체']];
      el.forms.innerHTML = forms.map(([id, label]) => {
        const ok = id === 'all' || FretChords.shapeOf(st.chord.rootPc, st.chord.type, id);
        return `<button type="button" data-form="${id}" class="${id === st.form ? 'on' : ''}"${ok ? '' : ' disabled'}>${label}</button>`;
      }).join('');

      ctx.showOnPiano(chord);
      const shape = st.form !== 'all' && FretChords.shapeOf(st.chord.rootPc, st.chord.type, st.form);
      ctx.renderBoard(shape ? ctx.shapeMarks(chord, shape, st.form) : ctx.rangeMarks(chord));
    }

    function renderProg() {
      el.count.textContent = st.prog.length ? `${st.prog.length}개 · ${keyName(st.key)} 키` : '';
      el.prog.innerHTML = !st.prog.length
        ? '<p class="g-empty">5도권 원이나 위의 코드를 누르면 여기에 차례로 쌓여요</p>'
        : st.prog.map((c, i) =>
          `<div class="g-step${i === play.i ? ' playing' : ''}" data-i="${i}">` +
          `<small>${numeral(c.rootPc, c.type)}</small><b>${build(c.rootPc, c.type).name}</b>` +
          `<button type="button" class="g-del" data-del="${i}" aria-label="삭제">×</button></div>`).join('');
      el.play.disabled = !st.prog.length;
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
    el.preset.innerHTML = '<option value="">자주 쓰는 진행 불러오기…</option>' +
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
        st.prog.splice(+del.dataset.del, 1);
        if (play.on && play.i >= st.prog.length) play.i = -1;
        save();
        render();
        return;
      }
      const stepEl = e.target.closest('.g-step');
      if (stepEl) select(st.prog[+stepEl.dataset.i]);
    });
    el.play.addEventListener('click', () => (play.on ? stopPlay() : startPlay()));
    el.loop.addEventListener('change', () => { st.loop = el.loop.checked; save(); });
    el.bpm.addEventListener('change', () => { st.bpm = +el.bpm.value; save(); });
    el.beats.addEventListener('change', () => { st.beats = +el.beats.value; save(); });
    el.clear.addEventListener('click', () => { stopPlay(); st.prog = []; save(); render(); });
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
      deactivate() { stopPlay(); active = false; },
      render,
      togglePlay() { if (play.on) stopPlay(); else startPlay(); },
    };
  }

  global.FretGuide = { init };
})(window);

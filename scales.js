// 스케일 연습: 포지션 보기·듣기, 지판으로 따라가기, 기타로 따라 치기(마이크)
(function (global) {
  'use strict';

  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const MAJOR_SEMI = [0, 2, 4, 5, 7, 9, 11];

  // notes: [근음에서 반음, 글자 간격(도수-1)]
  const SCALES = {
    major:      { label: '메이저 (이오니안)',      notes: [[0, 0], [2, 1], [4, 2], [5, 3], [7, 4], [9, 5], [11, 6]] },
    minor:      { label: '내추럴 마이너 (에올리안)', notes: [[0, 0], [2, 1], [3, 2], [5, 3], [7, 4], [8, 5], [10, 6]] },
    majpent:    { label: '메이저 펜타토닉',        notes: [[0, 0], [2, 1], [4, 2], [7, 4], [9, 5]] },
    minpent:    { label: '마이너 펜타토닉',        notes: [[0, 0], [3, 2], [5, 3], [7, 4], [10, 6]] },
    blues:      { label: '블루스',                notes: [[0, 0], [3, 2], [5, 3], [6, 4], [7, 4], [10, 6]] },
    harmonic:   { label: '하모닉 마이너',          notes: [[0, 0], [2, 1], [3, 2], [5, 3], [7, 4], [8, 5], [11, 6]] },
    melodic:    { label: '멜로딕 마이너',          notes: [[0, 0], [2, 1], [3, 2], [5, 3], [7, 4], [9, 5], [11, 6]] },
    dorian:     { label: '도리안',                notes: [[0, 0], [2, 1], [3, 2], [5, 3], [7, 4], [9, 5], [10, 6]] },
    phrygian:   { label: '프리지안',              notes: [[0, 0], [1, 1], [3, 2], [5, 3], [7, 4], [8, 5], [10, 6]] },
    lydian:     { label: '리디안',                notes: [[0, 0], [2, 1], [4, 2], [6, 3], [7, 4], [9, 5], [11, 6]] },
    mixolydian: { label: '믹솔리디안',            notes: [[0, 0], [2, 1], [4, 2], [5, 3], [7, 4], [9, 5], [10, 6]] },
    locrian:    { label: '로크리안',              notes: [[0, 0], [1, 1], [3, 2], [5, 3], [6, 4], [8, 5], [10, 6]] },
  };

  function degreeLabel(semi, step) {
    if (step === 0) return 'R';
    const d = semi - MAJOR_SEMI[step];
    return (d < 0 ? '♭'.repeat(-d) : '♯'.repeat(d)) + (step + 1);
  }

  /**
   * 포지션 운지: 6번 줄의 p번째 스케일 음에서 시작해 줄마다 같은 개수(펜타토닉 2개, 7음 스케일 3개)씩 올라감.
   * 펜타토닉은 흔히 쓰는 5개 박스, 7음 스케일은 줄당 3음(3NPS) 패턴이 된다.
   * 블루스는 마이너 펜타토닉 박스에 ♭5를 더한다.
   */
  function positionCells(rootPc, scaleId, p) {
    const base = scaleId === 'blues' ? SCALES.minpent : SCALES[scaleId];
    const semis = base.notes.map((n) => n[0]);
    const len = semis.length;
    const nps = len === 7 ? 3 : 2;
    let midi = 40 + (((rootPc + semis[p]) % 12) - 4 + 12) % 12; // 6번 줄 0~11프렛
    let idx = p;
    let cells = [];
    for (let k = 0; k < nps * 6; k++) {
      const s = 6 - Math.floor(k / nps);
      cells.push({ s, f: midi - OPEN_MIDI[s], midi });
      const next = (idx + 1) % len;
      midi += (semis[next] - semis[idx] + 12) % 12;
      idx = next;
    }
    if (cells.some((c) => c.f < 0)) cells = cells.map((c) => ({ ...c, f: c.f + 12, midi: c.midi + 12 }));
    if (scaleId === 'blues') {
      const lo = Math.min(...cells.map((c) => c.f));
      const hi = Math.max(...cells.map((c) => c.f));
      const blue = (rootPc + 6) % 12;
      for (let s = 6; s >= 1; s--) {
        for (let f = lo; f <= hi; f++) {
          const m = OPEN_MIDI[s] + f;
          if (m % 12 === blue && !cells.some((c) => c.midi === m)) cells.push({ s, f, midi: m });
        }
      }
    }
    return cells;
  }

  function positionCount(scaleId) {
    return scaleId === 'blues' ? 5 : SCALES[scaleId].notes.length;
  }

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.scale || {};
    const st = {
      root: saved.root ?? 9,
      type: saved.type || 'minpent',
      pos: saved.pos ?? 0,          // -1 = 지판 전체
      dir: saved.dir || 'up',
      label: saved.label || 'name',
      bpm: saved.bpm || 100,
      showPattern: saved.showPattern ?? true,
      best: saved.best || {},
    };
    // 연습 진행 상태
    const run = { mode: null, items: [], i: 0, mistakes: 0, wrong: new Set(), startedAt: 0, timer: 0 };
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      root: $('s-root'), type: $('s-type'), pos: $('s-pos'), dir: $('s-dir'), label: $('s-label'), bpm: $('s-bpm'),
      show: $('s-show'), name: $('s-name'), notes: $('s-notes'), next: $('s-next'), msg: $('s-msg'),
      listen: $('s-listen'), click: $('s-click'), mic: $('s-mic'), stop: $('s-stop'), best: $('s-best'),
    };

    function save() {
      settings.scale = { root: st.root, type: st.type, pos: st.pos, dir: st.dir, label: st.label, bpm: st.bpm, showPattern: st.showPattern, best: st.best };
      ctx.persist();
    }

    // ---------- 이론 ----------
    const scale = () => SCALES[st.type];
    const isMinorish = () => scale().notes.some(([semi]) => semi === 3);
    const acc = () => ctx.accFor(st.root, isMinorish() ? 'min' : 'maj');

    function degreeInfo(pc) {
      const n = scale().notes.find(([semi]) => (st.root + semi) % 12 === pc);
      if (!n) return null;
      return {
        name: FretChords.spellDegree(st.root, n[0], n[1], acc(), settings.naming),
        degree: degreeLabel(n[0], n[1]),
        root: n[0] === 0,
      };
    }

    function cells() {
      if (st.pos >= 0) return positionCells(st.root, st.type, st.pos);
      const out = [];
      for (let s = 6; s >= 1; s--) {
        for (let f = settings.fretMin; f <= settings.fretMax; f++) {
          const midi = OPEN_MIDI[s] + f;
          if (degreeInfo(midi % 12)) out.push({ s, f, midi });
        }
      }
      return out;
    }

    // 연습 순서: 같은 높이의 음은 하나로 묶음 (지판 전체일 때 여러 자리)
    function sequence() {
      const byMidi = new Map();
      for (const c of cells()) {
        if (!byMidi.has(c.midi)) byMidi.set(c.midi, []);
        byMidi.get(c.midi).push({ s: c.s, f: c.f });
      }
      const up = [...byMidi.entries()].sort((a, b) => a[0] - b[0]).map(([midi, where]) => ({ midi, where }));
      if (st.dir === 'down') return up.reverse();
      if (st.dir === 'updown') return up.concat(up.slice(0, -1).reverse());
      return up;
    }

    const bestKey = () => `${st.root}:${st.type}:${st.pos}:${st.dir}`;
    const posName = () => (st.pos < 0 ? '지판 전체' : `${st.pos + 1}번 포지션`);
    const where = (item) => item.where.map((w) => `${w.s}번 줄 ${w.f}프렛`).join(' / ');

    // ---------- 연습 ----------
    function stopRun(message) {
      clearTimeout(run.timer);
      if (run.mode === 'mic') ctx.stopMic();
      run.mode = null;
      run.items = [];
      if (message !== undefined) el.msg.textContent = message;
      render();
    }

    function startRun(mode) {
      stopRun();
      run.mode = mode;
      run.items = sequence();
      run.i = 0;
      run.mistakes = 0;
      run.wrong = new Set();
      run.startedAt = performance.now();
      el.msg.className = 's-msg';
      el.msg.textContent = mode === 'mic' ? '다음 음을 기타로 치기' : mode === 'click' ? '다음 음을 지판에서 누르기' : '';
      render();
      if (mode === 'listen') playNext();
    }

    function playNext() {
      if (run.mode !== 'listen') return;
      if (run.i >= run.items.length) { stopRun(''); return; }
      ctx.playTone(run.items[run.i].midi, 0, 0.9, 0.2);
      render();
      run.i++;
      run.timer = setTimeout(playNext, 60000 / st.bpm);
    }

    function accept() {
      run.i++;
      run.wrong = new Set();
      if (run.i < run.items.length) {
        el.msg.className = 's-msg';
        el.msg.textContent = `${run.i} / ${run.items.length}`;
        render();
        return;
      }
      // 완주
      const ms = performance.now() - run.startedAt;
      const prev = st.best[bestKey()];
      const record = run.mistakes === 0 && (!prev || ms < prev);
      if (record) { st.best[bestKey()] = Math.round(ms); save(); }
      const mode = run.mode;
      stopRun();
      el.msg.className = 's-msg good';
      el.msg.textContent = `완료 · ${run.items.length || sequence().length}음 · ${(ms / 1000).toFixed(1)}초 · 실수 ${run.mistakes}회` +
        (record ? ' · 최고 기록' : '');
      ctx.chime();
      render();
    }

    function miss(midi, text) {
      const key = `${run.i}:${midi}`;
      if (!run.wrong.has(key)) { run.wrong.add(key); run.mistakes++; }
      el.msg.className = 's-msg bad';
      el.msg.textContent = text;
    }

    // 마이크로 들은 음
    function onNote(midi) {
      if (run.mode !== 'mic') return;
      const item = run.items[run.i];
      if (midi === item.midi) { accept(); return; }
      const info = degreeInfo(midi % 12);
      miss(midi, `오답: ${ctx.noteNameWithOctave(midi)}${info ? '' : ' (스케일 밖)'} · 다음 음 ${nameOf(item.midi)}`);
    }

    // 지판을 누른 자리
    function onClick(s, f, midi) {
      if (run.mode !== 'click') return;
      const item = run.items[run.i];
      // 포지션 연습이면 정확한 자리, 지판 전체면 같은 높이의 음이면 인정
      const ok = st.pos >= 0 ? item.where.some((w) => w.s === s && w.f === f) : midi === item.midi;
      if (ok) { accept(); return; }
      miss(midi, midi === item.midi ? '같은 음, 다른 포지션' : `오답: ${s}번 줄 ${f}프렛 = ${ctx.noteName(midi % 12)} · 다음 음 ${nameOf(item.midi)}`);
    }

    function nameOf(midi) {
      const info = degreeInfo(midi % 12);
      return `${info ? info.name : ctx.noteName(midi % 12)}${Math.floor(midi / 12) - 1}`;
    }

    // ---------- 그리기 ----------
    function renderBoard() {
      const current = run.mode ? run.items[run.i] : null;
      const doneMidis = new Set(run.mode ? run.items.slice(0, run.i).map((it) => it.midi) : []);
      const marks = [];
      for (const c of cells()) {
        const info = degreeInfo(c.midi % 12);
        const isNext = current && current.midi === c.midi && (st.pos < 0 || current.where.some((w) => w.s === c.s && w.f === c.f));
        let cls;
        if (isNext && (run.mode === 'listen' || st.showPattern)) cls = 'next';
        else if (doneMidis.has(c.midi) && run.mode !== 'listen') cls = 'done';
        else if (!st.showPattern && run.mode && run.mode !== 'listen') continue; // 외워서 치기: 안 보여줌
        else cls = info.root ? 'root' : 'scale';
        // 한 음씩 넘어갈 때마다 전체 점이 다시 튀어나오지 않도록
        marks.push({ s: c.s, f: c.f, midi: c.midi, cls, still: !!run.mode, label: st.label === 'degree' ? info.degree : info.name });
      }
      ctx.renderBoard(marks);
    }

    function render() {
      if (!active) return;
      const sc = scale();
      el.name.textContent = `${FretChords.spellDegree(st.root, 0, 0, acc(), settings.naming)} ${sc.label}`;
      el.notes.innerHTML = sc.notes.map(([semi, step]) =>
        `<div class="tone found${semi === 0 ? ' root' : ''}"><small>${degreeLabel(semi, step)}</small>` +
        `<b>${FretChords.spellDegree(st.root, semi, step, acc(), settings.naming)}</b></div>`).join('');

      const current = run.mode && run.mode !== 'listen' ? run.items[run.i] : null;
      el.next.innerHTML = current
        ? `<small>다음 음</small><b>${nameOf(current.midi)}</b>${st.showPattern ? `<span>${where(current)}</span>` : ''}`
        : '';
      const best = st.best[bestKey()];
      el.best.textContent = best ? `최고 기록: ${(best / 1000).toFixed(1)}초 (실수 0회)` : '';

      el.listen.textContent = run.mode === 'listen' ? '■ 정지' : '▶ 듣기';
      el.click.classList.toggle('on', run.mode === 'click');
      el.mic.classList.toggle('on', run.mode === 'mic');
      el.stop.hidden = !run.mode || run.mode === 'listen';
      renderBoard();
    }

    function renderSelects() {
      el.root.innerHTML = [...Array(12).keys()].map((pc) =>
        `<option value="${pc}">${ctx.noteName(pc, ctx.accFor(pc, 'maj'))}</option>`).join('');
      el.type.innerHTML = Object.entries(SCALES).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join('');
      const n = positionCount(st.type);
      if (st.pos >= n) st.pos = 0;
      el.pos.innerHTML = [...Array(n).keys()].map((i) => {
        const frets = positionCells(st.root, st.type, i).map((c) => c.f);
        return `<option value="${i}">${i + 1}번 포지션 (${Math.min(...frets)}~${Math.max(...frets)}프렛)</option>`;
      }).join('') +
        '<option value="-1">지판 전체</option>';
      el.root.value = st.root;
      el.type.value = st.type;
      el.pos.value = st.pos;
      el.dir.value = st.dir;
      el.label.value = st.label;
      el.bpm.value = st.bpm;
      el.show.checked = st.showPattern;
    }

    // ---------- 이벤트 ----------
    el.bpm.innerHTML = [60, 80, 100, 120, 160, 200].map((b) => `<option value="${b}">${b} BPM</option>`).join('');
    const onSetting = () => {
      st.root = +el.root.value;
      st.type = el.type.value;
      st.pos = +el.pos.value;
      st.dir = el.dir.value;
      st.label = el.label.value;
      st.bpm = +el.bpm.value;
      st.showPattern = el.show.checked;
      save();
      renderSelects();
      if (run.mode) startRun(run.mode); // 바뀐 설정으로 처음부터
      else render();
    };
    [el.root, el.type, el.pos, el.dir, el.label, el.bpm, el.show].forEach((x) => x.addEventListener('change', onSetting));

    el.listen.addEventListener('click', () => (run.mode === 'listen' ? stopRun('') : startRun('listen')));
    el.click.addEventListener('click', () => startRun('click'));
    el.mic.addEventListener('click', async () => {
      try {
        await ctx.startMic();
        startRun('mic');
      } catch (err) {
        el.msg.className = 's-msg bad';
        el.msg.textContent = err.name === 'NotAllowedError'
          ? '마이크 권한 거부됨 (주소창의 권한 설정 확인)'
          : `마이크 오류: ${err.message}`;
      }
    });
    el.stop.addEventListener('click', () => stopRun('중지됨'));

    return {
      activate() { active = true; renderSelects(); el.msg.textContent = ''; render(); },
      deactivate() { stopRun(''); active = false; },
      render() { if (active) { renderSelects(); render(); } },
      onNote,
      onClick,
    };
  }

  global.FretScales = { init, SCALES, positionCells, positionCount };
})(window);

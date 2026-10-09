// 귀 훈련: 음정 맞히기, 코드 종류 맞히기, 들리는 음을 지판에서 찾기
(function (global) {
  'use strict';

  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const INTERVALS = [
    [1, '단2도', 'm2'], [2, '장2도', 'M2'], [3, '단3도', 'm3'], [4, '장3도', 'M3'],
    [5, '완전4도', 'P4'], [6, '증4도·감5도', 'TT'], [7, '완전5도', 'P5'], [8, '단6도', 'm6'],
    [9, '장6도', 'M6'], [10, '단7도', 'm7'], [11, '장7도', 'M7'], [12, '옥타브', 'P8'],
  ];
  const TASKS = {
    interval: '음정 맞히기',
    chord: '코드 종류 맞히기',
    find: '음 찾기 (지판)',
  };
  const NEXT_DELAY_MS = 1300;
  const rand = (n) => Math.floor(Math.random() * n);

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.ear || {};
    const st = {
      task: saved.task || 'interval',
      dir: saved.dir || 'up',
      intervals: saved.intervals || [3, 4, 5, 7, 12],
      types: saved.types || ['maj', 'min'],
    };
    let q = null;        // 현재 문제
    let active = false;
    let timer = 0;

    const $ = (id) => document.getElementById(id);
    const el = {
      task: $('e-task'), dir: $('e-dir'), dirField: $('e-dir-field'),
      pick: $('e-pick'), pickTitle: $('e-pick-title'),
      question: $('e-question'), replay: $('e-replay'), ref: $('e-ref'), giveup: $('e-giveup'),
      answers: $('e-answers'), msg: $('e-msg'),
    };

    function save() {
      settings.ear = { task: st.task, dir: st.dir, intervals: st.intervals, types: st.types };
      ctx.persist();
    }

    // ---------- 문제 ----------
    function next() {
      clearTimeout(timer);
      if (st.task === 'interval') {
        const iv = st.intervals[rand(st.intervals.length)];
        const dir = st.dir === 'mixed' ? ['up', 'down', 'together'][rand(3)] : st.dir;
        const low = 50 + rand(14);
        q = { kind: 'interval', answer: iv, dir, notes: [low, low + iv] };
        if (dir === 'down') q.notes.reverse();
      } else if (st.task === 'chord') {
        const type = st.types[rand(st.types.length)];
        const root = 48 + rand(12);
        q = { kind: 'chord', answer: type, root, notes: FretChords.TYPES[type].tones.map(([semi]) => root + semi) };
      } else {
        // 연습 범위 안의 한 자리
        const cells = [];
        for (const s of settings.strings) {
          for (let f = settings.fretMin; f <= settings.fretMax; f++) cells.push(OPEN_MIDI[s] + f);
        }
        const midi = cells[rand(cells.length)] ?? 52;
        q = { kind: 'find', answer: midi, notes: [midi] };
      }
      q.startedAt = performance.now();
      q.mistakes = 0;
      q.tried = new Set();
      q.done = false;
      el.msg.className = 'e-msg';
      el.msg.textContent = '';
      render();
      setTimeout(play, 250);
    }

    function play() {
      if (!q) return;
      if (q.kind === 'interval') {
        if (q.dir === 'together') q.notes.forEach((m) => ctx.playTone(m, 0, 1.6, 0.18));
        else q.notes.forEach((m, i) => ctx.playTone(m, i * 0.7, 1.2, 0.2));
      } else if (q.kind === 'chord') {
        q.notes.forEach((m, i) => ctx.playTone(m, i * 0.15, 1.2, 0.15));
        const t = q.notes.length * 0.15 + 0.15;
        q.notes.forEach((m) => ctx.playTone(m, t, 1.8, 0.12));
      } else {
        ctx.playTone(q.answer, 0, 1.6, 0.22);
      }
    }

    function describe() {
      if (q.kind === 'interval') {
        const [a, b] = q.notes;
        return `${ctx.noteNameWithOctave(a)} → ${ctx.noteNameWithOctave(b)} : ${INTERVALS.find((i) => i[0] === q.answer)[1]}`;
      }
      if (q.kind === 'chord') {
        const chord = FretChords.build(q.root % 12, q.answer, ctx.accFor(q.root % 12, q.answer), settings.naming);
        return `${chord.name} (${chord.tones.map((t) => t.name).join(' · ')})`;
      }
      const spots = Object.entries(OPEN_MIDI)
        .map(([s, open]) => [s, q.answer - open])
        .filter(([, f]) => f >= 0 && f <= 24)
        .map(([s, f]) => `${s}번 줄 ${f}프렛`);
      return `${ctx.noteNameWithOctave(q.answer)}: ${spots.join(', ')}`;
    }

    function correct() {
      q.done = true;
      const clean = q.mistakes === 0;
      ctx.score(true, clean, performance.now() - q.startedAt);
      el.msg.className = 'e-msg good';
      el.msg.textContent = `정답 · ${describe()}`;
      if (q.kind === 'find') showAnswerOnBoard('correct');
      render();
      timer = setTimeout(next, NEXT_DELAY_MS + (q.kind === 'find' ? 600 : 0));
    }

    function wrong(id, text) {
      if (!q.tried.has(id)) {
        q.tried.add(id);
        q.mistakes++;
        ctx.score(false);
      }
      el.msg.className = 'e-msg bad';
      el.msg.textContent = text;
      render();
    }

    function answer(value) {
      if (!q || q.done) return;
      if (value === q.answer) correct();
      else wrong(value, '오답');
    }

    function giveUp() {
      if (!q || q.done) return;
      q.done = true;
      if (!q.mistakes) ctx.score(false);
      el.msg.className = 'e-msg reveal';
      el.msg.textContent = `정답: ${describe()}`;
      if (q.kind === 'find') showAnswerOnBoard('hint');
      play();
      render();
      timer = setTimeout(next, NEXT_DELAY_MS + 1200);
    }

    // 음 찾기: 지판을 누른 자리
    function onClick(s, f, midi) {
      if (!q || q.done || q.kind !== 'find') return;
      if (midi === q.answer) { correct(); return; }
      const diff = q.answer - midi;
      const hint = diff > 0 ? `정답은 ${diff}반음 위` : `정답은 ${-diff}반음 아래`;
      wrong(midi, `오답: ${s}번 줄 ${f}프렛 (${ctx.noteNameWithOctave(midi)}) · ${hint}`);
    }

    function showAnswerOnBoard(cls) {
      const marks = [];
      for (const [s, open] of Object.entries(OPEN_MIDI)) {
        const f = q.answer - open;
        if (f >= 0 && f <= 24) marks.push({ s: +s, f, midi: q.answer, cls });
      }
      ctx.renderBoard(marks);
    }

    // ---------- 그리기 ----------
    function renderPick() {
      if (st.task === 'interval') {
        el.pickTitle.textContent = '출제 음정';
        el.pick.innerHTML = INTERVALS.map(([n, name]) =>
          `<label><input type="checkbox" value="${n}"${st.intervals.includes(n) ? ' checked' : ''}>${name}</label>`).join('');
      } else if (st.task === 'chord') {
        el.pickTitle.textContent = '출제 코드 종류';
        el.pick.innerHTML = Object.entries(FretChords.TYPES).map(([id, t]) =>
          `<label><input type="checkbox" value="${id}"${st.types.includes(id) ? ' checked' : ''}>${t.label}</label>`).join('');
      } else {
        el.pickTitle.textContent = '';
        el.pick.innerHTML = '<span class="e-note">줄·프렛 범위: 아래 설정</span>';
      }
    }

    function render() {
      if (!active) return;
      el.task.value = st.task;
      el.dir.value = st.dir;
      el.dirField.hidden = st.task !== 'interval';
      el.ref.hidden = st.task !== 'find';
      el.question.textContent = st.task === 'interval' ? '음정은?'
        : st.task === 'chord' ? '코드 종류는?' : '들리는 음을 지판에서 누르기';

      if (!q || q.kind === 'find') {
        el.answers.innerHTML = '';
      } else {
        const options = q.kind === 'interval'
          ? st.intervals.slice().sort((a, b) => a - b).map((n) => [n, INTERVALS.find((i) => i[0] === n)[1]])
          : st.types.map((t) => [t, `${FretChords.TYPES[t].label} <small>${typeHint(t)}</small>`]);
        el.answers.innerHTML = options.map(([v, label]) => {
          const cls = q.done && v === q.answer ? 'right' : q.tried.has(v) ? 'tried' : '';
          return `<button type="button" class="${cls}" data-v="${v}">${label}</button>`;
        }).join('');
      }
      if (!q || q.kind !== 'find' || !q.done) ctx.renderBoard([]);
    }

    function typeHint(t) {
      return { maj: '메이저', min: '마이너', dom7: '도미넌트7', maj7: '메이저7', min7: '마이너7', sus2: '', sus4: '', dim: '디미니시', aug: '오그먼트', m7b5: '하프디미니시' }[t] || '';
    }

    // ---------- 이벤트 ----------
    el.task.innerHTML = Object.entries(TASKS).map(([id, t]) => `<option value="${id}">${t}</option>`).join('');
    el.task.addEventListener('change', () => { st.task = el.task.value; save(); renderPick(); next(); });
    el.dir.addEventListener('change', () => { st.dir = el.dir.value; save(); next(); });
    el.pick.addEventListener('change', () => {
      const picked = [...el.pick.querySelectorAll('input:checked')].map((i) => i.value);
      if (!picked.length) { renderPick(); return; } // 최소 하나는 유지
      if (st.task === 'interval') st.intervals = picked.map(Number);
      else st.types = picked;
      save();
      next();
    });
    el.answers.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      answer(q.kind === 'interval' ? +b.dataset.v : b.dataset.v);
    });
    el.replay.addEventListener('click', play);
    el.ref.addEventListener('click', () => ctx.playTone(57, 0, 1.4, 0.2)); // A3 기준음
    el.giveup.addEventListener('click', giveUp);

    return {
      activate() { active = true; renderPick(); next(); },
      deactivate() { clearTimeout(timer); active = false; q = null; },
      render() { if (active) render(); },
      replay: play,
      giveUp,
      onClick,
    };
  }

  global.FretEar = { init };
})(window);

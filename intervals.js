// 지판 위 음정 모양: 근음에서 3도·5도·옥타브 … 자리를 찾는 퀴즈 + 모양 지도
(function (global) {
  'use strict';

  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const NAMES = ['완전1도', '단2도', '장2도', '단3도', '장3도', '완전4도', '증4도·감5도', '완전5도', '단6도', '장6도', '단7도', '장7도', '옥타브'];
  const SHORT = ['R', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7', '8'];
  const rand = (n) => Math.floor(Math.random() * n);

  // 음정 종류별 색: 근음/옥타브 주황, 3도 초록, 5도 파랑, 나머지 회색
  function intervalCls(iv) {
    const k = ((iv % 12) + 12) % 12;
    if (k === 0) return 'root';
    if (k === 3 || k === 4) return 'tone';
    if (k === 7) return 'hint';
    return 'scale';
  }

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.interval || {};
    const st = {
      mode: saved.mode || 'quiz',
      picks: saved.picks || [3, 4, 5, 7, 12],
      dir: saved.dir || 'up',
      root: saved.root || { s: 5, f: 3 },
      only: saved.only ?? false,
    };
    let q = null;
    let active = false;
    let timer = 0;

    const $ = (id) => document.getElementById(id);
    const el = {
      modes: $('i-modes'), picks: $('i-picks'), dir: $('i-dir'), dirField: $('i-dir-field'), only: $('i-only'), onlyField: $('i-only-field'),
      prompt: $('i-prompt'), msg: $('i-msg'), skip: $('i-skip'),
    };

    function save() {
      settings.interval = { ...st };
      ctx.persist();
    }

    const midiAt = (s, f) => OPEN_MIDI[s] + f;
    const maxFret = () => Math.max(12, settings.fretMax);

    // 이 높이의 음이 나는 자리들
    function cellsOf(midi) {
      const out = [];
      for (const s of [1, 2, 3, 4, 5, 6]) {
        const f = midi - OPEN_MIDI[s];
        if (f >= 0 && f <= maxFret()) out.push({ s, f, midi });
      }
      return out;
    }

    // ---------- 퀴즈 ----------
    function next() {
      clearTimeout(timer);
      for (let tries = 0; tries < 50; tries++) {
        const s = settings.strings[rand(settings.strings.length)];
        const f = settings.fretMin + rand(settings.fretMax - settings.fretMin + 1);
        const iv = st.picks[rand(st.picks.length)];
        const down = st.dir === 'down' || (st.dir === 'both' && Math.random() < 0.5);
        const root = midiAt(s, f);
        const target = root + (down ? -iv : iv);
        if (!cellsOf(target).length) continue; // 지판 밖이면 다시
        q = { s, f, root, iv, down, target, tried: new Set(), mistakes: 0, done: false, wrongMarks: [], startedAt: performance.now() };
        break;
      }
      el.msg.className = 'e-msg';
      el.msg.textContent = '';
      render();
    }

    function onClick(s, f, midi) {
      if (st.mode === 'map') {
        st.root = { s, f };
        save();
        render();
        return;
      }
      if (!q || q.done) return;
      if (midi === q.target) {
        q.done = true;
        ctx.score(true, q.mistakes === 0, performance.now() - q.startedAt);
        el.msg.className = 'e-msg good';
        const shape = cellsOf(q.target).map((c) => `${c.s}번 줄 ${c.f}프렛`).join(', ');
        el.msg.textContent = `정답! ${ctx.noteNameWithOctave(q.target)} — 이 음은 ${shape}에도 있어요`;
        render();
        timer = setTimeout(next, 1800);
        return;
      }
      const key = `${s}:${f}`;
      if (!q.tried.has(key)) {
        q.tried.add(key);
        q.mistakes++;
        ctx.score(false);
        q.wrongMarks.push({ s, f, midi });
      }
      // 틀린 자리가 근음에서 무슨 음정인지 알려주면 다음에 도움이 됨
      const d = midi - q.root;
      const iv = Math.abs(d);
      const what = iv <= 12 ? `${NAMES[iv]} ${d === 0 ? '' : d > 0 ? '위' : '아래'}` : `${iv}반음 ${d > 0 ? '위' : '아래'}`;
      el.msg.className = 'e-msg bad';
      el.msg.textContent = `그 자리는 근음에서 ${what.trim()}예요`;
      render();
    }

    function giveUp() {
      if (!q || q.done || st.mode !== 'quiz') return;
      q.done = true;
      if (!q.mistakes) ctx.score(false);
      el.msg.className = 'e-msg reveal';
      el.msg.textContent = `정답: ${ctx.noteNameWithOctave(q.target)}`;
      render(true);
      timer = setTimeout(next, 2200);
    }

    // ---------- 그리기 ----------
    function render(reveal = false) {
      if (!active) return;
      el.modes.innerHTML = [['quiz', '퀴즈'], ['map', '모양 보기']].map(([id, label]) =>
        `<button type="button" data-mode="${id}" class="${id === st.mode ? 'on' : ''}">${label}</button>`).join('');
      el.picks.innerHTML = NAMES.slice(1).map((name, k) =>
        `<label><input type="checkbox" value="${k + 1}"${st.picks.includes(k + 1) ? ' checked' : ''}>${name}</label>`).join('');
      el.dir.value = st.dir;
      el.only.checked = st.only;
      el.dirField.hidden = st.mode !== 'quiz';
      el.onlyField.hidden = st.mode !== 'map';
      el.skip.hidden = st.mode !== 'quiz';

      if (st.mode === 'map') {
        const root = midiAt(st.root.s, st.root.f);
        el.prompt.innerHTML = `근음 <b>${ctx.noteNameWithOctave(root)}</b> (${st.root.s}번 줄 ${st.root.f}프렛) 둘레의 음정 — 지판을 누르면 근음이 바뀌어요`;
        const marks = [];
        for (const s of [1, 2, 3, 4, 5, 6]) {
          for (let f = Math.max(0, st.root.f - 5); f <= Math.min(maxFret(), st.root.f + 5); f++) {
            const iv = midiAt(s, f) - root;
            if (iv < -12 || iv > 12) continue;
            const k = ((iv % 12) + 12) % 12 || (iv === 0 ? 0 : 12);
            if (st.only && iv !== 0 && !st.picks.includes(Math.abs(iv) === 12 ? 12 : k)) continue;
            const label = iv === 0 ? 'R' : SHORT[Math.abs(iv) === 12 ? 12 : k];
            marks.push({ s, f, midi: midiAt(s, f), label: iv < 0 && label !== 'R' ? `${label}` : label, cls: iv === 0 ? 'root' : intervalCls(iv), still: true });
          }
        }
        ctx.renderBoard(marks);
        return;
      }

      if (!q) { ctx.renderBoard([]); return; }
      el.prompt.innerHTML = `<b>${ctx.noteNameWithOctave(q.root)}</b>에서 <b>${NAMES[q.iv]} ${q.down ? '아래' : '위'}</b> 음을 찍으세요`;
      const marks = [{ s: q.s, f: q.f, midi: q.root, label: 'R', cls: 'root', still: true }];
      q.wrongMarks.forEach((m) => marks.push({ ...m, cls: 'wrong', still: true }));
      if (q.done || reveal) {
        cellsOf(q.target).forEach((c) => marks.push({ ...c, label: SHORT[q.iv], cls: reveal ? 'hint' : 'correct' }));
      }
      ctx.renderBoard(marks);
    }

    // ---------- 이벤트 ----------
    el.modes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      st.mode = b.dataset.mode;
      save();
      if (st.mode === 'quiz') next(); else { clearTimeout(timer); el.msg.textContent = ''; render(); }
    });
    el.picks.addEventListener('change', () => {
      const picked = [...el.picks.querySelectorAll('input:checked')].map((i) => +i.value);
      if (picked.length) st.picks = picked;
      save();
      if (st.mode === 'quiz') next(); else render();
    });
    el.dir.addEventListener('change', () => { st.dir = el.dir.value; save(); next(); });
    el.only.addEventListener('change', () => { st.only = el.only.checked; save(); render(); });
    el.skip.addEventListener('click', giveUp);

    return {
      activate() { active = true; if (st.mode === 'quiz') next(); else render(); },
      deactivate() { clearTimeout(timer); active = false; },
      render() { if (active) render(); },
      onClick,
      giveUp,
    };
  }

  global.FretIntervals = { init };
})(window);

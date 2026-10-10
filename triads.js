// 트라이어드: 줄 세트별 기본형·1전위·2전위 지도 + 지판 찍기 퀴즈
(function (global) {
  'use strict';

  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const QUALITIES = {
    maj: { label: 'M (메이저)', semis: [0, 4, 7] },
    min: { label: 'm (마이너)', semis: [0, 3, 7] },
    dim: { label: 'dim', semis: [0, 3, 6] },
    aug: { label: 'aug', semis: [0, 4, 8] },
  };
  const ROLES = ['R', '3', '5'];
  // 줄 세트: 낮은 줄 → 높은 줄
  const SETS = { 123: [3, 2, 1], 234: [4, 3, 2], 345: [5, 4, 3], 456: [6, 5, 4] };
  const INVERSIONS = [
    { label: '기본형', order: [0, 1, 2], cls: 'inv0' },  // R 3 5 (베이스가 근음)
    { label: '1전위', order: [1, 2, 0], cls: 'inv1' },   // 3 5 R
    { label: '2전위', order: [2, 0, 1], cls: 'inv2' },   // 5 R 3
  ];
  const MAX_FRET = 15;
  const rand = (n) => Math.floor(Math.random() * n);

  /** 줄 세트 위의 밀집 배치(한 옥타브 안) 자리를 모두 찾기 */
  function voicings(rootPc, quality, setId, inv) {
    const strings = SETS[setId];
    const order = INVERSIONS[inv].order;
    const pcs = order.map((k) => (rootPc + QUALITIES[quality].semis[k]) % 12);
    const out = [];
    for (let f0 = 0; f0 <= MAX_FRET; f0++) {
      const bass = OPEN_MIDI[strings[0]] + f0;
      if (bass % 12 !== pcs[0]) continue;
      const midis = [bass];
      for (let k = 1; k < 3; k++) {
        const prev = midis[k - 1];
        midis.push(prev + (((pcs[k] - prev) % 12) + 12) % 12 || prev + 12);
      }
      const cells = midis.map((m, k) => ({ s: strings[k], f: m - OPEN_MIDI[strings[k]], midi: m, role: ROLES[order[k]] }));
      const frets = cells.map((c) => c.f);
      if (frets.some((f) => f < 0 || f > MAX_FRET + 2)) continue;
      if (Math.max(...frets) - Math.min(...frets) > 4) continue; // 한 손으로 잡을 수 있는 폭
      out.push(cells);
    }
    return out;
  }

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.triad || {};
    const st = {
      mode: saved.mode || 'map',
      root: saved.root ?? 0,
      quality: saved.quality || 'maj',
      set: saved.set || '234',
      show: saved.show ?? -1,          // -1 = 세 가지 모두
      label: saved.label || 'role',
      qQualities: saved.qQualities || ['maj', 'min'],
      qSets: saved.qSets || ['123', '234', '345', '456'],
    };
    let q = null;
    let picked = new Map(); // 줄 → {s, f, midi}
    let active = false;
    let timer = 0;

    const $ = (id) => document.getElementById(id);
    const el = {
      modes: $('t-modes'), mapCtl: $('t-map-ctl'), quizCtl: $('t-quiz-ctl'),
      root: $('t-root'), quality: $('t-quality'), set: $('t-set'), show: $('t-show'), label: $('t-label'),
      qQualities: $('t-q-qualities'), qSets: $('t-q-sets'),
      prompt: $('t-prompt'), msg: $('t-msg'), skip: $('t-skip'), legend: $('t-legend'),
    };

    function save() {
      settings.triad = { ...st };
      ctx.persist();
    }

    const typeOf = (quality) => quality; // chords.js의 코드 종류 id와 같음
    const chordOf = (root, quality) => FretChords.build(root, typeOf(quality), ctx.accFor(root, typeOf(quality)), settings.naming);
    const setLabel = (id) => id.split('').join('·') + '번 줄';
    const nameOf = (chord, role) => chord.tones[ROLES.indexOf(role)].name;

    // ---------- 퀴즈 ----------
    function next() {
      clearTimeout(timer);
      const quality = st.qQualities[rand(st.qQualities.length)];
      const set = st.qSets[rand(st.qSets.length)];
      const inv = rand(3);
      const root = rand(12);
      q = { root, quality, set, inv, answers: voicings(root, quality, set, inv), mistakes: 0, done: false, startedAt: performance.now() };
      picked = new Map();
      el.msg.className = 'e-msg';
      el.msg.textContent = '';
      render();
    }

    function onClick(s, f, midi) {
      if (st.mode !== 'quiz' || !q || q.done) return;
      const strings = SETS[q.set];
      if (!strings.includes(s)) {
        el.msg.className = 'e-msg bad';
        el.msg.textContent = `${setLabel(q.set)}에서만`;
        return;
      }
      picked.set(s, { s, f, midi });
      el.msg.className = 'e-msg';
      el.msg.textContent = `${picked.size} / 3`;
      if (picked.size === 3) check();
      render();
    }

    function check() {
      const mine = SETS[q.set].map((s) => picked.get(s));
      const hit = q.answers.some((v) => v.every((c, k) => c.f === mine[k].f));
      if (hit) {
        q.done = true;
        ctx.score(true, q.mistakes === 0, performance.now() - q.startedAt);
        el.msg.className = 'e-msg good';
        el.msg.textContent = '정답';
        timer = setTimeout(next, 1600);
        return;
      }
      q.mistakes++;
      ctx.score(false);
      // 무엇을 잡았는지 알려주기
      const chord = chordOf(q.root, q.quality);
      const pcs = mine.map((c) => c.midi % 12);
      const roleOf = (pc) => ROLES.find((r, k) => (q.root + QUALITIES[q.quality].semis[k]) % 12 === pc);
      const roles = pcs.map(roleOf);
      let why;
      if (roles.some((r) => !r)) why = `${chord.name} 구성음 아님`;
      else if (new Set(roles).size < 3) why = `${roles.join('·')} (구성음 누락)`;
      else {
        const inv = INVERSIONS.findIndex((x) => x.order.every((k, i) => ROLES[k] === roles[i]));
        why = inv >= 0 ? `${INVERSIONS[inv].label} (아래부터 ${roles.join('·')})` : `아래부터 ${roles.join('·')} (밀집 배치 아님)`;
      }
      el.msg.className = 'e-msg bad';
      el.msg.textContent = `오답: ${why}`;
      picked = new Map();
    }

    function giveUp() {
      if (st.mode !== 'quiz' || !q || q.done) return;
      q.done = true;
      if (!q.mistakes) ctx.score(false);
      el.msg.className = 'e-msg reveal';
      el.msg.textContent = '정답 표시';
      render(true);
      timer = setTimeout(next, 2600);
    }

    // ---------- 그리기 ----------
    function markOf(c, chord, cls) {
      return { s: c.s, f: c.f, midi: c.midi, cls, still: true, label: st.label === 'role' ? c.role : nameOf(chord, c.role) };
    }

    function render(reveal = false) {
      if (!active) return;
      el.modes.innerHTML = [['map', '보기'], ['quiz', '퀴즈']].map(([id, label]) =>
        `<button type="button" data-mode="${id}" class="${id === st.mode ? 'on' : ''}">${label}</button>`).join('');
      el.mapCtl.hidden = st.mode !== 'map';
      el.quizCtl.hidden = st.mode !== 'quiz';
      el.skip.hidden = st.mode !== 'quiz';
      el.root.value = st.root;
      el.quality.value = st.quality;
      el.set.value = st.set;
      el.show.value = st.show;
      el.label.value = st.label;
      el.qQualities.querySelectorAll('input').forEach((i) => { i.checked = st.qQualities.includes(i.value); });
      el.qSets.querySelectorAll('input').forEach((i) => { i.checked = st.qSets.includes(i.value); });

      if (st.mode === 'map') {
        const chord = chordOf(st.root, st.quality);
        el.prompt.innerHTML = `<b>${chord.name}</b> · ${setLabel(st.set)} · ${chord.tones.map((t) => `${t.role} ${t.name}`).join(', ')}`;
        const marks = [];
        INVERSIONS.forEach((inv, k) => {
          if (st.show !== -1 && st.show !== k) return;
          voicings(st.root, st.quality, st.set, k).forEach((v) => v.forEach((c) => marks.push(markOf(c, chord, inv.cls))));
        });
        ctx.renderBoard(marks);
        return;
      }

      if (!q) { ctx.renderBoard([]); return; }
      const chord = chordOf(q.root, q.quality);
      el.prompt.innerHTML = `<b>${chord.name}</b> · <b>${INVERSIONS[q.inv].label}</b> · ${setLabel(q.set)}`;
      if (ctx.learn()) {
        // 학습 모드: 구성음 설명 + 전위 설명
        const roleName = (r) => (r === 'R' ? '근음' : r.includes('3') ? '3음' : '5음');
        const order = INVERSIONS[q.inv].order.map((k) => chord.tones[k]);
        const lines = FretChords.explain(q.root, q.quality, ctx.accFor(q.root, q.quality), settings.naming)
          .concat(`${INVERSIONS[q.inv].label}: 맨 아래 ${roleName(order[0].role)}(${order[0].name}) → 아래부터 ${order.map((t) => t.name).join('·')}`);
        el.prompt.innerHTML += `<div class="prompt-explain">${lines.map((l) => `<div>${l}</div>`).join('')}</div>`;
      }
      const marks = [...picked.values()].map((c) => ({ ...c, cls: 'hint', still: true, label: '?' }));
      // 정답이 12프렛 너머에만 있을 수도 있으니 지판을 그만큼 늘려 둠
      marks.push({ cls: 'spacer', f: Math.max(...q.answers.flat().map((c) => c.f)) });
      if (q.done || reveal) {
        q.answers.forEach((v) => v.forEach((c) => marks.push(markOf(c, chord, reveal ? 'hint' : INVERSIONS[q.inv].cls))));
      } else if (ctx.learn()) {
        q.answers.forEach((v) => v.forEach((c) => marks.push(markOf(c, chord, 'hint')))); // 학습 모드: 정답 자리 미리 표시
      }
      ctx.renderBoard(marks);
    }

    // ---------- 이벤트 ----------
    el.root.innerHTML = [...Array(12).keys()].map((pc) => `<option value="${pc}">${ctx.noteName(pc, ctx.accFor(pc, 'maj'))}</option>`).join('');
    el.quality.innerHTML = Object.entries(QUALITIES).map(([id, x]) => `<option value="${id}">${x.label}</option>`).join('');
    el.set.innerHTML = Object.keys(SETS).map((id) => `<option value="${id}">${setLabel(id)}</option>`).join('');
    el.show.innerHTML = '<option value="-1">전체</option>' + INVERSIONS.map((x, k) => `<option value="${k}">${x.label}만</option>`).join('');
    el.qQualities.innerHTML = Object.entries(QUALITIES).map(([id, x]) => `<label><input type="checkbox" value="${id}">${x.label}</label>`).join('');
    el.qSets.innerHTML = Object.keys(SETS).map((id) => `<label><input type="checkbox" value="${id}">${setLabel(id)}</label>`).join('');
    el.legend.innerHTML = INVERSIONS.map((x) => `<span><i class="lg lg-${x.cls}"></i>${x.label} (아래부터 ${x.order.map((k) => ROLES[k]).join('·')})</span>`).join('') +
      '<span>밀집 배치: 세 음이 한 옥타브·4프렛 안</span>';

    const onMap = () => {
      st.root = +el.root.value;
      st.quality = el.quality.value;
      st.set = el.set.value;
      st.show = +el.show.value;
      st.label = el.label.value;
      save();
      render();
    };
    [el.root, el.quality, el.set, el.show, el.label].forEach((x) => x.addEventListener('change', onMap));
    const onQuizPick = () => {
      const qs = [...el.qQualities.querySelectorAll('input:checked')].map((i) => i.value);
      const ss = [...el.qSets.querySelectorAll('input:checked')].map((i) => i.value);
      if (qs.length) st.qQualities = qs;
      if (ss.length) st.qSets = ss;
      save();
      next();
    };
    el.qQualities.addEventListener('change', onQuizPick);
    el.qSets.addEventListener('change', onQuizPick);
    el.modes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      st.mode = b.dataset.mode;
      save();
      el.msg.textContent = '';
      if (st.mode === 'quiz') next(); else { clearTimeout(timer); render(); }
    });
    el.skip.addEventListener('click', giveUp);

    return {
      activate() { active = true; if (st.mode === 'quiz') next(); else render(); },
      deactivate() { clearTimeout(timer); active = false; },
      render() { if (active) render(); },
      onClick,
      giveUp,
    };
  }

  global.FretTriads = { init, voicings, SETS, QUALITIES };
})(window);

// 코드 전환 챌린지: 두 코드를 정해진 시간 동안 번갈아 치고, 마이크로 전환 횟수를 셈
(function (global) {
  'use strict';

  const OPEN_MIDI = FretInst.open; // 현재 악기의 개방현 (instrument.js)
  const TYPES_WITH_OPEN = ['maj', 'min', 'dom7', 'maj7', 'min7', 'sus2', 'sus4'];
  const C = (rootPc, type) => ({ rootPc, type });
  // 자주 연습하는 짝
  const PRESETS = [
    [C(0, 'maj'), C(7, 'maj')], [C(7, 'maj'), C(2, 'maj')], [C(2, 'maj'), C(9, 'maj')], [C(9, 'min'), C(4, 'maj')],
    [C(0, 'maj'), C(9, 'min')], [C(4, 'min'), C(0, 'maj')], [C(7, 'maj'), C(4, 'min')], [C(9, 'maj'), C(4, 'maj')],
    [C(2, 'maj'), C(4, 'min')], [C(0, 'maj'), C(5, 'maj')], [C(9, 'min'), C(2, 'min')], [C(4, 'maj'), C(9, 'dom7')],
  ];
  const SETTLE = 8;   // 새로 친 뒤 이전 소리가 빠질 때까지 (약 0.2초)
  const STABLE = 4;   // 같은 판정이 이만큼 이어지면 인정
  const SILENCE = 10;

  const keyOf = (c) => `${c.rootPc}:${c.type}`;
  const pairKey = (a, b) => [keyOf(a), keyOf(b)].sort().join('|');

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.change || {};
    const st = {
      a: saved.a || C(0, 'maj'),
      b: saved.b || C(7, 'maj'),
      dur: saved.dur || 60,
    };
    const run = { on: false, counting: false, next: 0, count: 0, endAt: 0, timer: 0, splits: [], lastHitAt: 0 };
    const det = { armed: true, settle: 0, ok: 0, silent: 0, avg: 0 };
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      a: $('c-a'), b: $('c-b'), dur: $('c-dur'), presets: $('c-presets'),
      target: $('c-target'), count: $('c-count'), time: $('c-time'), msg: $('c-msg'),
      start: $('c-start'), best: $('c-best'), history: $('c-history'),
    };

    function save() {
      settings.change = { a: st.a, b: st.b, dur: st.dur };
      ctx.persist();
    }

    const build = (c) => FretChords.build(c.rootPc, c.type, ctx.accFor(c.rootPc, c.type), settings.naming);
    const chords = () => [st.a, st.b];

    function openChords() {
      const out = [];
      for (const type of TYPES_WITH_OPEN) {
        for (let r = 0; r < 12; r++) if (FretChords.shapeOf(r, type, 'open')) out.push(C(r, type));
      }
      return out;
    }

    // ---------- 진행 ----------
    async function start() {
      if (keyOf(st.a) === keyOf(st.b)) { msg('서로 다른 코드 선택', 'bad'); return; }
      try {
        await ctx.startMic();
      } catch (err) {
        msg(err.name === 'NotAllowedError' ? '마이크 권한 거부됨' : `마이크 오류: ${err.message}`, 'bad');
        return;
      }
      run.on = true;
      run.counting = false;
      run.next = 0;
      run.count = 0;
      run.splits = [];
      el.start.textContent = '■ 중지';
      // 3초 카운트다운 동안 첫 코드를 잡아 둠
      let n = 3;
      msg(`${build(st.a).name} 준비 · ${n}`);
      render();
      run.timer = setInterval(() => {
        n--;
        if (n > 0) { msg(`${build(st.a).name} 준비 · ${n}`); return; }
        clearInterval(run.timer);
        run.counting = true;
        run.endAt = performance.now() + st.dur * 1000;
        run.lastHitAt = 0;
        arm();
        msg('시작');
        run.timer = setInterval(tickTimer, 100);
        render();
      }, 1000);
    }

    function stop(message = '중지됨') {
      clearInterval(run.timer);
      const was = run.on;
      run.on = false;
      run.counting = false;
      if (was) ctx.stopMic();
      el.start.textContent = '시작 (마이크)';
      if (message) msg(message);
      render();
    }

    function tickTimer() {
      const left = Math.max(0, run.endAt - performance.now());
      el.time.textContent = Math.ceil(left / 1000);
      if (left <= 0) finish();
    }

    function finish() {
      const count = run.count;
      const key = pairKey(st.a, st.b);
      const history = FretLog.changes[key] || [];
      const best = Math.max(0, ...history.filter((h) => h.dur === st.dur).map((h) => h.n));
      FretLog.addChange(key, count, st.dur);
      stop('');
      const perMin = Math.round((count * 60) / st.dur);
      const avg = run.splits.length ? (run.splits.reduce((a, x) => a + x, 0) / run.splits.length / 1000).toFixed(2) : null;
      msg(`종료 · ${count}회 전환 (분당 ${perMin}회)${avg ? ` · 평균 ${avg}초` : ''}${count > best ? ' · 최고 기록' : ''}`, 'good');
      ctx.chime();
      render();
    }

    function msg(text, cls = '') {
      el.msg.textContent = text;
      el.msg.className = `e-msg ${cls}`;
    }

    // ---------- 소리 판정 (스트럼 인식과 같은 방식) ----------
    function arm() {
      det.armed = true;
      det.settle = det.silent >= SILENCE ? 0 : SETTLE;
      det.ok = 0;
    }

    function onFrame(level, chroma, loud, gate) {
      if (!run.counting) return;
      const prevAvg = det.avg;
      det.avg = det.avg * 0.7 + level * 0.3;
      if (!loud) {
        det.silent++;
        det.ok = 0;
        if (det.silent >= SILENCE) arm();
        return;
      }
      det.silent = 0;
      if (level > prevAvg * 1.8 && level > gate * 2) arm(); // 새로 친 소리
      if (!det.armed) return;
      if (det.settle > 0) { det.settle--; return; }
      const target = chords()[run.next];
      if (!FretChords.matches(chroma, target.rootPc, target.type)) { det.ok = 0; return; }
      if (++det.ok < STABLE) return;
      det.armed = false;
      hit();
    }

    function hit() {
      const now = performance.now();
      // 처음 잡은 코드는 출발점, 그다음부터 바꿀 때마다 1번
      if (run.lastHitAt) {
        run.count++;
        run.splits.push(now - run.lastHitAt);
      }
      run.lastHitAt = now;
      run.next = 1 - run.next;
      el.count.classList.remove('bump');
      void el.count.offsetWidth;
      el.count.classList.add('bump');
      render();
    }

    // ---------- 그리기 ----------
    function render() {
      if (!active) return;
      const list = openChords();
      const opt = (c) => `<option value="${keyOf(c)}">${build(c).name}</option>`;
      el.a.innerHTML = list.map(opt).join('');
      el.b.innerHTML = list.map(opt).join('');
      el.a.value = keyOf(st.a);
      el.b.value = keyOf(st.b);
      el.dur.value = st.dur;
      [el.a, el.b, el.dur].forEach((x) => { x.disabled = run.on; });
      el.presets.innerHTML = PRESETS.map(([a, b], i) =>
        `<button type="button" data-i="${i}" class="${pairKey(a, b) === pairKey(st.a, st.b) ? 'on' : ''}"${run.on ? ' disabled' : ''}>${build(a).name} ↔ ${build(b).name}</button>`).join('');

      const target = chords()[run.next];
      el.target.textContent = build(target).name;
      el.count.textContent = run.count;
      if (!run.counting) el.time.textContent = st.dur;

      // 지판: 다음에 칠 코드의 운지
      const shape = FretChords.shapeOf(target.rootPc, target.type, 'open');
      ctx.renderBoard(shape ? ctx.shapeMarks(build(target), shape, 'open') : []);
      renderHistory();
    }

    // 이 코드 짝의 지난 기록 (같은 시간 길이만, 분당 횟수로 비교)
    function renderHistory() {
      const all = FretLog.changes[pairKey(st.a, st.b)] || [];
      const pts = all.slice(-12).map((h) => ({ d: new Date(h.d), v: Math.round((h.n * 60) / h.dur), n: h.n, dur: h.dur }));
      const best = pts.length ? Math.max(...all.map((h) => Math.round((h.n * 60) / h.dur))) : 0;
      el.best.textContent = pts.length
        ? `${build(st.a).name} ↔ ${build(st.b).name} 최고: 분당 ${best}회 · 도전 ${all.length}회`
        : '기록 없음';
      if (pts.length < 2) { el.history.innerHTML = ''; return; }

      // 한 줄짜리 선 그래프: 단일 시리즈라 범례 없이 제목으로 이름을 붙임
      const narrow = window.matchMedia('(max-width: 640px)').matches; // 좁은 화면에선 글자가 작아지지 않게 좁은 좌표로
      const W = narrow ? 360 : 560, H = 160, L = 34, R = 12, T = 14, B = 26;
      const max = Math.ceil((Math.max(...pts.map((p) => p.v)) * 1.15) / 5) * 5 || 5; // 5 단위로 깔끔하게
      const x = (i) => L + (i * (W - L - R)) / (pts.length - 1);
      const y = (v) => T + (1 - v / max) * (H - T - B);
      const ticks = [0, Math.round(max / 2), Math.round(max)];
      const grid = ticks.map((t) => `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ch-axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join('');
      const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.v)}`).join('');
      const dots = pts.map((p, i) =>
        `<g class="ch-pt"><title>${p.d.getMonth() + 1}/${p.d.getDate()} · ${p.n}회 / ${p.dur}초 (분당 ${p.v}회)</title>` +
        `<rect x="${x(i) - 14}" y="${T}" width="28" height="${H - T - B}" fill="transparent"/>` +
        `<circle cx="${x(i)}" cy="${y(p.v)}" r="4.5"/></g>`).join('');
      const last = pts[pts.length - 1];
      el.history.innerHTML =
        `<div class="g-title">기록 <small>분당 전환 횟수 · 최근 ${pts.length}회</small></div>` +
        `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="코드 전환 기록 추이">${grid}` +
        `<path class="ch-line" d="${line}"/>${dots}` +
        `<text class="ch-label" x="${x(pts.length - 1)}" y="${y(last.v) - 10}" text-anchor="end">${last.v}</text></svg>`;
    }

    // ---------- 이벤트 ----------
    el.dur.innerHTML = [30, 60, 120].map((s) => `<option value="${s}">${s}초</option>`).join('');
    const parse = (v) => { const [r, t] = v.split(':'); return C(+r, t); };
    el.a.addEventListener('change', () => { st.a = parse(el.a.value); save(); render(); });
    el.b.addEventListener('change', () => { st.b = parse(el.b.value); save(); render(); });
    el.dur.addEventListener('change', () => { st.dur = +el.dur.value; save(); render(); });
    el.presets.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]');
      if (!btn) return;
      [st.a, st.b] = PRESETS[+btn.dataset.i];
      save();
      render();
    });
    el.start.addEventListener('click', () => (run.on ? stop() : start()));

    return {
      activate() { active = true; msg('코드 2개 선택 후 시작 (3초 카운트다운)'); render(); },
      deactivate() { stop(''); active = false; },
      render() { if (active) render(); },
      onFrame,
      onClick() {},
      toggle() { if (run.on) stop(); else start(); },
    };
  }

  global.FretChange = { init };
})(window);

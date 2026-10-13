// 테크닉: 피킹 / 해머링·풀링 / 핑거링 연습 (TAB + 피킹 방향 + 손가락 번호 + 소리)
(function (global) {
  'use strict';

  const OPEN_MIDI = FretInst.open; // 현재 악기의 개방현 (instrument.js)
  const CATS = { pick: '피킹', legato: '해머링·풀링', finger: '핑거링' };
  const UNIT_NAME = { 12: '8분음표', 8: '셋잇단', 6: '16분음표' };

  // ---------- 연습 만들기 ----------
  // S: 줄 번호, 낮은 줄 → 높은 줄 (기타 [6,5,4,3,2,1]). o: 기준 프렛에서 몇 칸 (0~3 = 검지~새끼)
  // 음 = { s, o, tech: 'h' | 'p' | null, pick: true(피킹한 음) }
  const n = (s, o, tech = null) => ({ s, o, tech, pick: !tech });
  const down = (S) => [...S].reverse();

  const EXERCISES = [
    // ----- 피킹 -----
    {
      id: 'chrom', cat: 'pick', name: '크로매틱 1234', unit: 6, alt: true,
      desc: '한 줄에 네 음, 한 손가락에 한 프렛. 다운·업을 엄격하게 번갈아.',
      make: (S) => [...S.flatMap((s) => [0, 1, 2, 3].map((o) => n(s, o))), ...down(S).flatMap((s) => [3, 2, 1, 0].map((o) => n(s, o)))],
    },
    {
      id: 'tremolo', cat: 'pick', name: '트레몰로 (한 음 연속)', unit: 6, alt: true,
      desc: '같은 음을 16분으로 네 번씩. 손목 힘을 빼고 피크 끝만 줄에 닿게.',
      make: (S) => [0, 2, 3, 2].flatMap((o) => Array(4).fill(0).map(() => n(S[S.length - 2] ?? S[0], o))),
    },
    {
      id: 'cross', cat: 'pick', name: '두 줄 넘나들기', unit: 6, alt: true,
      desc: '두 줄을 오가며 얼터네이트. 줄을 넘을 때 피크가 줄 사이에 끼지 않게.',
      make: (S) => {
        const out = [];
        for (let k = 0; k + 1 < S.length; k++) for (let r = 0; r < 2; r++) out.push(n(S[k], 0), n(S[k], 2), n(S[k + 1], 0), n(S[k + 1], 2));
        return out;
      },
    },
    {
      id: 'skip', cat: 'pick', name: '스트링 스키핑', unit: 6, alt: true,
      desc: '한 줄 건너뛰기. 건너뛰는 줄이 울리지 않게 왼손·오른손으로 뮤트.',
      make: (S) => {
        const out = [];
        for (let k = 0; k + 2 < S.length; k++) out.push(n(S[k], 0), n(S[k], 2), n(S[k + 2], 0), n(S[k + 2], 2));
        return out;
      },
    },
    {
      id: 'six', cat: 'pick', name: '셋잇단 피킹', unit: 8, alt: true,
      desc: '한 줄에 세 음 셋잇단. 박마다 시작 피킹이 다운·업으로 바뀜.',
      make: (S) => [...S.flatMap((s) => [0, 2, 3].map((o) => n(s, o))), ...down(S).flatMap((s) => [3, 2, 0].map((o) => n(s, o)))],
    },
    // ----- 해머링·풀링 -----
    {
      id: 'hammer', cat: 'legato', name: '해머링 (1 → 3)', unit: 12,
      desc: '검지로 피킹 후 약지로 해머링. 두 음 음량이 같게 세게 내려치기.',
      make: (S) => [...S, ...down(S)].flatMap((s) => [n(s, 0), n(s, 2, 'h')]),
    },
    {
      id: 'pull', cat: 'legato', name: '풀링 (3 → 1)', unit: 12,
      desc: '약지·검지를 같이 짚고 피킹 후 약지를 아래로 튕기듯 떼기.',
      make: (S) => [...S, ...down(S)].flatMap((s) => [n(s, 2), n(s, 0, 'p')]),
    },
    {
      id: 'trill', cat: 'legato', name: '트릴 (1-2, 1-3, 1-4)', unit: 6,
      desc: '첫 음만 피킹하고 해머링·풀링을 반복. 마디마다 쓰는 손가락이 바뀜.',
      make: (S) => {
        const s = S[Math.min(S.length - 1, Math.floor(S.length / 2))];
        return [1, 2, 3].flatMap((top) => Array(16).fill(0).map((_, k) => (k === 0 ? n(s, 0) : n(s, k % 2 ? top : 0, k % 2 ? 'h' : 'p'))));
      },
    },
    {
      id: 'legato3', cat: 'legato', name: '3음 레가토', unit: 8,
      desc: '올라갈 때 피킹-해머-해머, 내려올 때 피킹-풀-풀. 줄마다 한 번만 피킹.',
      make: (S) => [
        ...S.flatMap((s) => [n(s, 0), n(s, 2, 'h'), n(s, 3, 'h')]),
        ...down(S).flatMap((s) => [n(s, 3), n(s, 2, 'p'), n(s, 0, 'p')]),
      ],
    },
    // ----- 핑거링 -----
    {
      id: 'f1324', cat: 'finger', name: '순서 바꾸기 1-3-2-4', unit: 6, alt: true,
      desc: '손가락 순서를 섞어 독립성 기르기. 안 쓰는 손가락도 지판 가까이.',
      make: (S) => [...S, ...down(S)].flatMap((s) => [0, 2, 1, 3].map((o) => n(s, o))),
    },
    {
      id: 'f1243', cat: 'finger', name: '순서 바꾸기 1-2-4-3', unit: 6, alt: true,
      desc: '약지와 새끼 순서가 바뀌는 패턴. 새끼손가락이 늦지 않게.',
      make: (S) => [...S, ...down(S)].flatMap((s) => [0, 1, 3, 2].map((o) => n(s, o))),
    },
    {
      id: 'spider', cat: 'finger', name: '스파이더', unit: 6, alt: true,
      desc: '두 줄을 번갈아 1·2·3·4. 손가락을 떼지 않고 짚은 채로 넘어가기.',
      make: (S) => {
        const out = [];
        for (let k = 0; k + 1 < S.length; k++) out.push(n(S[k], 0), n(S[k + 1], 1), n(S[k], 2), n(S[k + 1], 3));
        for (let k = S.length - 1; k > 0; k--) out.push(n(S[k], 3), n(S[k - 1], 2), n(S[k], 1), n(S[k - 1], 0));
        return out;
      },
    },
    {
      id: 'shift', cat: 'finger', name: '포지션 이동', unit: 6, alt: true,
      desc: '1234를 치고 한 프렛씩 위로. 검지가 다음 자리로 미끄러지듯 이동.',
      make: (S) => {
        const s = S[S.length - 1];
        return [0, 1, 2, 3, 4, 3, 2, 1].flatMap((k) => [0, 1, 2, 3].map((o) => ({ ...n(s, o + k), finger: o + 1 })));
      },
    },
  ];

  // ---------- 소리: 카플러스-스트롱 (뜯는 줄 소리) ----------
  let ac = null;
  const cache = new Map();

  function audio() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function pluckBuffer(midi, soft) {
    const key = `${midi}:${soft ? 1 : 0}`;
    if (cache.has(key)) return cache.get(key);
    const ctx = audio();
    const sr = ctx.sampleRate;
    const freq = 440 * 2 ** ((midi - 69) / 12);
    const len = Math.floor(sr * 0.9);
    const buf = ctx.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const period = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(period);
    // 레가토 음은 고음이 적은 부드러운 시작
    let prev = 0;
    for (let i = 0; i < period; i++) {
      const r = Math.random() * 2 - 1;
      prev = soft ? prev * 0.7 + r * 0.3 : r;
      ring[i] = prev;
    }
    let p = 0;
    for (let i = 0; i < len; i++) {
      const next = (p + 1) % period;
      const v = ring[p];
      ring[p] = 0.996 * 0.5 * (ring[p] + ring[next]);
      d[i] = v;
      p = next;
    }
    cache.set(key, buf);
    return buf;
  }

  function pluck(midi, time, { soft = false, dur = 0.6 } = {}) {
    const ctx = audio();
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(midi, soft);
    const g = ctx.createGain();
    g.gain.setValueAtTime(soft ? 0.32 : 0.45, time);
    g.gain.setValueAtTime(soft ? 0.32 : 0.45, time + Math.max(0.02, dur - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, time + dur); // 다음 음이 나오면 앞 음은 멈춤 (같은 줄)
    src.connect(g).connect(ctx.destination);
    src.start(time);
    src.stop(time + dur + 0.02);
  }

  function click(time, accent) {
    const ctx = audio();
    const o = ctx.createOscillator();
    o.frequency.value = accent ? 1760 : 1320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    o.connect(g).connect(ctx.destination);
    o.start(time);
    o.stop(time + 0.04);
  }

  // ---------- 탭 ----------
  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.technique || {};
    const st = {
      cat: saved.cat || 'pick',
      id: saved.id || 'chrom',
      base: saved.base || 5,
      bpm: saved.bpm || 70,
      click: saved.click ?? true,
      ladder: saved.ladder ?? false,
      ladderStep: saved.ladderStep || 5,
      ladderMax: saved.ladderMax || 160,
      showPick: saved.showPick ?? true,
      showFinger: saved.showFinger ?? true,
      best: saved.best || {}, // { 'guitar:chrom': { bpm, date } }
    };
    let ex = null;      // 지금 연습 { def, notes }
    let active = false;
    const run = { on: false, timer: 0, idx: 0, loopStart: 0, visuals: [], cur: -1 };

    const $ = (id) => document.getElementById(id);
    const el = {
      cats: $('tq-cats'), list: $('tq-list'), base: $('tq-base'), showPick: $('tq-pick'), showFinger: $('tq-finger'),
      name: $('tq-name'), desc: $('tq-desc'), score: $('tq-score'), best: $('tq-best'), saveBest: $('tq-save'),
      play: $('tq-play'), bpm: $('tq-bpm'), down: $('tq-down'), up: $('tq-up'), click: $('tq-click'),
      ladder: $('tq-ladder'), ladderStep: $('tq-ladder-step'), ladderMax: $('tq-ladder-max'), legend: $('tq-legend'),
    };

    function save() {
      settings.technique = { ...st };
      ctx.persist();
    }

    const bestKey = () => `${FretInst.id}:${st.id}`;

    function build() {
      const def = EXERCISES.find((e) => e.id === st.id) || EXERCISES[0];
      const S = [...FretInst.strings].sort((a, b) => b - a); // 낮은 줄 → 높은 줄
      const notes = def.make(S).map((x, i) => {
        const f = st.base + x.o;
        // 얼터네이트는 음마다 다운·업 교대, 레가토는 피킹하는 음만 다운
        const pick = x.pick ? (def.alt && i % 2 ? 'U' : 'D') : null;
        return { ...x, f, midi: OPEN_MIDI[x.s] + f, finger: x.finger ?? x.o + 1, pickDir: pick, t: i * def.unit };
      });
      ex = { def, notes, total: notes.length * def.unit };
    }

    // ---------- 그리기 ----------
    // 두 마디씩 한 줄
    function drawTab() {
      const per = (24 / ex.def.unit) * 8;
      const out = [];
      for (let a = 0; a < ex.notes.length; a += per) out.push(drawLine(a, Math.min(ex.notes.length, a + per)));
      return out.join('');
    }

    function drawLine(from, to) {
      const N = FretInst.strings.length;
      const gap = 16, top = 44, left = 46, stepX = ex.def.unit === 12 ? 40 : 30;
      const beatNotes = 24 / ex.def.unit;
      const y = (s) => top + (s - 1) * gap;
      const bottom = y(N);
      const width = left + (24 / ex.def.unit) * 8 * stepX + 24; // 줄마다 같은 너비
      const rowPick = bottom + 24, rowFinger = bottom + (st.showPick ? 44 : 24);
      const height = rowFinger + (st.showFinger ? 10 : -10) + 8;
      const parts = [];
      const lastX = left + (to - from) * stepX + 8;
      for (let s = 1; s <= N; s++) parts.push(`<line class="tb-line" x1="8" x2="${lastX}" y1="${y(s)}" y2="${y(s)}"/>`);
      parts.push(`<line class="tb-bar" x1="8" x2="8" y1="${y(1)}" y2="${bottom}"/><line class="tb-bar" x1="${lastX}" x2="${lastX}" y1="${y(1)}" y2="${bottom}"/>`);
      ['T', 'A', 'B'].forEach((ch, k) => parts.push(`<text class="tb-clef" x="24" y="${(y(1) + bottom) / 2 + (k - 1) * 15 + 5}">${ch}</text>`));
      const xs = ex.notes.map((_, k) => left + (k - from) * stepX + stepX / 2);
      ex.notes.slice(from, to).forEach((nt, j) => {
        const k = from + j;
        const x = xs[k];
        // 마디선 (4박마다)
        if (k > from && k % (beatNotes * 4) === 0) parts.push(`<line class="tb-bar" x1="${x - stepX / 2}" x2="${x - stepX / 2}" y1="${y(1)}" y2="${bottom}"/>`);
        // 박 묶음 표시 (TAB 아래 짧은 빔)
        if (k % beatNotes === 0) {
          const x2 = xs[Math.min(to - 1, k + beatNotes - 1)];
          parts.push(`<line class="tq-beam" x1="${x - 4}" x2="${x2 + 4}" y1="${bottom + 9}" y2="${bottom + 9}"/>`);
        }
        const text = String(nt.f);
        const w = text.length * 9 + 6;
        const cur = k === run.cur ? ' cur' : '';
        parts.push(`<rect class="tb-bg${cur}" x="${x - w / 2}" y="${y(nt.s) - 9}" width="${w}" height="18" rx="4"/>`);
        parts.push(`<text class="tb-num${cur}" x="${x}" y="${y(nt.s) + 5}">${text}</text>`);
        // 해머링·풀링: 앞 음과 이어지는 호 + 글자
        if (nt.tech && k > from) {
          const x0 = xs[k - 1];
          const yTop = Math.min(y(nt.s), y(ex.notes[k - 1].s)) - 12;
          parts.push(`<path class="tq-slur" d="M${x0} ${yTop} Q${(x0 + x) / 2} ${yTop - 10} ${x} ${yTop}"/>`);
          parts.push(`<text class="tq-tech" x="${(x0 + x) / 2}" y="${yTop - 10}">${nt.tech}</text>`);
        }
        if (st.showPick && nt.pickDir) parts.push(`<text class="tq-pick ${nt.pickDir === 'D' ? 'd' : 'u'}${cur}" x="${x}" y="${rowPick}">${nt.pickDir === 'D' ? '⊓' : 'V'}</text>`);
        if (st.showFinger) parts.push(`<text class="tq-finger${cur}" x="${x}" y="${rowFinger}">${nt.finger}</text>`);
      });
      return `<svg viewBox="0 0 ${width} ${height}" style="width:${Math.round(width * 1.2)}px" role="img" aria-label="TAB 악보">${parts.join('')}</svg>`;
    }

    function renderBoard() {
      const seen = new Map();
      ex.notes.forEach((nt) => { if (!seen.has(`${nt.s}:${nt.f}`)) seen.set(`${nt.s}:${nt.f}`, nt); });
      const cur = ex.notes[run.cur];
      ctx.renderBoard([...seen.values()].map((nt) => ({
        s: nt.s, f: nt.f, midi: nt.midi, label: String(nt.finger), still: true,
        cls: cur && cur.s === nt.s && cur.f === nt.f ? 'next' : 'tq-pos',
      })));
    }

    function render() {
      if (!active) return;
      build();
      el.cats.innerHTML = Object.entries(CATS).map(([id, label]) =>
        `<button type="button" data-cat="${id}" class="${id === st.cat ? 'on' : ''}">${label}</button>`).join('');
      el.list.innerHTML = EXERCISES.filter((e) => e.cat === st.cat).map((e) =>
        `<button type="button" data-id="${e.id}" class="${e.id === st.id ? 'on' : ''}">${e.name}</button>`).join('');
      el.base.value = st.base;
      el.showPick.checked = st.showPick;
      el.showFinger.checked = st.showFinger;
      el.name.textContent = ex.def.name;
      el.desc.textContent = `${ex.def.desc} ${UNIT_NAME[ex.def.unit]}.`;
      el.score.innerHTML = drawTab();
      const best = st.best[bestKey()];
      el.best.textContent = best ? `최고 기록 ${best.bpm} BPM (${best.date})` : '최고 기록 없음';
      el.saveBest.textContent = `${st.bpm} BPM 성공 기록`;
      el.bpm.value = st.bpm;
      el.click.checked = st.click;
      el.ladder.checked = st.ladder;
      el.ladderStep.value = st.ladderStep;
      el.ladderMax.value = st.ladderMax;
      el.play.innerHTML = run.on ? '■ 정지 <kbd>Space</kbd>' : '▶ 재생 <kbd>Space</kbd>';
      el.legend.innerHTML =
        '<span>숫자 = 프렛, 맨 위 줄이 1번 줄</span>' +
        (st.showPick ? '<span><b>⊓</b> 다운 피킹 <b>V</b> 업 피킹</span>' : '') +
        (st.cat === 'legato' ? '<span><b>h</b> 해머링 <b>p</b> 풀링 (피킹 없이)</span>' : '') +
        (st.showFinger ? '<span>아래 숫자: 손가락 (1 검지 · 2 중지 · 3 약지 · 4 새끼)</span>' : '') +
        '<span>처음엔 느리게, 깨끗하게 되면 5 BPM씩</span>';
      renderBoard();
    }

    // 재생 중에는 커서만 다시 그림
    function highlight(i) {
      run.cur = i;
      el.score.querySelectorAll('.cur').forEach((e) => e.classList.remove('cur'));
      if (i < 0) { renderBoard(); return; }
      el.score.innerHTML = drawTab();
      renderBoard();
    }

    // ---------- 재생 ----------
    function schedule() {
      const actx = audio();
      let tickSec = 60 / st.bpm / 24;
      while (true) {
        if (run.idx >= ex.notes.length) {
          run.idx = 0;
          run.loopStart += ex.total * tickSec;
          if (st.ladder && st.bpm < st.ladderMax) {
            st.bpm = Math.min(st.ladderMax, st.bpm + st.ladderStep);
            el.bpm.value = st.bpm;
            el.saveBest.textContent = `${st.bpm} BPM 성공 기록`;
            save();
            tickSec = 60 / st.bpm / 24;
          }
        }
        const nt = ex.notes[run.idx];
        const time = run.loopStart + nt.t * tickSec;
        if (time > actx.currentTime + 0.15) return;
        const dur = Math.max(0.12, ex.def.unit * tickSec * 1.6);
        pluck(nt.midi, time, { soft: !!nt.tech, dur });
        if (st.click && nt.t % 24 === 0) click(time, nt.t % 96 === 0);
        const i = run.idx;
        run.visuals.push(setTimeout(() => highlight(i), Math.max(0, (time - actx.currentTime) * 1000)));
        run.idx++;
      }
    }

    function start() {
      const actx = audio();
      stop();
      build();
      run.on = true;
      run.idx = 0;
      run.loopStart = actx.currentTime + 0.15;
      schedule();
      run.timer = setInterval(schedule, 25);
      el.play.innerHTML = '■ 정지 <kbd>Space</kbd>';
    }

    function stop() {
      run.on = false;
      clearInterval(run.timer);
      run.visuals.forEach(clearTimeout);
      run.visuals = [];
      run.cur = -1;
      if (active) render();
    }

    function change(fn) {
      const wasOn = run.on;
      stop();
      fn();
      save();
      render();
      if (wasOn) start();
    }

    // 템포만 바꿀 때는 박 위치를 유지 (박이 튀지 않게)
    function setBpm(v) {
      const bpm = Math.max(30, Math.min(260, Math.round(+v || st.bpm)));
      if (run.on) {
        const pos = run.idx < ex.notes.length ? ex.notes[run.idx].t : ex.total;
        const at = run.loopStart + pos * (60 / st.bpm / 24);
        run.loopStart = at - pos * (60 / bpm / 24);
      }
      st.bpm = bpm;
      el.bpm.value = bpm;
      el.saveBest.textContent = `${bpm} BPM 성공 기록`;
      save();
    }

    // ---------- 이벤트 ----------
    el.base.innerHTML = Array.from({ length: 12 }, (_, k) => k + 1).map((f) => `<option value="${f}">${f}프렛부터</option>`).join('');
    el.ladderStep.innerHTML = [1, 2, 5, 10].map((v) => `<option value="${v}">+${v} BPM</option>`).join('');
    el.cats.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-cat]');
      if (b) change(() => { st.cat = b.dataset.cat; st.id = EXERCISES.find((x) => x.cat === st.cat).id; });
    });
    el.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (b) change(() => { st.id = b.dataset.id; });
    });
    el.base.addEventListener('change', () => { const v = +el.base.value; change(() => { st.base = v; }); });
    el.showPick.addEventListener('change', () => { st.showPick = el.showPick.checked; save(); if (!run.on) render(); });
    el.showFinger.addEventListener('change', () => { st.showFinger = el.showFinger.checked; save(); if (!run.on) render(); });
    el.play.addEventListener('click', () => (run.on ? stop() : start()));
    el.bpm.addEventListener('change', () => setBpm(el.bpm.value));
    el.down.addEventListener('click', () => setBpm(st.bpm - 5));
    el.up.addEventListener('click', () => setBpm(st.bpm + 5));
    el.click.addEventListener('change', () => { st.click = el.click.checked; save(); });
    el.ladder.addEventListener('change', () => { st.ladder = el.ladder.checked; save(); });
    el.ladderStep.addEventListener('change', () => { st.ladderStep = +el.ladderStep.value; save(); });
    el.ladderMax.addEventListener('change', () => {
      st.ladderMax = Math.max(30, Math.min(260, +el.ladderMax.value || 160));
      el.ladderMax.value = st.ladderMax;
      save();
    });
    el.saveBest.addEventListener('click', () => {
      const prev = st.best[bestKey()];
      if (!prev || st.bpm > prev.bpm) {
        const d = new Date();
        st.best = { ...st.best, [bestKey()]: { bpm: st.bpm, date: `${d.getMonth() + 1}/${d.getDate()}` } };
        save();
        ctx.chime();
      }
      el.best.textContent = `최고 기록 ${st.best[bestKey()].bpm} BPM (${st.best[bestKey()].date})`;
    });

    return {
      activate() { active = true; render(); },
      deactivate() { stop(); active = false; },
      render() { if (active && !run.on) render(); },
      toggle() { if (run.on) stop(); else start(); },
      onClick() {}, // 지판을 누르면 소리만 (app.js에서 재생)
    };
  }

  global.FretTechnique = { init, EXERCISES };
})(window);

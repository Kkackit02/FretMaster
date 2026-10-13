// 테크닉: 피킹 / 해머링·풀링 / 핑거링 연습 (TAB + 피킹 방향 + 손가락 번호 + 소리)
(function (global) {
  'use strict';

  const OPEN_MIDI = FretInst.open; // 현재 악기의 개방현 (instrument.js)
  const CATS = { pick: '피킹', legato: '해머링·풀링', finger: '핑거링', slide: '슬라이드', bend: '벤딩', pm: '팜뮤트', mute: '뮤트' };
  const UNIT_NAME = { 12: '8분음표', 8: '셋잇단', 6: '16분음표' };

  // ---------- 연습 만들기 ----------
  // S: 줄 번호, 낮은 줄 → 높은 줄 (기타 [6,5,4,3,2,1]). o: 기준 프렛에서 몇 칸 (0~3 = 검지~새끼)
  // 음 = { s, o, tech: 'h' | 'p' | 's'(슬라이드) | null, pick: true(피킹한 음), len: 길이(기본 1칸),
  //        bend: 올리는 반음 수, release: 벤딩 후 원래대로, pm: 팜뮤트, dead: 뮤트 음(x), stacc: 짧게 끊기 }
  const n = (s, o, tech = null, more = {}) => ({ s, o, tech, pick: !tech, ...more });
  const top3 = (S) => S.slice(-3); // 높은 세 줄 (벤딩은 주로 1~3번 줄)
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
    // ----- 슬라이드 -----
    {
      id: 'slide2', cat: 'slide', name: '슬라이드 (2프렛)', unit: 12,
      desc: '약지로 짚고 피킹한 뒤 누른 채로 두 프렛 미끄러지기. 도착음도 또렷하게.',
      make: (S) => [
        ...S.flatMap((s) => [n(s, 0, null, { finger: 3 }), n(s, 2, 's', { finger: 3 })]),
        ...down(S).flatMap((s) => [n(s, 2, null, { finger: 3 }), n(s, 0, 's', { finger: 3 })]),
      ],
    },
    {
      id: 'slideshift', cat: 'slide', name: '슬라이드로 포지션 이동', unit: 12,
      desc: '스케일을 치다 약지 슬라이드로 위 포지션으로 옮겨 감. 내려올 때도 같은 손가락으로.',
      make: (S) => {
        const pair = top3(S).slice(0, 2);
        return pair.flatMap((s) => [
          n(s, 0, null, { finger: 1 }), n(s, 2, null, { finger: 3 }), n(s, 4, 's', { finger: 3 }), n(s, 5, null, { finger: 4 }),
          n(s, 5, null, { finger: 4 }), n(s, 4, null, { finger: 3 }), n(s, 2, 's', { finger: 3 }), n(s, 0, null, { finger: 1 }),
        ]);
      },
    },
    {
      id: 'slidein', cat: 'slide', name: '슬라이드 인·아웃', unit: 12,
      desc: '두 프렛 아래에서 미끄러져 들어가고(인), 치고 나서 아래로 빠져나오기(아웃).',
      make: (S) => top3(S).flatMap((s) => [
        n(s, 0, null, { finger: 3, len: 0.5 }), n(s, 2, 's', { finger: 3, len: 1.5 }),
        n(s, 2, null, { finger: 3, len: 1.5 }), n(s, 0, 's', { finger: 3, len: 0.5 }),
      ]),
    },
    // ----- 벤딩 -----
    {
      id: 'bendhalf', cat: 'bend', name: '반음 벤딩', unit: 12,
      desc: '목표음(한 프렛 위)을 먼저 치고, 같은 높이까지 약지로 밀어 올리기. 중지·검지로 받쳐서.',
      make: (S) => top3(S).flatMap((s) => [n(s, 3, null, { finger: 4, len: 2 }), n(s, 2, null, { finger: 3, len: 2, bend: 1 })]),
    },
    {
      id: 'bendfull', cat: 'bend', name: '온음 벤딩', unit: 12,
      desc: '목표음(두 프렛 위)을 먼저 듣고 맞추기. 손가락이 아니라 손목을 돌려서 올리기.',
      make: (S) => top3(S).flatMap((s) => [n(s, 4, null, { finger: 4, len: 2 }), n(s, 2, null, { finger: 3, len: 2, bend: 2 })]),
    },
    {
      id: 'bendrel', cat: 'bend', name: '벤딩 & 릴리즈', unit: 12,
      desc: '온음 올렸다가 피킹 없이 천천히 원래 음으로 내리기. 이어서 풀링.',
      make: (S) => top3(S).flatMap((s) => [n(s, 2, null, { finger: 3, len: 3, bend: 2, release: true }), n(s, 0, 'p', { finger: 1, len: 1 })]),
    },
    // ----- 팜뮤트 -----
    {
      id: 'pm8', cat: 'pm', name: '팜뮤트 8분', unit: 12,
      desc: '오른손 날을 브리지 바로 앞 줄에 살짝 얹고 다운으로만. 뮤트 없는 음과 차이가 나게.',
      make: (S) => Array(2).fill(0).flatMap(() => [0, 0, 0, 1, 0, 0, 1, 0].map((open) => n(S[0], 0, null, { pm: !open }))),
    },
    {
      id: 'gallop', cat: 'pm', name: '갤럽 (8분 + 16분 둘)', unit: 6, alt: true,
      desc: '"따 다다" 리듬을 팜뮤트로. 다운-다운-업, 박마다 첫 음이 커지지 않게.',
      make: (S) => Array(8).fill(0).flatMap(() => [n(S[0], 0, null, { pm: true, len: 2 }), n(S[0], 0, null, { pm: true }), n(S[0], 0, null, { pm: true })]),
    },
    {
      id: 'pmriff', cat: 'pm', name: '팜뮤트 리프', unit: 6, alt: true,
      desc: '낮은 줄은 뮤트, 높은 음은 손을 떼고 크게. 손날을 붙였다 뗐다 빠르게.',
      make: (S) => Array(4).fill(0).flatMap(() => [
        n(S[0], 0, null, { pm: true }), n(S[0], 0, null, { pm: true }), n(S[1], 2, null, { finger: 3 }), n(S[0], 0, null, { pm: true }),
        n(S[0], 0, null, { pm: true }), n(S[1], 0, null, { finger: 1 }), n(S[0], 0, null, { pm: true }), n(S[1], 3, null, { finger: 4 }),
      ]),
    },
    // ----- 뮤트 -----
    {
      id: 'dead', cat: 'mute', name: '뮤트 음 (데드 노트)', unit: 6, alt: true,
      desc: 'x는 왼손을 줄에 살짝 얹어 "칙" 소리만. 오른손은 16분으로 계속 움직이기.',
      make: (S) => {
        const s = S[Math.max(0, S.length - 3)];
        return Array(2).fill(0).flatMap(() => [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0].map((on) => n(s, 2, null, { finger: 3, dead: !on })));
      },
    },
    {
      id: 'stacc', cat: 'mute', name: '끊어 치기 (스타카토)', unit: 12,
      desc: '치자마자 왼손 힘을 빼 소리를 끊기. 줄에서 손가락을 떼지는 말고 압력만 풀기.',
      make: (S) => [...S, ...down(S)].flatMap((s) => [n(s, 0, null, { stacc: true }), n(s, 2, null, { stacc: true })]),
    },
    {
      id: 'skipmute', cat: 'mute', name: '안 치는 줄 막기', unit: 6, alt: true,
      desc: '줄을 건너뛸 때 사이 줄이 울리지 않게: 왼손 검지 끝과 오른손 날로 나머지 줄 막기.',
      make: (S) => {
        const out = [];
        for (let k = 0; k + 3 < S.length; k++) out.push(n(S[k], 0), n(S[k + 3], 2), n(S[k], 2), n(S[k + 3], 0));
        return out.concat(out.slice().reverse());
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

  let noise = null;

  // 뮤트 음: 음높이 없는 짧은 '칙'
  function deadNote(time) {
    const ctx = audio();
    if (!noise) {
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1400;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(time);
  }

  /**
   * 줄 소리 한 번.
   * bend: 올릴 반음 수, release: 올렸다 내리기, slideFrom: 이 높이에서 미끄러져 옴, pm: 팜뮤트
   */
  function pluck(midi, time, { soft = false, dur = 0.6, bend = 0, release = false, slideFrom = null, pm = false } = {}) {
    const ctx = audio();
    const src = ctx.createBufferSource();
    src.buffer = pluckBuffer(midi, soft);
    const rate = src.playbackRate;
    if (slideFrom !== null) {
      rate.setValueAtTime(2 ** ((slideFrom - midi) / 12), time);
      rate.linearRampToValueAtTime(1, time + Math.min(0.12, dur * 0.4));
    }
    if (bend) {
      const up = 2 ** (bend / 12);
      rate.setValueAtTime(1, time + 0.03);
      rate.linearRampToValueAtTime(up, time + Math.min(0.25, dur * 0.3));
      if (release) {
        rate.setValueAtTime(up, time + dur * 0.55);
        rate.linearRampToValueAtTime(1, time + dur * 0.85);
      }
    }
    let level = soft ? 0.32 : 0.45;
    let node = src;
    if (pm) {
      // 팜뮤트: 고음을 깎고 짧게
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      node = src.connect(lp);
      dur = Math.min(dur, 0.16);
      level = 0.7;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, time);
    g.gain.setValueAtTime(level, time + Math.max(0.02, dur - 0.04));
    g.gain.linearRampToValueAtTime(0.0001, time + dur); // 다음 음이 나오면 앞 음은 멈춤 (같은 줄)
    node.connect(g).connect(ctx.destination);
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
      bendBox: $('tq-bendbox'), bendMic: $('tq-bendmic'), bendNote: $('tq-bendnote'), bendNeedle: $('tq-bendneedle'), bendMsg: $('tq-bendmsg'),
    };

    function save() {
      settings.technique = { ...st };
      ctx.persist();
    }

    const bestKey = () => `${FretInst.id}:${st.id}`;

    function build() {
      const def = EXERCISES.find((e) => e.id === st.id) || EXERCISES[0];
      const S = [...FretInst.strings].sort((a, b) => b - a); // 낮은 줄 → 높은 줄
      let t = 0;
      const notes = def.make(S).map((x) => {
        const f = st.base + x.o;
        const ticks = (x.len || 1) * def.unit;
        // 얼터네이트는 칸 위치로 다운·업 (16분 칸의 앞이 다운), 나머지는 피킹하는 음만 다운
        const pick = x.pick ? (def.alt && Math.round(t / def.unit) % 2 ? 'U' : 'D') : null;
        const nt = { ...x, f, midi: OPEN_MIDI[x.s] + f, finger: x.finger ?? x.o + 1, pickDir: pick, t, ticks };
        t += ticks;
        return nt;
      });
      ex = { def, notes, total: t };
    }

    // ---------- 그리기 ----------
    // 두 마디씩 한 줄
    const LINE_TICKS = 192;

    function drawTab() {
      const lines = [];
      ex.notes.forEach((nt, k) => {
        const li = Math.floor(nt.t / LINE_TICKS);
        (lines[li] ||= []).push(k);
      });
      const most = Math.max(...lines.filter(Boolean).map((l) => l.reduce((a, k) => a + slots(ex.notes[k]), 0)));
      return lines.filter(Boolean).map((ks) => drawLine(ks, most)).join('');
    }

    const BEND_LABEL = { 1: '½', 2: 'full' };
    const slots = (nt) => Math.max(1, nt.len || 1); // 긴 음은 자리를 더 차지

    function drawLine(ks, most) {
      const N = FretInst.strings.length;
      const gap = 16, top = 52, left = 46, stepX = ex.def.unit === 12 ? 40 : 30;
      const y = (s) => top + (s - 1) * gap;
      const bottom = y(N);
      const width = left + most * stepX + 24; // 줄마다 같은 너비
      const rowPick = bottom + 24, rowFinger = bottom + (st.showPick ? 44 : 24);
      const height = rowFinger + (st.showFinger ? 10 : -10) + 8;
      const parts = [];
      const lastX = left + ks.reduce((a, k) => a + slots(ex.notes[k]), 0) * stepX + 8;
      for (let s = 1; s <= N; s++) parts.push(`<line class="tb-line" x1="8" x2="${lastX}" y1="${y(s)}" y2="${y(s)}"/>`);
      parts.push(`<line class="tb-bar" x1="8" x2="8" y1="${y(1)}" y2="${bottom}"/><line class="tb-bar" x1="${lastX}" x2="${lastX}" y1="${y(1)}" y2="${bottom}"/>`);
      ['T', 'A', 'B'].forEach((ch, k) => parts.push(`<text class="tb-clef" x="24" y="${(y(1) + bottom) / 2 + (k - 1) * 15 + 5}">${ch}</text>`));
      const xOf = new Map();
      let cx = left;
      ks.forEach((k) => { xOf.set(k, cx + stepX / 2); cx += slots(ex.notes[k]) * stepX; });

      // 박 묶음 (TAB 아래 짧은 빔)
      const beats = new Map();
      ks.forEach((k) => {
        const b = Math.floor(ex.notes[k].t / 24);
        (beats.get(b) || beats.set(b, []).get(b)).push(k);
      });
      for (const group of beats.values()) {
        if (group.length < 2) continue; // 한 박에 한 음이면 빔 없음
        parts.push(`<line class="tq-beam" x1="${xOf.get(group[0]) - 4}" x2="${xOf.get(group[group.length - 1]) + 4}" y1="${bottom + 9}" y2="${bottom + 9}"/>`);
      }

      // 팜뮤트 구간: 위에 P.M. ----
      let run0 = null;
      const flushPM = (endK) => {
        if (run0 === null) return;
        const x0 = xOf.get(run0) - 8, x1 = xOf.get(endK) + 8;
        parts.push(`<text class="tq-tech pm" x="${x0}" y="${y(1) - 20}">P.M.</text>`);
        if (x1 - x0 > 34) parts.push(`<line class="tq-pmline" x1="${x0 + 30}" x2="${x1}" y1="${y(1) - 24}" y2="${y(1) - 24}"/>`);
        run0 = null;
      };
      ks.forEach((k, j) => {
        if (ex.notes[k].pm) { if (run0 === null) run0 = k; } else flushPM(ks[j - 1]);
      });
      flushPM(ks[ks.length - 1]);

      ks.forEach((k, j) => {
        const nt = ex.notes[k];
        const x = xOf.get(k);
        // 마디선
        if (j > 0 && nt.t % 96 === 0) parts.push(`<line class="tb-bar" x1="${x - stepX / 2}" x2="${x - stepX / 2}" y1="${y(1)}" y2="${bottom}"/>`);
        const text = nt.dead ? 'x' : String(nt.f);
        const w = text.length * 9 + 6;
        const cur = k === run.cur ? ' cur' : '';
        parts.push(`<rect class="tb-bg${cur}" x="${x - w / 2}" y="${y(nt.s) - 9}" width="${w}" height="18" rx="4"/>`);
        parts.push(`<text class="tb-num${cur}${nt.dead ? ' dead' : ''}" x="${x}" y="${y(nt.s) + 5}">${text}</text>`);
        if (nt.stacc) parts.push(`<circle class="tq-dot" cx="${x}" cy="${y(nt.s) + 13}" r="2"/>`);
        // 해머링·풀링: 앞 음과 이어지는 호 + 글자 / 슬라이드: 비스듬한 선
        if (nt.tech && j > 0) {
          const prev = ex.notes[ks[j - 1]];
          const x0 = xOf.get(ks[j - 1]);
          if (nt.tech === 's') {
            const upward = nt.midi > prev.midi;
            const yy = y(nt.s);
            parts.push(`<line class="tq-slide" x1="${x0 + 9}" y1="${yy + (upward ? 5 : -5)}" x2="${x - 9}" y2="${yy + (upward ? -5 : 5)}"/>`);
            parts.push(`<text class="tq-tech" x="${(x0 + x) / 2}" y="${yy - 13}">sl.</text>`);
          } else {
            const yTop = Math.min(y(nt.s), y(prev.s)) - 12;
            parts.push(`<path class="tq-slur" d="M${x0} ${yTop} Q${(x0 + x) / 2} ${yTop - 10} ${x} ${yTop}"/>`);
            parts.push(`<text class="tq-tech" x="${(x0 + x) / 2}" y="${yTop - 10}">${nt.tech}</text>`);
          }
        }
        // 벤딩: 위로 휘는 화살표 + ½ / full (릴리즈면 다시 내려오는 화살표)
        if (nt.bend) {
          const yy = y(nt.s) - 4, tipY = y(1) - 30;
          const x1 = x + 8, x2 = x + 16;
          parts.push(`<path class="tq-bend" d="M${x1} ${yy} Q${x2} ${yy} ${x2} ${tipY + 6}"/>`);
          parts.push(`<path class="tq-arrow" d="M${x2 - 4} ${tipY + 8} L${x2} ${tipY} L${x2 + 4} ${tipY + 8} Z"/>`);
          parts.push(`<text class="tq-tech" x="${x2}" y="${tipY - 4}">${BEND_LABEL[nt.bend] || nt.bend}</text>`);
          if (nt.release) {
            const x3 = x2 + 14;
            parts.push(`<path class="tq-bend" d="M${x2 + 2} ${tipY + 4} Q${x3} ${tipY + 4} ${x3} ${yy - 6}"/>`);
            parts.push(`<path class="tq-arrow" d="M${x3 - 4} ${yy - 12} L${x3} ${yy - 4} L${x3 + 4} ${yy - 12} Z"/>`);
          }
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
      el.bendBox.hidden = st.cat !== 'bend';
      if (st.cat !== 'bend' && bendMic.stream) stopBendMic();
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
        (st.cat === 'legato' || st.id === 'bendrel' ? '<span><b>h</b> 해머링 <b>p</b> 풀링 (피킹 없이)</span>' : '') +
        (st.cat === 'slide' ? '<span><b>sl.</b> 슬라이드: 누른 채로 미끄러지기 (도착음은 피킹 없이)</span>' : '') +
        (st.cat === 'bend' ? '<span><b>↑ ½ · full</b> 반음 · 온음 벤딩, <b>↓</b> 릴리즈</span><span>앞 음 = 벤딩 목표음</span>' : '') +
        (st.cat === 'pm' ? '<span><b>P.M.</b> 팜뮤트 구간 (선이 끝날 때까지)</span>' : '') +
        (st.cat === 'mute' ? '<span><b>x</b> 뮤트 음 (음 없이 \'칙\')</span><span><b>·</b> 짧게 끊기</span>' : '') +
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
        const dur = Math.max(0.12, nt.ticks * tickSec * (nt.stacc ? 0.35 : nt.bend ? 1 : 1.6));
        const prev = ex.notes[(run.idx - 1 + ex.notes.length) % ex.notes.length];
        if (nt.dead) deadNote(time);
        else {
          pluck(nt.midi, time, {
            soft: nt.tech === 'h' || nt.tech === 'p', dur, bend: nt.bend || 0, release: !!nt.release, pm: !!nt.pm,
            slideFrom: nt.tech === 's' ? prev.midi : null,
          });
        }
        if (st.click) {
          for (let b = Math.ceil(nt.t / 24) * 24; b < nt.t + nt.ticks; b += 24) click(run.loopStart + b * tickSec, b % 96 === 0);
        }
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

    // ---------- 벤딩 음정 확인 ----------
    // 마이크로 들은 높이를 이 연습의 벤딩 목표음과 비교 (센트 단위)
    const bendMic = { stream: null, ctx: null, an: null, buf: null, raf: 0 };

    function bendTargets() {
      return ex ? [...new Set(ex.notes.filter((x) => x.bend).map((x) => x.midi + x.bend))] : [];
    }

    async function startBendMic() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const actx = new (window.AudioContext || window.webkitAudioContext)();
      const an = actx.createAnalyser();
      an.fftSize = 4096;
      actx.createMediaStreamSource(stream).connect(an);
      Object.assign(bendMic, { stream, ctx: actx, an, buf: new Float32Array(an.fftSize) });
      el.bendMic.textContent = '마이크 끄기';
      el.bendMic.classList.add('on');
      const loop = () => {
        bendMic.raf = requestAnimationFrame(loop);
        an.getFloatTimeDomainData(bendMic.buf);
        if (FretPitch.rms(bendMic.buf) < 0.01) return;
        const r = FretPitch.detect(bendMic.buf, actx.sampleRate, 0.15, FretInst.minFreq);
        if (r) showBend(FretPitch.freqToMidi(r.freq));
      };
      loop();
    }

    function stopBendMic() {
      cancelAnimationFrame(bendMic.raf);
      bendMic.stream?.getTracks().forEach((tr) => tr.stop());
      bendMic.ctx?.close();
      Object.assign(bendMic, { stream: null, ctx: null, an: null });
      el.bendMic.textContent = '마이크로 벤딩 확인';
      el.bendMic.classList.remove('on');
      el.bendNeedle.style.opacity = 0;
    }

    function showBend(m) {
      const targets = bendTargets();
      if (!targets.length) return;
      // 가장 가까운 목표음 (벤딩 전 음부터 목표까지 오르는 중이어도 그 목표로)
      const target = targets.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a));
      const cents = Math.round((m - target) * 100);
      el.bendNote.textContent = `목표 ${ctx.noteNameWithOctave(target)} · 지금 ${ctx.noteNameWithOctave(Math.round(m))}`;
      el.bendNeedle.style.opacity = 1;
      el.bendNeedle.style.left = `${50 + Math.max(-50, Math.min(50, cents / 2))}%`;
      const ok = Math.abs(cents) <= 15;
      el.bendNeedle.style.background = ok ? 'var(--good)' : 'var(--accent)';
      if (Math.abs(cents) > 120) { el.bendMsg.className = 'e-msg'; el.bendMsg.textContent = '목표에서 멂'; return; }
      el.bendMsg.className = `e-msg ${ok ? 'good' : 'bad'}`;
      el.bendMsg.textContent = ok ? `정확 (${cents >= 0 ? '+' : ''}${cents}센트)` : cents < 0 ? `${-cents}센트 덜 올라감` : `${cents}센트 너무 올라감`;
    }

    el.bendMic.addEventListener('click', async () => {
      if (bendMic.stream) { stopBendMic(); return; }
      try {
        await startBendMic();
      } catch (err) {
        el.bendMsg.className = 'e-msg bad';
        el.bendMsg.textContent = err.name === 'NotAllowedError' ? '마이크 권한 거부됨 (주소창의 권한 설정 확인)' : `마이크 오류: ${err.message}`;
      }
    });

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
      deactivate() { stop(); stopBendMic(); active = false; },
      render() { if (active && !run.on) render(); },
      toggle() { if (run.on) stop(); else start(); },
      onClick() {}, // 지판을 누르면 소리만 (app.js에서 재생)
    };
  }

  global.FretTechnique = { init, EXERCISES };
})(window);

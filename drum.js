// 드럼 루디먼트: 한 줄 보표 악보 + 스네어 소리로 들려주기
(function (global) {
  'use strict';

  // 길이 → 틱 (4분음표 = 24틱이라 셋잇단·여섯잇단·32분음표가 모두 정수)
  const TICKS = { 4: 24, 8: 12, 16: 6, 32: 3, '8t': 8, '16t': 4 };
  const BEAMS = { 24: 0, 12: 1, 8: 1, 6: 2, 4: 2, 3: 3 };
  const TUPLET = { 8: 3, 4: 6 };

  // 토큰: [꾸밈음(소문자)][손 R·L 또는 발 K][>액센트][:길이]  예) lR>  llR  R>:8  K  /  unit = 기본 길이
  const RUDIMENTS = [
    { id: 'single', cat: '롤', name: '싱글 스트로크 롤', unit: 16, pattern: 'R L R L R L R L',
      desc: '양손을 번갈아 한 번씩. 모든 루디먼트의 기본이라 두 손 소리 크기를 똑같이 맞추는 게 목표예요.' },
    { id: 'double', cat: '롤', name: '더블 스트로크 롤', unit: 16, pattern: 'R R L L R R L L',
      desc: '한 손으로 두 번씩. 두 번째 타는 손목이 아니라 튕겨 나오는 힘(리바운드)으로 쳐서 첫 타와 크기를 맞춰요.' },
    { id: 'five', cat: '롤', name: '파이브 스트로크 롤', unit: 32, pattern: 'R R L L R>:8 L L R R L>:8',
      desc: '더블 두 번 뒤 액센트 한 번. 더블은 작게, 마지막 액센트는 크게 대비를 줘요.' },
    { id: 'seven', cat: '롤', name: '세븐 스트로크 롤', unit: '16t', pattern: 'R R L L R R L>:4 L L R R L L R>:4',
      desc: '더블 세 번 뒤 액센트. 더블이 고르게 이어지는지 들어 보세요.' },

    { id: 'para', cat: '패러디들', name: '싱글 패러디들', unit: 16, pattern: 'R> L R R L> R L L',
      desc: '싱글 두 번 + 더블 한 번 (RLRR LRLL). 첫 음 액센트가 손을 바꿔 가며 나와요. 그루브와 필인에 가장 많이 쓰여요.' },
    { id: 'dpara', cat: '패러디들', name: '더블 패러디들', unit: '16t', pattern: 'R> L R L R R L> R L R L L',
      desc: '싱글 네 번 + 더블 한 번. 여섯잇단으로 한 박에 6개씩.' },
    { id: 'tpara', cat: '패러디들', name: '트리플 패러디들', unit: 16, pattern: 'R> L R L R L R R L> R L R L R L L',
      desc: '싱글 여섯 번 + 더블 한 번. 액센트가 두 박마다 손을 바꿔요.' },
    { id: 'pdd', cat: '패러디들', name: '패러디들-디들', unit: '16t', pattern: 'R> L R R L L R> L R R L L',
      desc: '싱글 두 번 + 더블 두 번 (RLRRLL). 같은 손으로 시작해서 손 바꿈 없이 반복돼요.' },

    { id: 'flam', cat: '플램', name: '플램', unit: 4, pattern: 'lR rL lR rL',
      desc: '작은 꾸밈음(약하게, 낮은 높이)과 주음(세게, 높은 높이)을 거의 동시에. "플-램" 하고 두 소리가 살짝 벌어져 들리면 좋아요.' },
    { id: 'flamtap', cat: '플램', name: '플램 탭', unit: 16, pattern: 'lR R rL L lR R rL L',
      desc: '플램 뒤에 같은 손으로 한 번 더. 플램 주음을 친 손이 바로 탭을 쳐요.' },
    { id: 'flamacc', cat: '플램', name: '플램 액센트', unit: '8t', pattern: 'lR> L R rL> R L',
      desc: '셋잇단 첫 음에 플램 + 액센트. 손이 박마다 바뀌어요.' },
    { id: 'flamacue', cat: '플램', name: '플라마큐', unit: 16, pattern: 'lR L> R L lR:4',
      desc: '두 번째 음에 액센트가 오는 게 특징. 처음과 끝은 플램.' },
    { id: 'flampara', cat: '플램', name: '플램 패러디들', unit: 16, pattern: 'lR> L R R rL> R L L',
      desc: '싱글 패러디들의 첫 음을 플램으로.' },
    { id: 'swiss', cat: '플램', name: '스위스 아미 트리플렛', unit: '8t', pattern: 'lR R L lR R L',
      desc: '플램 + 같은 손 + 반대 손. 같은 손으로 계속 시작해서 빠르게 치기 좋아요.' },

    { id: 'drag', cat: '드래그', name: '드래그 (러프)', unit: 4, pattern: 'llR rrL llR rrL',
      desc: '같은 손 꾸밈음 두 개(더블처럼 튕겨서) + 반대 손 주음. 꾸밈음은 아주 작게.' },

    { id: 'rlk', cat: '손발 조합', name: '손손발 셋잇단 (RLK)', unit: '8t', pattern: 'R> L K R> L K',
      desc: '오른손-왼손-킥을 셋잇단으로. 필인과 솔로에서 가장 많이 쓰는 손발 조합이에요. 킥이 손만큼 또렷하게 들리게.' },
    { id: 'rlrk', cat: '손발 조합', name: 'RLRK', unit: 16, pattern: 'R> L R K R> L R K',
      desc: '16분음표 네 개 중 마지막을 킥으로. 박의 첫 음이 항상 오른손이라 박자를 잡기 쉬워요.' },
    { id: 'rllk', cat: '손발 조합', name: 'RLLK', unit: 16, pattern: 'R> L L K R> L L K',
      desc: '오른손 하나, 왼손 더블, 킥. 왼손 더블이 고르게 나오는지 들어 보세요.' },
    { id: 'rklk', cat: '손발 조합', name: 'RKLK', unit: 16, pattern: 'R> K L K R> K L K',
      desc: '손 사이마다 킥. 킥이 16분음표 뒷박마다 들어가서 발 연습에 좋아요.' },
    { id: 'gospel', cat: '손발 조합', name: '가스펠 식스 (RLRLKK)', unit: '16t', pattern: 'R> L R L K K R> L R L K K',
      desc: '여섯잇단으로 손 네 번 + 킥 두 번. 가스펠·퓨전 드러머들이 즐겨 쓰는 빠른 필인 패턴이에요.' },
  ];

  // 기존 루디먼트 밑에 깔 킥 위치
  const KICK_MODES = {
    none: '킥 없음',
    beat: '매 박 (4분음표)',
    half: '1·3박',
    accent: '액센트마다',
  };

  function applyKick(notes, mode) {
    for (const n of notes) {
      n.kick = n.hand !== 'K' && (
        (mode === 'beat' && n.t % 24 === 0) ||
        (mode === 'half' && n.t % 48 === 0) ||
        (mode === 'accent' && n.accent));
    }
    return notes;
  }

  function parse(r) {
    let t = 0;
    return r.pattern.split(/\s+/).map((tok) => {
      const m = tok.match(/^([rl]*)([RLK])(>?)(?::(\w+))?$/);
      const ticks = TICKS[m[4] || r.unit];
      const note = { graces: m[1].toUpperCase(), hand: m[2], accent: !!m[3], ticks, t };
      t += ticks;
      return note;
    });
  }

  // ---------- 악보 그리기 ----------
  const LINE_Y = 60;
  const KICK_Y = LINE_Y + 13; // 킥은 줄 아래
  const STEM_TOP = 20;

  function head(x, y, scale = 1, cls = '') {
    return `<ellipse class="${cls}" cx="${x}" cy="${y}" rx="${6.2 * scale}" ry="${4.4 * scale}" transform="rotate(-20 ${x} ${y})"/>`;
  }

  function drawScore(notes) {
    const totalTicks = notes.reduce((a, n) => a + n.ticks, 0);
    const beats = totalTicks / 24;
    const parts = [];
    let x = 92;
    for (const n of notes) {
      x += n.graces.length ? 12 + n.graces.length * 13 : 0;
      n.x = x;
      x += 24 + n.ticks * 1.7;
    }
    const width = x + 30;

    // 보표, 박자표, 반복 기호
    parts.push(`<line class="d-staff" x1="10" y1="${LINE_Y}" x2="${width - 10}" y2="${LINE_Y}"/>`);
    parts.push(`<text class="d-time" x="30" y="${LINE_Y - 4}">${beats}</text><text class="d-time" x="30" y="${LINE_Y + 18}">4</text>`);
    const repeat = (x0, dir) => {
      const thick = x0, thin = x0 + 6 * dir, dots = x0 + 12 * dir;
      return `<rect class="d-bar" x="${Math.min(thick, thick + 4 * dir)}" y="${LINE_Y - 16}" width="4" height="32"/>` +
        `<line class="d-staff" x1="${thin}" y1="${LINE_Y - 16}" x2="${thin}" y2="${LINE_Y + 16}"/>` +
        `<circle class="d-dot" cx="${dots}" cy="${LINE_Y - 7}" r="2.2"/><circle class="d-dot" cx="${dots}" cy="${LINE_Y + 7}" r="2.2"/>`;
    };
    parts.push(repeat(52, 1));
    parts.push(repeat(width - 16, -1));

    // 박 단위로 빔 묶기
    const groups = [];
    for (const n of notes) {
      const beat = Math.floor(n.t / 24);
      const last = groups[groups.length - 1];
      if (last && last.beat === beat && BEAMS[n.ticks] > 0 && BEAMS[last.notes[0].ticks] > 0) last.notes.push(n);
      else groups.push({ beat, notes: [n] });
    }

    notes.forEach((n, i) => {
      const sx = n.x + 5.6;
      // 꾸밈음
      if (n.graces) {
        const gx = n.graces.split('').map((_, k) => n.x - 15 - (n.graces.length - 1 - k) * 13);
        gx.forEach((g) => {
          parts.push(head(g, LINE_Y, 0.6, 'd-grace'));
          parts.push(`<line class="d-stem" x1="${g + 3.4}" y1="${LINE_Y - 1}" x2="${g + 3.4}" y2="${LINE_Y - 26}"/>`);
        });
        if (gx.length === 1) {
          parts.push(`<line class="d-stem" x1="${gx[0] - 1}" y1="${LINE_Y - 12}" x2="${gx[0] + 8}" y2="${LINE_Y - 22}"/>`); // 플램 사선
        } else {
          for (const off of [0, 4]) {
            parts.push(`<line class="d-beam-thin" x1="${gx[0] + 3.4}" y1="${LINE_Y - 26 + off}" x2="${gx[gx.length - 1] + 3.4}" y2="${LINE_Y - 26 + off}"/>`);
          }
        }
        gx.forEach((g, k) => parts.push(`<text class="d-stick grace" x="${g}" y="${LINE_Y + 48}">${n.graces[k].toLowerCase()}</text>`));
      }
      // 음표: 스네어는 줄 위, 킥은 줄 아래. 킥을 같이 치면 한 기둥에 두 머리
      const y = n.hand === 'K' ? KICK_Y : LINE_Y;
      const low = n.kick ? KICK_Y : y;
      parts.push(`<g class="d-note" data-i="${i}">${head(n.x, y, 1, n.hand === 'K' ? 'kick' : '')}` +
        `${n.kick ? head(n.x, KICK_Y, 1, 'kick') : ''}` +
        `<line class="d-stem" x1="${sx}" y1="${low - 2}" x2="${sx}" y2="${STEM_TOP}"/></g>`);
      if (n.accent) parts.push(`<text class="d-accent" x="${n.x}" y="${LINE_Y + 30}">&gt;</text>`);
      const handCls = { R: ' r', L: ' l', K: ' k' }[n.hand];
      parts.push(`<text class="d-stick${handCls}" data-i="${i}" x="${n.x}" y="${LINE_Y + 48}">${n.hand}</text>`);
      if (n.kick) parts.push(`<text class="d-stick k" data-i="${i}" x="${n.x}" y="${LINE_Y + 64}">K</text>`);
    });

    // 빔 / 깃발 / 잇단음표 숫자
    for (const g of groups) {
      const ns = g.notes;
      const level0 = BEAMS[ns[0].ticks];
      if (!level0) continue;
      if (ns.length === 1) {
        const n = ns[0];
        for (let k = 0; k < BEAMS[n.ticks]; k++) {
          const y = STEM_TOP + k * 7;
          parts.push(`<path class="d-flag" d="M${n.x + 5.6} ${y} q 10 6 8 18"/>`);
        }
        continue;
      }
      const first = ns[0].x + 5.6, last = ns[ns.length - 1].x + 5.6;
      parts.push(`<rect class="d-beam" x="${first - 0.8}" y="${STEM_TOP}" width="${last - first + 1.6}" height="4"/>`);
      for (let level = 2; level <= 3; level++) {
        const y = STEM_TOP + (level - 1) * 7;
        let k = 0;
        while (k < ns.length) {
          if (BEAMS[ns[k].ticks] < level) { k++; continue; }
          let j = k;
          while (j + 1 < ns.length && BEAMS[ns[j + 1].ticks] >= level) j++;
          let a = ns[k].x + 5.6, b = ns[j].x + 5.6;
          if (k === j) { // 혼자면 옆으로 짧게
            if (k === 0) b = a + 9; else a = b - 9;
          }
          parts.push(`<rect class="d-beam" x="${a - 0.8}" y="${y}" width="${b - a + 1.6}" height="4"/>`);
          k = j + 1;
        }
      }
      const tup = TUPLET[ns[0].ticks];
      if (tup && ns.every((n) => TUPLET[n.ticks])) {
        parts.push(`<text class="d-tuplet" x="${(first + last) / 2}" y="${STEM_TOP - 6}">${tup}</text>`);
      }
    }

    const height = LINE_Y + (notes.some((n) => n.kick) ? 72 : 56);
    return `<svg viewBox="0 0 ${width} ${height}" style="max-width:${width * 1.5}px" role="img" aria-label="루디먼트 악보">${parts.join('')}</svg>`;
  }

  // ---------- 소리 ----------
  let ac = null;
  let noise = null;

  function audio() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (!noise) {
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.25), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ac;
  }

  // 스네어 한 타: 스네어 줄 소리(잡음) + 몸통(짧은 저음). 오른손은 오른쪽, 왼손은 왼쪽
  function hit(time, hand, level) {
    const ctx = audio();
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    const out = pan || ctx.destination;
    if (pan) { pan.pan.value = hand === 'R' ? 0.35 : -0.35; pan.connect(ctx.destination); }

    const src = ctx.createBufferSource();
    src.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(level, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.06 + level * 0.12);
    src.connect(bp).connect(ng).connect(out);
    src.start(time);
    src.stop(time + 0.25);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hand === 'R' ? 200 : 185, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    const og = ctx.createGain();
    og.gain.setValueAtTime(level * 0.7, time);
    og.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    osc.connect(og).connect(out);
    osc.start(time);
    osc.stop(time + 0.1);
  }

  // 베이스 드럼: 음높이가 빠르게 떨어지는 사인파 + 짧은 비터 소리
  function kick(time, level) {
    const ctx = audio();
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 1.2, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    osc.connect(g).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.4);

    const src = ctx.createBufferSource();
    src.buffer = noise;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1200;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(level * 0.25, time);
    ng.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
    src.connect(lp).connect(ng).connect(ctx.destination);
    src.start(time);
    src.stop(time + 0.03);
  }

  function click(time, accent) {
    const ctx = audio();
    const osc = ctx.createOscillator();
    osc.frequency.value = accent ? 1760 : 1320;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    osc.connect(g).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  // ---------- 탭 ----------
  function init({ settings, persist }) {
    const saved = settings.drum || {};
    const st = {
      id: saved.id || 'para',
      bpm: saved.bpm || 80,
      loop: saved.loop ?? true,
      click: saved.click ?? true,
      kick: saved.kick || 'none',
    };
    const run = { on: false, timer: 0, next: 0, idx: 0, loopStart: 0, visuals: [] };
    let notes = [];
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      list: $('d-list'), name: $('d-name'), desc: $('d-desc'), score: $('d-score'),
      play: $('d-play'), bpm: $('d-bpm'), down: $('d-down'), up: $('d-up'), loop: $('d-loop'), click: $('d-click'), kick: $('d-kick'),
    };

    function save() {
      settings.drum = { id: st.id, bpm: st.bpm, loop: st.loop, click: st.click, kick: st.kick };
      persist();
    }

    const rudiment = () => RUDIMENTS.find((r) => r.id === st.id) || RUDIMENTS[0];

    function render() {
      if (!active) return;
      const cats = [...new Set(RUDIMENTS.map((r) => r.cat))];
      el.list.innerHTML = cats.map((c) =>
        `<div class="d-cat"><small>${c}</small>${RUDIMENTS.filter((r) => r.cat === c).map((r) =>
          `<button type="button" data-id="${r.id}" class="${r.id === st.id ? 'on' : ''}">${r.name}</button>`).join('')}</div>`).join('');
      const r = rudiment();
      const linear = r.pattern.includes('K'); // 손발 조합은 이미 킥이 들어 있음
      notes = applyKick(parse(r), linear ? 'none' : st.kick);
      el.kick.disabled = linear;
      el.kick.value = linear ? 'none' : st.kick;
      el.name.textContent = r.name;
      el.desc.textContent = r.desc;
      el.score.innerHTML = drawScore(notes);
      el.bpm.value = st.bpm;
      el.loop.checked = st.loop;
      el.click.checked = st.click;
      el.play.innerHTML = run.on ? '■ 멈추기 <kbd>Space</kbd>' : '▶ 들어보기 <kbd>Space</kbd>';
    }

    // 재생: 앞으로 0.15초 안에 올 음을 미리 예약 (메트로놈과 같은 방식)
    function schedule() {
      const ctx = audio();
      const tickSec = 60 / st.bpm / 24;
      const total = notes.reduce((a, n) => a + n.ticks, 0);
      while (true) {
        if (run.idx >= notes.length) {
          if (!st.loop) {
            const endIn = (run.loopStart + total * tickSec - ctx.currentTime) * 1000;
            run.visuals.push(setTimeout(stop, Math.max(0, endIn) + 200));
            clearInterval(run.timer);
            return;
          }
          run.idx = 0;
          run.loopStart += total * tickSec;
        }
        const n = notes[run.idx];
        const time = run.loopStart + n.t * tickSec;
        if (time > ctx.currentTime + 0.15) return;

        const level = n.accent ? 1 : 0.42;
        if (n.hand === 'K') kick(time, n.accent ? 1 : 0.8);
        else hit(time, n.hand, level);
        if (n.kick) kick(time, 0.85);
        const graceHand = n.hand === 'R' ? 'L' : 'R';
        n.graces.split('').forEach((g, k) => {
          const before = n.graces.length === 1 ? 0.028 : (n.graces.length - k) * 0.032;
          hit(time - before, n.graces.length === 1 ? graceHand : g, 0.13);
        });
        if (st.click && n.t % 24 === 0) click(time, n.t === 0);
        // 박에 음이 없을 때도 클릭 (예: 플라마큐의 4분음표 구간)
        if (st.click) {
          for (let b = Math.ceil(n.t / 24) * 24; b < n.t + n.ticks; b += 24) if (b !== n.t) click(run.loopStart + b * tickSec, false);
        }
        const i = run.idx;
        run.visuals.push(setTimeout(() => highlight(i), Math.max(0, (time - ctx.currentTime) * 1000)));
        run.idx++;
      }
    }

    function highlight(i) {
      el.score.querySelectorAll('.now').forEach((e) => e.classList.remove('now'));
      el.score.querySelectorAll(`[data-i="${i}"]`).forEach((e) => e.classList.add('now'));
    }

    function start() {
      const ctx = audio();
      stop();
      run.on = true;
      run.idx = 0;
      run.loopStart = ctx.currentTime + 0.12;
      schedule();
      run.timer = setInterval(schedule, 25);
      render();
    }

    function stop() {
      run.on = false;
      clearInterval(run.timer);
      run.visuals.forEach(clearTimeout);
      run.visuals = [];
      if (active) { render(); highlight(-1); }
    }

    const setBpm = (v) => {
      st.bpm = Math.max(30, Math.min(240, Math.round(+v || st.bpm)));
      el.bpm.value = st.bpm;
      save();
    };

    el.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const wasOn = run.on;
      stop();
      st.id = b.dataset.id;
      save();
      render();
      if (wasOn) start();
    });
    el.play.addEventListener('click', () => (run.on ? stop() : start()));
    el.bpm.addEventListener('change', () => setBpm(el.bpm.value));
    el.down.addEventListener('click', () => setBpm(st.bpm - 5));
    el.up.addEventListener('click', () => setBpm(st.bpm + 5));
    el.loop.addEventListener('change', () => { st.loop = el.loop.checked; save(); });
    el.kick.innerHTML = Object.entries(KICK_MODES).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.kick.addEventListener('change', () => {
      st.kick = el.kick.value; // stop()이 다시 그리면서 선택값을 덮어쓰기 전에 읽음
      const wasOn = run.on;
      stop();
      save();
      render();
      if (wasOn) start();
    });
    el.click.addEventListener('change', () => { st.click = el.click.checked; save(); });

    return {
      activate() { active = true; render(); },
      deactivate() { stop(); active = false; },
      render,
      toggle() { if (run.on) stop(); else start(); },
      onClick() {},
    };
  }

  global.FretDrum = { init, RUDIMENTS, parse };
})(window);

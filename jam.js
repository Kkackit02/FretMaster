// 잼 트랙: 코드 진행 + 드럼 그루브 + 베이스 + 코드 반주를 반복 재생하고, 위에서 쓸 스케일을 지판에 보여줌
(function (global) {
  'use strict';

  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const COMP = { off: '코드 없음', pad: '패드 (길게)', stab: '스탭 (2·4박)' };

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.jam || {};
    const fromGuide = settings.guide?.prog?.length ? settings.guide : null;
    const st = {
      prog: saved.prog || fromGuide?.prog || [{ rootPc: 0, type: 'maj' }, { rootPc: 7, type: 'maj' }, { rootPc: 9, type: 'min' }, { rootPc: 5, type: 'maj' }],
      key: saved.key || fromGuide?.key || { pc: 0, mode: 'major' },
      groove: saved.groove || 'rock8',
      bpm: saved.bpm || 90,
      beats: saved.beats || 4,
      drums: saved.drums ?? true,
      bass: saved.bass ?? true,
      comp: saved.comp || 'pad',
      scale: saved.scale || null,
    };
    const run = { on: false, timer: 0, idx: 0, loopStart: 0, events: [], visuals: [], current: 0 };
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      import: $('j-import'), preset: $('j-preset'), key: $('j-key'), prog: $('j-prog'),
      now: $('j-now'), next: $('j-next'), dots: $('j-dots'),
      play: $('j-play'), bpm: $('j-bpm'), down: $('j-down'), up: $('j-up'), beats: $('j-beats'), groove: $('j-groove'),
      drums: $('j-drums'), bass: $('j-bass'), comp: $('j-comp'), scales: $('j-scales'), legend: $('j-legend'),
    };

    function save() {
      settings.jam = { ...st };
      ctx.persist();
    }

    const build = (rootPc, type) => FretChords.build(rootPc, type, ctx.accFor(rootPc, type), settings.naming);
    const keyName = (key) => build(key.pc, key.mode === 'minor' ? 'min' : 'maj').name;

    // ---------- 스케일 추천 ----------
    function suggestions() {
      const allDom = st.prog.length && st.prog.every((c) => c.type === 'dom7');
      if (allDom) return ['blues', 'minpent', 'mixolydian']; // 블루스 진행
      return st.key.mode === 'minor' ? ['minpent', 'minor', 'blues', 'dorian'] : ['majpent', 'major', 'mixolydian'];
    }

    function scaleId() {
      const list = suggestions();
      return list.includes(st.scale) ? st.scale : list[0];
    }

    function scaleTones() {
      const sc = FretScales.SCALES[scaleId()];
      const isMinor = sc.notes.some(([semi]) => semi === 3);
      const acc = ctx.accFor(st.key.pc, isMinor ? 'min' : 'maj');
      return sc.notes.map(([semi, step]) => ({
        pc: (st.key.pc + semi) % 12,
        name: FretChords.spellDegree(st.key.pc, semi, step, acc, settings.naming),
        root: semi === 0,
      }));
    }

    // ---------- 소리 ----------
    const S = () => FretDrum.sound;

    function bassNote(time, rootPc, dur) {
      const ac = S().audio();
      const midi = 33 + ((rootPc - 9 + 12) % 12); // A1 ~ G♯2
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 440 * 2 ** ((midi - 69) / 12);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      lp.Q.value = 3;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(0.32, time + 0.01);
      g.gain.exponentialRampToValueAtTime(0.14, time + 0.25);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.connect(lp).connect(g).connect(ac.destination);
      osc.start(time);
      osc.stop(time + dur + 0.05);
    }

    function chordNotes(c) {
      const semis = FretChords.TYPES[c.type].tones.map(([semi]) => semi);
      const root = 52 + ((c.rootPc - 4 + 12) % 12); // E3 ~ D♯4
      return semis.map((s) => root + s);
    }

    function chordSound(time, c, dur, level) {
      const ac = S().audio();
      for (const m of chordNotes(c)) {
        const osc = ac.createOscillator();
        osc.type = 'triangle';
        osc.frequency.value = 440 * 2 ** ((m - 69) / 12);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, time);
        g.gain.exponentialRampToValueAtTime(level, time + 0.03);
        g.gain.exponentialRampToValueAtTime(level * 0.5, time + Math.min(dur, 0.6));
        g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        osc.connect(g).connect(ac.destination);
        osc.start(time);
        osc.stop(time + dur + 0.05);
      }
    }

    // ---------- 재생 ----------
    // 한 바퀴의 사건 목록 (틱 단위, 4분음표 = 24)
    function buildEvents() {
      const per = st.beats * 24;
      const total = st.prog.length * per;
      const ev = [];
      const groove = FretDrum.GROOVES.find((g) => g.id === st.groove) || FretDrum.GROOVES[0];
      st.prog.forEach((c, i) => {
        const t0 = i * per;
        ev.push({ t: t0, kind: 'chord', i });
        if (st.bass) {
          for (let b = 0; b < st.beats; b += 2) {
            const fifth = (b / 2) % 2 === 1;
            ev.push({ t: t0 + b * 24, kind: 'bass', pc: fifth ? (c.rootPc + 7) % 12 : c.rootPc, dur: 2 });
          }
        }
        if (st.comp === 'pad') ev.push({ t: t0, kind: 'pad', c, dur: st.beats });
        if (st.comp === 'stab') for (let b = 1; b < st.beats; b += 2) ev.push({ t: t0 + b * 24, kind: 'stab', c });
      });
      for (let b = 0; b * 24 < total; b++) ev.push({ t: b * 24, kind: 'beat', b });
      if (st.drums) {
        const notes = FretDrum.grooveNotes(groove);
        for (let bar = 0; bar * 96 < total; bar++) {
          for (const n of notes) {
            const t = bar * 96 + n.t;
            if (t < total) ev.push({ t, kind: 'drum', heads: n.heads, swing: groove.swing && n.t % 24 === 12 });
          }
        }
      }
      ev.sort((a, b) => a.t - b.t);
      return { ev, total };
    }

    function schedule() {
      const ac = S().audio();
      const tickSec = 60 / st.bpm / 24;
      while (true) {
        if (run.idx >= run.events.ev.length) {
          run.loopStart += run.events.total * tickSec;
          run.events = buildEvents(); // 바꾼 설정은 다음 바퀴부터
          run.idx = 0;
        }
        const e = run.events.ev[run.idx];
        const time = run.loopStart + (e.t + (e.swing ? 4 : 0)) * tickSec;
        if (time > ac.currentTime + 0.15) return;
        const beatSec = 60 / st.bpm;
        if (e.kind === 'drum') {
          for (const h of e.heads) {
            if (h === 'S') S().snare(time, 'R', 0.6);
            else if (h === 'K') S().kick(time, 0.8);
            else if (h === 'H') S().hat(time, false, e.t % 24 === 0 ? 0.3 : 0.2);
            else if (h === 'O') S().hat(time, true, 0.28);
          }
        } else if (e.kind === 'bass') bassNote(time, e.pc, e.dur * beatSec);
        else if (e.kind === 'pad') chordSound(time, e.c, e.dur * beatSec, 0.05);
        else if (e.kind === 'stab') chordSound(time, e.c, 0.25, 0.07);
        else if (e.kind === 'chord') {
          const i = e.i;
          run.visuals.push(setTimeout(() => { run.current = i; render(); }, Math.max(0, (time - ac.currentTime) * 1000)));
        } else if (e.kind === 'beat') {
          const b = e.b % st.beats;
          run.visuals.push(setTimeout(() => renderDots(b), Math.max(0, (time - ac.currentTime) * 1000)));
        }
        run.idx++;
      }
    }

    function start() {
      if (!st.prog.length) return;
      const ac = S().audio();
      stop();
      run.on = true;
      run.events = buildEvents();
      run.idx = 0;
      run.current = 0;
      run.loopStart = ac.currentTime + 0.12;
      schedule();
      run.timer = setInterval(schedule, 25);
      render();
    }

    function stop() {
      run.on = false;
      clearInterval(run.timer);
      run.visuals.forEach(clearTimeout);
      run.visuals = [];
      renderDots(-1);
      if (active) render();
    }

    // ---------- 그리기 ----------
    function renderDots(active) {
      el.dots.innerHTML = Array.from({ length: st.beats }, (_, i) =>
        `<i class="${i === active ? 'on' : ''}${i === 0 ? ' first' : ''}"></i>`).join('');
    }

    function render() {
      if (!active) return;
      const cur = st.prog[run.current] || st.prog[0];
      const nxt = st.prog[(run.current + 1) % st.prog.length];
      el.prog.innerHTML = st.prog.length
        ? st.prog.map((c, i) => `<div class="g-step${run.on && i === run.current ? ' playing' : ''}"><b>${build(c.rootPc, c.type).name}</b></div>`).join('')
        : '<p class="g-empty">진행 없음 (코드 가이드에서 가져오거나 프리셋 선택)</p>';
      el.now.textContent = cur ? build(cur.rootPc, cur.type).name : '–';
      el.next.textContent = nxt && st.prog.length > 1 ? build(nxt.rootPc, nxt.type).name : '';

      el.key.value = `${st.key.pc}:${st.key.mode}`;
      el.bpm.value = st.bpm;
      el.beats.value = st.beats;
      el.groove.value = st.groove;
      el.drums.checked = st.drums;
      el.bass.checked = st.bass;
      el.comp.value = st.comp;
      el.play.innerHTML = run.on ? '■ 정지 <kbd>Space</kbd>' : '▶ 재생 <kbd>Space</kbd>';

      const sid = scaleId();
      el.scales.innerHTML = suggestions().map((id, k) =>
        `<button type="button" data-scale="${id}" class="${id === sid ? 'on' : ''}">${keyName({ pc: st.key.pc, mode: 'major' }).replace(/m$/, '')} ${FretScales.SCALES[id].label}${k === 0 ? ' (기본)' : ''}</button>`).join('');

      // 지판: 스케일 음 + 지금 코드의 구성음 강조
      const tones = scaleTones();
      const chord = cur ? build(cur.rootPc, cur.type) : null;
      const marks = [];
      for (const s of [1, 2, 3, 4, 5, 6]) {
        for (let f = settings.fretMin; f <= settings.fretMax; f++) {
          const midi = OPEN_MIDI[s] + f;
          const pc = midi % 12;
          const ct = chord?.tones.find((t) => t.pc === pc);
          const sc = tones.find((t) => t.pc === pc);
          if (!ct && !sc) continue;
          const cls = ct ? (ct.role === 'R' ? 'root' : 'tone') : 'scale';
          marks.push({ s, f, midi, cls, still: true, label: ct ? ct.name : sc.name });
        }
      }
      ctx.renderBoard(marks);
    }

    function renderKeys() {
      const opts = [];
      for (const pc of FIFTHS) opts.push([`${pc}:major`, `${keyName({ pc, mode: 'major' })} 장조`]);
      for (const pc of FIFTHS) opts.push([`${(pc + 9) % 12}:minor`, `${keyName({ pc: (pc + 9) % 12, mode: 'minor' })} 단조`]);
      el.key.innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    }

    // ---------- 이벤트 ----------
    el.preset.innerHTML = '<option value="">프리셋</option>' +
      FretGuide.PRESETS.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');
    el.beats.innerHTML = [[2, '코드당 2박'], [4, '코드당 4박 (한 마디)'], [8, '코드당 8박 (두 마디)']].map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.groove.innerHTML = FretDrum.GROOVES.map((g) => `<option value="${g.id}">${g.name}</option>`).join('');
    el.comp.innerHTML = Object.entries(COMP).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.legend.innerHTML = '<span><i class="lg lg-root"></i>현재 코드 근음</span><span><i class="lg lg-tone"></i>현재 코드 구성음</span>' +
      '<span><i class="lg lg-scale"></i>스케일 음</span>';

    el.import.addEventListener('click', () => {
      const g = settings.guide;
      if (!g?.prog?.length) { el.prog.innerHTML = '<p class="g-empty">코드 가이드에 진행 없음</p>'; return; }
      st.prog = g.prog.map((c) => ({ ...c }));
      st.key = { ...g.key };
      save();
      if (run.on) start(); else render();
    });
    el.preset.addEventListener('change', () => {
      const p = FretGuide.PRESETS[+el.preset.value];
      el.preset.value = '';
      if (!p) return;
      st.key = { pc: st.key.pc, mode: p.mode || 'major' };
      st.prog = p.steps.map(([iv, type]) => ({ rootPc: (st.key.pc + iv) % 12, type }));
      save();
      if (run.on) start(); else render();
    });
    el.key.addEventListener('change', () => {
      // 키를 바꾸면 진행도 같이 옮김 (조옮김)
      const [pc, mode] = el.key.value.split(':');
      const shift = (+pc - st.key.pc + 12) % 12;
      st.prog = st.prog.map((c) => ({ ...c, rootPc: (c.rootPc + shift) % 12 }));
      st.key = { pc: +pc, mode };
      save();
      render();
    });
    const setBpm = (v) => { st.bpm = Math.max(40, Math.min(220, Math.round(+v || st.bpm))); el.bpm.value = st.bpm; save(); };
    el.bpm.addEventListener('change', () => setBpm(el.bpm.value));
    el.down.addEventListener('click', () => setBpm(st.bpm - 5));
    el.up.addEventListener('click', () => setBpm(st.bpm + 5));
    el.beats.addEventListener('change', () => { st.beats = +el.beats.value; save(); renderDots(-1); });
    el.groove.addEventListener('change', () => { st.groove = el.groove.value; save(); });
    el.drums.addEventListener('change', () => { st.drums = el.drums.checked; save(); });
    el.bass.addEventListener('change', () => { st.bass = el.bass.checked; save(); });
    el.comp.addEventListener('change', () => { st.comp = el.comp.value; save(); });
    el.scales.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-scale]');
      if (b) { st.scale = b.dataset.scale; save(); render(); }
    });
    el.play.addEventListener('click', () => (run.on ? stop() : start()));

    return {
      activate() { active = true; renderKeys(); renderDots(-1); render(); },
      deactivate() { stop(); active = false; },
      render() { if (active) { renderKeys(); render(); } },
      toggle() { if (run.on) stop(); else start(); },
      onClick() {},
      // 진행 분석기에서 보낸 진행 받기
      setProgression(prog, key) {
        stop();
        st.prog = prog.map((c) => ({ rootPc: c.rootPc, type: c.type }));
        st.key = { pc: key.pc, mode: key.mode };
        st.scale = null;
        save();
      },
    };
  }

  global.FretJam = { init };
})(window);

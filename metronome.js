// 메트로놈: 모든 탭에서 쓰는 박자 + 점점 빠르게(스피드 트레이너)
// 클릭 소리는 음높이 없는 잡음이라 마이크 음 인식에 끼어들지 않는다.
(function (global) {
  'use strict';

  const LOOKAHEAD = 0.12; // 초
  const TICK_MS = 25;

  let ac = null;
  let noise = null;

  function audio() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (!noise) {
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.03), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    }
    return ac;
  }

  /** 클릭 한 번 (when: AudioContext 시각, 없으면 지금) */
  function click(accent = false, when) {
    const ctx = audio();
    const t = when ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = accent ? 2500 : 3500;
    const g = ctx.createGain();
    g.gain.value = accent ? 0.9 : 0.5;
    src.connect(hp).connect(g).connect(ctx.destination);
    src.start(t);
  }

  function init({ settings, persist }) {
    const saved = settings.metro || {};
    const st = {
      bpm: saved.bpm || 90,
      beats: saved.beats || 4,
      trainer: saved.trainer ?? false,
      every: saved.every || 4,
      step: saved.step || 5,
      max: saved.max || 160,
    };
    const run = { on: false, timer: 0, next: 0, beat: 0, bars: 0, startBpm: st.bpm };

    const $ = (id) => document.getElementById(id);
    const el = {
      toggle: $('m-toggle'), bpm: $('m-bpm'), down: $('m-down'), up: $('m-up'), beats: $('m-beats'), dots: $('m-dots'),
      trainer: $('m-trainer'), every: $('m-every'), step: $('m-step'), max: $('m-max'), info: $('m-info'),
    };

    function save() {
      settings.metro = { bpm: st.bpm, beats: st.beats, trainer: st.trainer, every: st.every, step: st.step, max: st.max };
      persist();
    }

    function setBpm(v) {
      st.bpm = Math.max(30, Math.min(260, Math.round(+v || st.bpm)));
      el.bpm.value = st.bpm;
      save();
    }

    function renderDots(active = -1) {
      el.dots.innerHTML = Array.from({ length: st.beats }, (_, i) =>
        `<i class="${i === active ? 'on' : ''}${i === 0 ? ' first' : ''}"></i>`).join('');
    }

    function schedule() {
      const ctx = audio();
      while (run.next < ctx.currentTime + LOOKAHEAD) {
        const beat = run.beat;
        click(beat === 0, run.next);
        const delay = Math.max(0, (run.next - ctx.currentTime) * 1000);
        setTimeout(() => { if (run.on) renderDots(beat); }, delay);

        run.next += 60 / st.bpm;
        run.beat = (run.beat + 1) % st.beats;
        if (run.beat === 0) {
          run.bars++;
          if (st.trainer && run.bars % st.every === 0 && st.bpm < st.max) {
            setBpm(Math.min(st.max, st.bpm + st.step));
            el.info.textContent = `${run.startBpm} → ${st.bpm} BPM`;
          }
        }
      }
    }

    function start() {
      const ctx = audio();
      run.on = true;
      run.beat = 0;
      run.bars = 0;
      run.startBpm = st.bpm;
      run.next = ctx.currentTime + 0.06;
      el.info.textContent = st.trainer ? `${st.bpm} BPM부터 ${st.every}마디마다 +${st.step}` : '';
      schedule();
      run.timer = setInterval(schedule, TICK_MS);
      el.toggle.textContent = '■';
      el.toggle.classList.add('on');
    }

    function stop() {
      run.on = false;
      clearInterval(run.timer);
      el.toggle.textContent = '▶';
      el.toggle.classList.remove('on');
      renderDots();
    }

    // UI
    el.beats.innerHTML = [2, 3, 4, 6].map((b) => `<option value="${b}">${b}/4</option>`).join('');
    el.every.innerHTML = [1, 2, 4, 8].map((n) => `<option value="${n}">${n}마디마다</option>`).join('');
    el.step.innerHTML = [1, 2, 5, 10].map((n) => `<option value="${n}">+${n}</option>`).join('');
    el.bpm.value = st.bpm;
    el.beats.value = st.beats;
    el.trainer.checked = st.trainer;
    el.every.value = st.every;
    el.step.value = st.step;
    el.max.value = st.max;
    renderDots();

    el.toggle.addEventListener('click', () => (run.on ? stop() : start()));
    el.bpm.addEventListener('change', () => setBpm(el.bpm.value));
    el.down.addEventListener('click', () => setBpm(st.bpm - 1));
    el.up.addEventListener('click', () => setBpm(st.bpm + 1));
    el.beats.addEventListener('change', () => { st.beats = +el.beats.value; run.beat = 0; renderDots(); save(); });
    el.trainer.addEventListener('change', () => { st.trainer = el.trainer.checked; save(); });
    el.every.addEventListener('change', () => { st.every = +el.every.value; save(); });
    el.step.addEventListener('change', () => { st.step = +el.step.value; save(); });
    el.max.addEventListener('change', () => { st.max = Math.max(30, Math.min(260, +el.max.value || 160)); el.max.value = st.max; save(); });

    return { start, stop, get running() { return run.on; } };
  }

  global.FretMetronome = { init, click };
})(window);

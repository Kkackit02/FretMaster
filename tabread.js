// TAB 리딩: TAB 악보의 음을 순서대로 치기 (마이크 · 지판 클릭 · MIDI)
(function (global) {
  'use strict';

  const OPEN_MIDI = FretInst.open; // 현재 악기의 개방현 (instrument.js)
  const KINDS = {
    random: '한 포지션 랜덤',
    scale: '스케일 프레이즈',
    arp: '코드 아르페지오',
  };
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const rand = (n) => Math.floor(Math.random() * n);

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.tabread || {};
    const st = { kind: saved.kind || 'random', len: saved.len || 8, names: saved.names ?? false };
    let q = null;
    let active = false;
    let listening = false;
    let timer = 0;
    let playTimers = [];

    const $ = (id) => document.getElementById(id);
    const el = {
      kind: $('tb-kind'), len: $('tb-len'), names: $('tb-names'), score: $('tb-score'), msg: $('tb-msg'),
      play: $('tb-play'), mic: $('tb-mic'), skip: $('tb-skip'), next: $('tb-new'), info: $('tb-info'),
    };

    function save() {
      settings.tabread = { ...st };
      ctx.persist();
    }

    // ---------- 문제 ----------
    // 4프렛 폭의 한 포지션 안에서만 (손 이동 없이 칠 수 있게)
    function windowCells() {
      const lo = settings.fretMin;
      const base = lo + rand(Math.max(1, settings.fretMax - lo - 2));
      const hi = Math.min(settings.fretMax, base + 3);
      const cells = [];
      for (const s of settings.strings) {
        if (!OPEN_MIDI[s]) continue;
        for (let f = base; f <= hi; f++) cells.push({ s, f, midi: OPEN_MIDI[s] + f });
        if (base > 0 && base <= 2 && lo === 0) cells.push({ s, f: 0, midi: OPEN_MIDI[s] }); // 낮은 포지션은 개방현도
      }
      return { cells, base, hi };
    }

    // 음 높이 순으로 정렬한 칸 위를 한두 칸씩 오르내림 (같은 음 연속은 빼고)
    function walk(cells, len) {
      const sorted = [...cells].sort((a, b) => a.midi - b.midi || b.s - a.s);
      const uniq = sorted.filter((c, i) => i === 0 || c.midi !== sorted[i - 1].midi);
      if (uniq.length < 2) return [];
      const out = [];
      let i = rand(uniq.length);
      let dir = Math.random() < 0.5 ? 1 : -1;
      while (out.length < len) {
        out.push(uniq[i]);
        if (Math.random() < 0.25) dir = -dir;
        let j = i + dir * (1 + (Math.random() < 0.3 ? 1 : 0));
        if (j < 0 || j >= uniq.length) { dir = -dir; j = i + dir; }
        i = Math.max(0, Math.min(uniq.length - 1, j));
      }
      return out;
    }

    function next() {
      clearTimeout(timer);
      stopPlay();
      let notes = [];
      let info = '';
      let acc;
      for (let tries = 0; tries < 20 && notes.length < st.len; tries++) {
        const { cells, base, hi } = windowCells();
        const pos = `${base}~${hi}프렛`;
        if (st.kind === 'random') {
          notes = [];
          let prev = null;
          for (let k = 0; k < st.len; k++) {
            const pick = cells.filter((c) => !prev || c.midi !== prev.midi);
            prev = pick[rand(pick.length)];
            if (prev) notes.push(prev);
          }
          info = pos;
        } else {
          const root = rand(12);
          const pcs = st.kind === 'scale' ? MAJOR.map((x) => (root + x) % 12)
            : (Math.random() < 0.5 ? [0, 4, 7] : [0, 3, 7]).map((x) => (root + x) % 12);
          const minor = st.kind === 'arp' && pcs[1] === (root + 3) % 12;
          notes = walk(cells.filter((c) => pcs.includes(c.midi % 12)), st.len);
          acc = ctx.accFor(root, minor ? 'min' : 'maj'); // 조에 맞는 철자 (E 메이저면 G♯)
          info = st.kind === 'scale' ? `${ctx.noteName(root, acc)} 메이저 스케일 · ${pos}` : `${ctx.noteName(root, acc)}${minor ? 'm' : ''} 코드 · ${pos}`;
        }
      }
      q = {
        notes: notes.map((n) => ({ ...n, done: false, missed: false, hinted: false })),
        i: 0, info, acc, startedAt: performance.now(), noteAt: performance.now(), mistakes: 0, wrongAt: null,
      };
      el.msg.className = 'e-msg';
      el.msg.textContent = '';
      render();
    }

    function current() { return q && q.i < q.notes.length ? q.notes[q.i] : null; }

    function hit() {
      const n = current();
      n.done = true;
      ctx.score(true, !n.missed && !n.hinted, performance.now() - q.noteAt);
      q.i++;
      q.noteAt = performance.now();
      q.wrongAt = null;
      if (q.i >= q.notes.length) {
        const sec = ((performance.now() - q.startedAt) / 1000).toFixed(1);
        el.msg.className = 'e-msg good';
        el.msg.textContent = q.mistakes ? `완료 · 실수 ${q.mistakes}번 · ${sec}초` : `완료 · 실수 없음 · ${sec}초`;
        ctx.chime();
        timer = setTimeout(next, 1800);
      } else {
        el.msg.className = 'e-msg';
        el.msg.textContent = '';
      }
      render();
    }

    function miss(text, mark) {
      const n = current();
      if (!n.missed) { n.missed = true; q.mistakes++; ctx.score(false); }
      q.wrongAt = mark;
      el.msg.className = 'e-msg bad';
      el.msg.textContent = text;
      render();
    }

    // 마이크 · MIDI: 소리 높이로 판정
    function onNote(midi) {
      const n = current();
      if (!active || !n) return;
      if (midi === n.midi) { hit(); return; }
      const d = n.midi - midi;
      miss(`오답: ${ctx.noteNameWithOctave(midi)} · 정답은 ${Math.abs(d)}반음 ${d > 0 ? '위' : '아래'}`, null);
    }

    // 지판 클릭: TAB에 적힌 자리 그대로
    function onClick(s, f, midi) {
      const n = current();
      if (!n) return;
      if (s === n.s && f === n.f) { hit(); return; }
      if (midi === n.midi) {
        el.msg.className = 'e-msg reveal';
        el.msg.textContent = `같은 소리지만 TAB은 ${n.s}번 줄 ${n.f}프렛`;
        return;
      }
      miss(`오답: ${s}번 줄 ${f}프렛 · TAB은 ${n.s}번 줄 ${n.f}프렛`, { s, f, midi });
    }

    function giveUp() {
      const n = current();
      if (!n) return;
      n.hinted = true;
      el.msg.className = 'e-msg reveal';
      el.msg.textContent = `${n.s}번 줄 ${n.f}프렛 = ${ctx.noteNameWithOctave(n.midi)}`;
      ctx.playTone(n.midi, 0, 1, 0.2);
      render();
    }

    // ---------- 듣기 ----------
    function stopPlay() {
      playTimers.forEach(clearTimeout);
      playTimers = [];
      if (el.play) el.play.textContent = '듣기';
    }

    function play() {
      if (!q) return;
      if (playTimers.length) { stopPlay(); return; }
      const step = 0.45;
      q.notes.forEach((n, k) => {
        ctx.playTone(n.midi, k * step, step * 1.6, 0.2);
        playTimers.push(setTimeout(() => { q.playing = k; render(); }, k * step * 1000));
      });
      playTimers.push(setTimeout(() => { q.playing = null; stopPlay(); render(); }, q.notes.length * step * 1000 + 200));
      el.play.textContent = '■ 멈춤';
    }

    // ---------- 그리기 ----------
    function drawTab() {
      const N = FretInst.strings.length;
      const gap = 16, top = 22, left = 46, stepX = 46;
      const y = (s) => top + (s - 1) * gap;
      const width = left + q.notes.length * stepX + 24;
      const bottom = y(N);
      const height = bottom + (st.names ? 44 : 22);
      const parts = [];
      for (let s = 1; s <= N; s++) parts.push(`<line class="tb-line" x1="8" x2="${width - 8}" y1="${y(s)}" y2="${y(s)}"/>`);
      parts.push(`<line class="tb-bar" x1="8" x2="8" y1="${y(1)}" y2="${bottom}"/><line class="tb-bar" x1="${width - 8}" x2="${width - 8}" y1="${y(1)}" y2="${bottom}"/>`);
      ['T', 'A', 'B'].forEach((ch, k) => parts.push(`<text class="tb-clef" x="24" y="${(y(1) + bottom) / 2 + (k - 1) * 15 + 5}">${ch}</text>`));
      q.notes.forEach((n, k) => {
        const x = left + k * stepX + stepX / 2;
        if (k > 0 && k % 4 === 0) parts.push(`<line class="tb-bar" x1="${x - stepX / 2}" x2="${x - stepX / 2}" y1="${y(1)}" y2="${bottom}"/>`);
        const cls = n.done ? 'done' : k === q.i ? (n.missed ? 'cur missed' : 'cur') : '';
        const play = q.playing === k ? ' playing' : '';
        const text = String(n.f);
        const w = text.length * 9 + 6;
        parts.push(`<rect class="tb-bg${k === q.i ? ' cur' : ''}" x="${x - w / 2}" y="${y(n.s) - 9}" width="${w}" height="18" rx="4"/>`);
        parts.push(`<text class="tb-num ${cls}${play}" x="${x}" y="${y(n.s) + 5}">${text}</text>`);
        if (st.names) {
          const show = n.done || ctx.learn() || n.hinted;
          parts.push(`<text class="tb-name ${n.done ? 'done' : ''}" x="${x}" y="${bottom + 30}">${show ? ctx.noteName(n.midi % 12, q.acc) : '?'}</text>`);
        }
      });
      return `<svg viewBox="0 0 ${width} ${height}" style="width:${Math.round(width * 1.25)}px" role="img" aria-label="TAB 악보">${parts.join('')}</svg>`;
    }

    function render() {
      if (!active) return;
      el.kind.value = st.kind;
      el.len.value = st.len;
      el.names.checked = st.names;
      el.mic.classList.toggle('on', listening);
      el.mic.dataset.instText = listening ? '마이크 끄기' : '기타로 치기 (마이크)';
      el.mic.textContent = FretInst.isBass ? el.mic.dataset.instText.replace(/기타/g, '베이스') : el.mic.dataset.instText;
      if (!q || !q.notes.length) {
        el.score.innerHTML = '';
        el.info.textContent = '고른 줄·프렛 범위에서 문제를 만들 수 없음 (설정에서 범위 넓히기)';
        ctx.renderBoard([]);
        return;
      }
      el.info.textContent = q.info;
      el.score.innerHTML = drawTab();
      const n = current();
      const marks = q.notes.filter((x) => x.done).map((x) => ({ s: x.s, f: x.f, midi: x.midi, cls: 'done', still: true }));
      if (n && (ctx.learn() || n.hinted)) marks.push({ s: n.s, f: n.f, midi: n.midi, cls: 'next', still: true });
      if (q.wrongAt) marks.push({ ...q.wrongAt, cls: 'wrong', still: true });
      ctx.renderBoard(marks);
    }

    // ---------- 이벤트 ----------
    el.kind.innerHTML = Object.entries(KINDS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.len.innerHTML = [4, 8, 12, 16].map((n) => `<option value="${n}">${n}음</option>`).join('');
    el.kind.addEventListener('change', () => { st.kind = el.kind.value; save(); next(); });
    el.len.addEventListener('change', () => { st.len = +el.len.value; save(); next(); });
    el.names.addEventListener('change', () => { st.names = el.names.checked; save(); render(); });
    el.play.addEventListener('click', play);
    el.skip.addEventListener('click', giveUp);
    el.next.addEventListener('click', next);
    el.mic.addEventListener('click', async () => {
      if (listening) { listening = false; ctx.stopMic(); render(); return; }
      try {
        await ctx.startMic();
        listening = true;
        el.msg.className = 'e-msg';
        el.msg.textContent = '듣는 중 · 주황 숫자부터 차례로';
      } catch (err) {
        el.msg.className = 'e-msg bad';
        el.msg.textContent = err.name === 'NotAllowedError' ? '마이크 권한 거부됨 (주소창의 권한 설정 확인)' : `마이크 오류: ${err.message}`;
      }
      render();
    });

    return {
      activate() { active = true; next(); },
      deactivate() { active = false; listening = false; clearTimeout(timer); stopPlay(); },
      render() { if (active) render(); },
      onNote,
      onClick,
      giveUp,
    };
  }

  global.FretTabRead = { init };
})(window);

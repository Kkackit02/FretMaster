// 오선보 읽기: 음이름 맞히기 / 기타 지판에서 찾기 (기타 악보는 실제 소리보다 한 옥타브 높게 적음)
(function (global) {
  'use strict';

  const OPEN_MIDI = { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 };
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  // 자리표별 오선 맨 아래 줄의 음 (도수 번호 = 글자 + 7×옥타브)
  const CLEFS = {
    treble: { label: '높은음자리표', glyph: '𝄞', bottom: 4 * 7 + 2, glyphY: 74, glyphSize: 64 }, // E4
    bass: { label: '낮은음자리표', glyph: '𝄢', bottom: 2 * 7 + 4, glyphY: 62, glyphSize: 46 },   // G2
  };
  const RANGES = {
    treble: { inside: [30, 38], ledger: [25, 42] }, // E4~F5 / G3~C6
    bass: { inside: [18, 26], ledger: [12, 30] },   // G2~A3 / E2~E4
  };
  const ACC = { '-1': '♭', 0: '', 1: '♯' };
  const rand = (n) => Math.floor(Math.random() * n);

  const dnToMidi = (dn, acc) => (Math.floor(dn / 7) + 1) * 12 + LETTER_PC[dn % 7] + acc;

  // 소리 높이 → 오선보 위치 (변화음은 ♯ 또는 ♭으로)
  function midiToDn(midi, preferFlat) {
    const pc = midi % 12;
    const octave = Math.floor(midi / 12) - 1;
    let li = LETTER_PC.indexOf(pc);
    let acc = 0;
    if (li < 0) {
      if (preferFlat) { li = LETTER_PC.indexOf((pc + 1) % 12); acc = -1; } else { li = LETTER_PC.indexOf(pc - 1); acc = 1; }
    }
    // C♭·B♯은 만들지 않으므로 옥타브 경계를 넘는 경우는 없음
    return { dn: octave * 7 + li, acc };
  }

  /** 오선보 SVG: 기본 음표와 (틀렸을 때) 비교 음표 */
  function drawStaff({ clef, notes, guitar }) {
    const c = CLEFS[clef];
    const W = 300, H = 150, top = 45, gap = 10;
    const bottomY = top + 4 * gap;
    const y = (dn) => bottomY - (dn - c.bottom) * (gap / 2);
    const parts = [];
    for (let k = 0; k < 5; k++) parts.push(`<line class="sf-line" x1="10" x2="${W - 10}" y1="${top + k * gap}" y2="${top + k * gap}"/>`);
    parts.push(`<text class="sf-clef" x="20" y="${c.glyphY}" style="font-size:${c.glyphSize}px">${c.glyph}</text>`);
    if (guitar) parts.push(`<text class="sf-8" x="36" y="${clef === 'treble' ? 104 : 90}">8</text>`);
    for (const n of notes) {
      const ny = y(n.dn);
      // 덧줄
      for (let d = c.bottom - 2; d >= n.dn; d -= 2) parts.push(`<line class="sf-ledger" x1="${n.x - 14}" x2="${n.x + 14}" y1="${y(d)}" y2="${y(d)}"/>`);
      for (let d = c.bottom + 10; d <= n.dn; d += 2) parts.push(`<line class="sf-ledger" x1="${n.x - 14}" x2="${n.x + 14}" y1="${y(d)}" y2="${y(d)}"/>`);
      if (n.acc) parts.push(`<text class="sf-acc ${n.cls || ''}" x="${n.x - 20}" y="${ny + 6}">${ACC[n.acc]}</text>`);
      // 온음표
      parts.push(`<ellipse class="sf-note ${n.cls || ''}" cx="${n.x}" cy="${ny}" rx="8" ry="5.5" transform="rotate(-20 ${n.x} ${ny})"/>`);
      if (n.caption) parts.push(`<text class="sf-cap ${n.cls || ''}" x="${n.x}" y="${H - 6}">${n.caption}</text>`);
    }
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="오선보">${parts.join('')}</svg>`;
  }

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.staff || {};
    const st = {
      mode: saved.mode || 'name',
      clef: saved.clef || 'treble',
      range: saved.range || 'inside',
      acc: saved.acc ?? false,
    };
    let q = null;
    let active = false;
    let timer = 0;

    const $ = (id) => document.getElementById(id);
    const el = {
      modes: $('sf-modes'), clef: $('sf-clef'), clefField: $('sf-clef-field'), range: $('sf-range'), rangeField: $('sf-range-field'), acc: $('sf-acc'),
      staff: $('sf-staff'), prompt: $('sf-prompt'), answers: $('sf-answers'), msg: $('sf-msg'), listen: $('sf-listen'), skip: $('sf-skip'), note: $('sf-note'),
    };

    function save() {
      settings.staff = { ...st };
      ctx.persist();
    }

    const nameOf = (dn, acc) => {
      const base = settings.naming === 'solfege' ? ['도', '레', '미', '파', '솔', '라', '시'][dn % 7] : LETTERS[dn % 7];
      return base + ACC[acc];
    };
    const withOct = (dn, acc) => `${nameOf(dn, acc)}${Math.floor(dn / 7)}`;

    // ---------- 문제 ----------
    function next() {
      clearTimeout(timer);
      if (st.mode === 'name') {
        const [lo, hi] = RANGES[st.clef][st.range];
        const dn = lo + rand(hi - lo + 1);
        let acc = 0;
        if (st.acc && Math.random() < 0.4) {
          // B♯·E♯·C♭·F♭처럼 헷갈리는 철자는 빼고
          const letter = dn % 7;
          const ok = [1, -1].filter((a) => !(a === 1 && (letter === 2 || letter === 6)) && !(a === -1 && (letter === 0 || letter === 3)));
          acc = ok[Math.floor(Math.random() * ok.length)];
        }
        q = { dn, acc, midi: dnToMidi(dn, acc), clef: st.clef };
      } else {
        // 지판 범위 안의 한 자리 → 그 소리를 기타 악보(한 옥타브 위)로
        const cells = [];
        for (const s of settings.strings) {
          for (let f = settings.fretMin; f <= settings.fretMax; f++) {
            const m = OPEN_MIDI[s] + f;
            if (st.acc || LETTER_PC.includes(m % 12)) cells.push(m);
          }
        }
        const sound = cells[rand(cells.length)] ?? 52;
        const { dn, acc } = midiToDn(sound + 12, Math.random() < 0.5);
        q = { dn, acc, midi: sound, clef: 'treble' };
      }
      Object.assign(q, { tried: new Set(), mistakes: 0, done: false, ghost: null, startedAt: performance.now() });
      el.msg.className = 'e-msg';
      el.msg.textContent = '';
      render();
    }

    function correct(text) {
      q.done = true;
      ctx.score(true, q.mistakes === 0, performance.now() - q.startedAt);
      el.msg.className = 'e-msg good';
      el.msg.textContent = text;
      ctx.playTone(q.midi, 0, 1.2, 0.2);
      render();
      timer = setTimeout(next, 1400);
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

    function answerName(pc) {
      if (!q || q.done) return;
      if (pc === q.midi % 12) correct(`정답 · ${withOct(q.dn, q.acc)}`);
      else wrong(pc, '오답');
    }

    // 지판에서 찾기: 정확한 소리 높이여야 정답
    function onClick(s, f, midi) {
      if (st.mode !== 'fret' || !q || q.done) return;
      if (midi === q.midi) {
        const spots = Object.entries(OPEN_MIDI).map(([str, o]) => [str, q.midi - o]).filter(([, fr]) => fr >= 0 && fr <= 15)
          .map(([str, fr]) => `${str}번 줄 ${fr}프렛`);
        correct(`정답 · ${withOct(q.dn, q.acc)} (${spots.join(', ')})`);
        return;
      }
      // 내가 누른 음을 오선보에 겹쳐 그려 비교
      q.ghost = { ...midiToDn(midi + 12, q.acc === -1), s, f };
      const d = midi - q.midi;
      const hint = Math.abs(d) % 12 === 0 ? `옥타브 오류: 정답은 한 옥타브 ${d > 0 ? '아래' : '위'} (기타 악보는 실음보다 한 옥타브 높게 표기)`
        : `정답은 ${Math.abs(d)}반음 ${d > 0 ? '아래' : '위'}`;
      wrong(`${s}:${f}`, `오답: ${s}번 줄 ${f}프렛 = ${withOct(q.ghost.dn, q.ghost.acc)} · ${hint}`);
    }

    function giveUp() {
      if (!q || q.done) return;
      q.done = true;
      if (!q.mistakes) ctx.score(false);
      el.msg.className = 'e-msg reveal';
      el.msg.textContent = `정답: ${withOct(q.dn, q.acc)}`;
      ctx.playTone(q.midi, 0, 1.2, 0.2);
      render(true);
      timer = setTimeout(next, 2200);
    }

    // ---------- 그리기 ----------
    function render(reveal = false) {
      if (!active) return;
      el.modes.innerHTML = [['name', '음이름'], ['fret', '지판']].map(([id, label]) =>
        `<button type="button" data-mode="${id}" class="${id === st.mode ? 'on' : ''}">${label}</button>`).join('');
      el.clef.value = st.clef;
      el.range.value = st.range;
      el.acc.checked = st.acc;
      el.clefField.hidden = st.mode !== 'name';
      el.rangeField.hidden = st.mode !== 'name';
      el.note.hidden = st.mode !== 'fret';
      if (!q) return;

      const notes = [{ dn: q.dn, acc: q.acc, x: 150, cls: q.done ? 'right' : '' }];
      if (q.ghost && !q.done) notes.push({ dn: q.ghost.dn, acc: q.ghost.acc, x: 220, cls: 'ghost', caption: '누른 음' });
      el.staff.innerHTML = drawStaff({ clef: q.clef, notes, guitar: st.mode === 'fret' });
      el.prompt.textContent = st.mode === 'name' ? '음이름은?' : '지판에서 누르기';

      if (st.mode === 'name') {
        const pcs = st.acc ? [...Array(12).keys()] : LETTER_PC;
        el.answers.innerHTML = pcs.map((pc) => {
          const label = LETTER_PC.includes(pc) ? ctx.noteName(pc) : `${ctx.noteName(pc, 'sharp')}<small>${ctx.noteName(pc, 'flat')}</small>`;
          const cls = q.done && pc === q.midi % 12 ? 'right' : q.tried.has(pc) ? 'tried' : '';
          return `<button type="button" class="${cls}" data-pc="${pc}">${label}</button>`;
        }).join('');
        ctx.renderBoard([]);
      } else {
        el.answers.innerHTML = '';
        const marks = [];
        if (q.ghost && !q.done) marks.push({ s: q.ghost.s, f: q.ghost.f, midi: q.ghost.s ? OPEN_MIDI[q.ghost.s] + q.ghost.f : 0, cls: 'wrong', still: true });
        if (q.done || reveal) {
          for (const [s, o] of Object.entries(OPEN_MIDI)) {
            const f = q.midi - o;
            if (f >= 0 && f <= 15) marks.push({ s: +s, f, midi: q.midi, cls: reveal ? 'hint' : 'correct', still: true });
          }
        }
        ctx.renderBoard(marks);
      }
    }

    // ---------- 이벤트 ----------
    el.clef.innerHTML = Object.entries(CLEFS).map(([id, c]) => `<option value="${id}">${c.label}</option>`).join('');
    el.range.innerHTML = '<option value="inside">오선 안</option><option value="ledger">덧줄까지</option>';
    el.modes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (!b) return;
      st.mode = b.dataset.mode;
      save();
      next();
    });
    el.clef.addEventListener('change', () => { st.clef = el.clef.value; save(); next(); });
    el.range.addEventListener('change', () => { st.range = el.range.value; save(); next(); });
    el.acc.addEventListener('change', () => { st.acc = el.acc.checked; save(); next(); });
    el.answers.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-pc]');
      if (b) answerName(+b.dataset.pc);
    });
    el.listen.addEventListener('click', () => { if (q) ctx.playTone(q.midi, 0, 1.2, 0.2); });
    el.skip.addEventListener('click', giveUp);

    return {
      activate() { active = true; next(); },
      deactivate() { clearTimeout(timer); active = false; },
      render() { if (active) render(); },
      onClick,
      giveUp,
    };
  }

  global.FretStaff = { init, midiToDn, dnToMidi };
})(window);

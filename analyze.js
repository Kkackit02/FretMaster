// 코드 진행 분석기: 키 추정, 로마 숫자·기능, 키 밖 코드 설명, 종지, 조옮김·카포
(function (global) {
  'use strict';

  const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5];
  const LETTER = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // 코드 접미사 → chords.js 종류. 없는 확장음은 가장 가까운 종류로 (예: 9 → 7, 6 → M)
  const SUFFIX = [
    ['m7b5', 'm7b5'], ['m7♭5', 'm7b5'], ['ø7', 'm7b5'], ['ø', 'm7b5'], ['min7b5', 'm7b5'],
    ['maj7', 'maj7'], ['Maj7', 'maj7'], ['M7', 'maj7'], ['Δ7', 'maj7'], ['Δ', 'maj7'], ['maj9', 'maj7'], ['M9', 'maj7'], ['maj', 'maj'],
    ['min7', 'min7'], ['m7', 'min7'], ['-7', 'min7'], ['m9', 'min7'], ['m11', 'min7'],
    ['7sus4', 'sus4'], ['sus4', 'sus4'], ['sus2', 'sus2'], ['sus', 'sus4'],
    ['dim7', 'dim'], ['dim', 'dim'], ['°7', 'dim'], ['°', 'dim'], ['o7', 'dim'], ['o', 'dim'],
    ['aug', 'aug'], ['+', 'aug'],
    ['min', 'min'], ['m6', 'min'], ['m', 'min'], ['-', 'min'],
    ['13', 'dom7'], ['11', 'dom7'], ['9', 'dom7'], ['7', 'dom7'],
    ['add9', 'maj'], ['6', 'maj'], ['5', 'maj'], ['M', 'maj'], ['', 'maj'],
  ];
  const FAMILY = { maj: 'maj', dom7: 'maj', maj7: 'maj', aug: 'maj', sus2: 'sus', sus4: 'sus', min: 'min', min7: 'min', dim: 'dim', m7b5: 'dim' };

  // 키 안의 3화음 (단조는 화성단음계의 V·vii°도 포함)
  const DIATONIC = {
    major: [[0, 'maj', 'I', 'T'], [2, 'min', 'ii', 'SD'], [4, 'min', 'iii', 'T'], [5, 'maj', 'IV', 'SD'], [7, 'maj', 'V', 'D'], [9, 'min', 'vi', 'T'], [11, 'dim', 'vii°', 'D']],
    minor: [[0, 'min', 'i', 'T'], [2, 'dim', 'ii°', 'SD'], [3, 'maj', 'III', 'T'], [5, 'min', 'iv', 'SD'], [7, 'min', 'v', 'D'], [8, 'maj', 'VI', 'T'], [10, 'maj', 'VII', 'D'], [7, 'maj', 'V', 'D'], [11, 'dim', 'vii°', 'D']],
  };
  const NUMERAL_BASE = {
    major: ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'],
    minor: ['I', '♭II', 'II', 'III', '♯III', 'IV', '♯IV', 'V', 'VI', '♯VI', 'VII', '♯VII'],
  };
  const NUM_SUFFIX = { maj: '', min: '', dom7: '7', maj7: 'M7', min7: '7', sus2: 'sus2', sus4: 'sus4', dim: '°', aug: '+', m7b5: 'ø7' };
  const FUNC = {
    T: { label: '토닉', short: 'T', desc: '안정' },
    SD: { label: '서브도미넌트', short: 'SD', desc: '토닉에서 벗어남' },
    D: { label: '도미넌트', short: 'D', desc: '토닉으로 해결' },
  };

  const EXAMPLES = [
    ['C G Am F', '팝 진행 (I–V–vi–IV)'],
    ['Am F C G', '단조 (i–VI–III–VII)'],
    ['Dm7 G7 CM7', 'ii–V–I'],
    ['C E7 Am C7 F Fm C', '세컨더리 도미넌트 + 모달 인터체인지'],
    ['C Bb F C', '♭VII (모달 인터체인지)'],
    ['Am Dm E7 Am', '단조 + 화성단음계 V7'],
    ['A7 D7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7', '12마디 블루스'],
    ['D A Bm F#m G D G A', '캐논 진행'],
  ];

  function parseChord(tok) {
    const m = tok.match(/^([A-Ga-g])([#b♯♭]?)(.*?)(?:\/([A-Ga-g][#b♯♭]?))?$/);
    if (!m) return null;
    const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
    const rootPc = (LETTER[m[1].toUpperCase()] + acc + 12) % 12;
    let type = null;
    let approx = false;
    for (const [suf, t] of SUFFIX) if (m[3] === suf) { type = t; break; }
    if (!type) {
      const hit = SUFFIX.filter(([suf]) => suf && m[3].startsWith(suf)).sort((a, b) => b[0].length - a[0].length)[0];
      type = hit ? hit[1] : 'maj';
      approx = true;
    }
    let bass = null;
    if (m[4]) {
      const b = m[4];
      bass = (LETTER[b[0].toUpperCase()] + (b[1] === '#' || b[1] === '♯' ? 1 : b[1] === 'b' || b[1] === '♭' ? -1 : 0) + 12) % 12;
    }
    return { text: tok, rootPc, type, bass, approx };
  }

  function parseText(text) {
    const out = [];
    const bad = [];
    for (const tok of text.split(/[\s,|]+/).filter(Boolean)) {
      if (tok === '%' && out.length) { out.push({ ...out[out.length - 1], text: '%' }); continue; }
      if (/^(N\.?C\.?|-|\/)$/i.test(tok)) continue;
      const c = parseChord(tok);
      if (c) out.push(c); else bad.push(tok);
    }
    return { chords: out, bad };
  }

  const fam = (type) => FAMILY[type];
  const famMatch = (a, b) => a === b || a === 'sus' || b === 'sus';

  // 키 안의 코드면 그 자리 정보
  function diatonicOf(key, c) {
    const iv = (c.rootPc - key.pc + 12) % 12;
    const hit = DIATONIC[key.mode].find(([d, t]) => d === iv && famMatch(fam(t), fam(c.type)));
    if (!hit) return null;
    // 도미넌트 7은 V(단조는 VII도)에서만 키 안의 코드. 블루스는 I7·IV7도 기본 코드
    const bluesOk = key.blues && key.mode === 'major' && (hit[2] === 'I' || hit[2] === 'IV');
    if (c.type === 'dom7' && !bluesOk && !(hit[2] === 'V' || (key.mode === 'minor' && hit[2] === 'VII'))) return null;
    return { numeral: hit[2], fn: hit[3] };
  }

  function numeral(key, c) {
    const iv = (c.rootPc - key.pc + 12) % 12;
    let n = NUMERAL_BASE[key.mode][iv];
    if (fam(c.type) === 'min' || fam(c.type) === 'dim') n = n.replace(/[IV]+/, (x) => x.toLowerCase());
    return n + NUM_SUFFIX[c.type];
  }

  const isTonic = (key, c) => c.rootPc === key.pc && famMatch(fam(c.type), key.mode === 'major' ? 'maj' : 'min');
  const isDominantOf = (a, b) => (fam(a.type) === 'maj') && (a.rootPc + 5) % 12 === b.rootPc;

  // 절반 이상이 7th 코드면 블루스로 봄
  const isBluesy = (chords) => chords.length >= 3 && chords.filter((c) => c.type === 'dom7').length * 2 >= chords.length;

  /** 24개 키에 점수를 매겨 가장 그럴듯한 키 */
  function guessKeys(chords) {
    const scores = [];
    const blues = isBluesy(chords);
    for (let pc = 0; pc < 12; pc++) {
      for (const mode of ['major', 'minor']) {
        const key = { pc, mode, blues };
        let s = 0;
        chords.forEach((c, i) => {
          const next = chords[i + 1];
          if (diatonicOf(key, c)) s += 2;
          // 설명이 되는 키 밖 코드(세컨더리 도미넌트, 같은 으뜸음 조에서 빌려 온 코드)는 감점하지 않음
          else if (next && diatonicOf(key, next) && isDominantOf(c, next)) s += 1;
          else if (diatonicOf({ pc, mode: mode === 'major' ? 'minor' : 'major' }, c)) s += 0;
          else if (DIATONIC[mode].some(([d]) => d === (c.rootPc - pc + 12) % 12)) s += 0.5;
          else s -= 1;
          if (next && isTonic(key, next) && isDominantOf(c, next)) s += 1.5; // V → I
        });
        if (chords.length) {
          if (isTonic(key, chords[0])) s += 1.5;
          if (isTonic(key, chords[chords.length - 1])) s += 2; // 끝 코드가 으뜸화음이면 가장 강한 근거
        }
        scores.push({ key, score: s });
      }
    }
    return scores.sort((a, b) => b.score - a.score);
  }

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.analyze || {};
    const st = { text: saved.text || 'C E7 Am C7 F Fm C', key: null, shift: 0, selected: -1 };
    let result = null;
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      text: $('a-text'), run: $('a-run'), examples: $('a-examples'),
      summary: $('a-summary'), key: $('a-key'), alt: $('a-alt'), chords: $('a-chords'), notes: $('a-notes'),
      shift: $('a-shift'), transposed: $('a-transposed'), capo: $('a-capo'), toJam: $('a-to-jam'), toGuide: $('a-to-guide'), legend: $('a-legend'),
    };

    function save() {
      settings.analyze = { text: st.text };
      ctx.persist();
    }

    const build = (c, key) => {
      const acc = key ? ctx.accFor(key.pc, key.mode === 'minor' ? 'min' : 'maj') : ctx.accFor(c.rootPc, c.type);
      return FretChords.build(c.rootPc, c.type, acc, settings.naming);
    };
    const keyName = (key) => FretChords.build(key.pc, key.mode === 'minor' ? 'min' : 'maj', ctx.accFor(key.pc, key.mode === 'minor' ? 'min' : 'maj'), settings.naming).name;
    const keyLabel = (key) => `${keyName(key)} ${key.mode === 'minor' ? '단조' : '장조'}${key.blues && key.mode === 'major' ? ' (블루스)' : ''}`;
    const parallel = (key) => ({ pc: key.pc, mode: key.mode === 'major' ? 'minor' : 'major' });

    // ---------- 분석 ----------
    function analyze() {
      const { chords, bad } = parseText(st.text);
      if (!chords.length) { result = { chords, bad, items: [], notes: [] }; return; }
      const ranked = guessKeys(chords);
      const key = st.key ? { ...st.key, blues: isBluesy(chords) } : ranked[0].key;
      const items = chords.map((c, i) => {
        const next = chords[i + 1];
        const d = diatonicOf(key, c);
        const item = { c, numeral: numeral(key, c), fn: d?.fn || null, kind: d ? 'diatonic' : 'outside', why: '' };
        if (d) return item;
        const nextD = next && diatonicOf(key, next);
        // 세컨더리 도미넌트: 다음 코드(키 안, 으뜸화음 아님)의 5도 위 장3화음/7화음
        if (next && nextD && !isTonic(key, next) && isDominantOf(c, next)) {
          item.kind = 'secondary';
          item.numeral = `${c.type === 'dom7' ? 'V7' : 'V'}/${numeral(key, next).replace(/(7|M7|ø7|sus\d)$/, '')}`;
          item.fn = 'D';
          item.why = `세컨더리 도미넌트: 다음 코드 ${next.text}의 V`;
          return item;
        }
        const iv = (c.rootPc - key.pc + 12) % 12;
        if (iv === 1 && fam(c.type) === 'maj') {
          item.kind = 'borrowed';
          item.fn = 'SD';
          item.why = '나폴리 코드 (♭II): 주로 V 앞에 옴';
          return item;
        }
        const pd = diatonicOf(parallel(key), c);
        if (pd) {
          item.kind = 'borrowed';
          item.fn = pd.fn;
          const last = i === chords.length - 1;
          item.why = key.mode === 'minor' && isTonic(parallel(key), c) && last
            ? '피카르디 3화음: 단조 곡을 장3화음으로 종결'
            : `모달 인터체인지: 같은 으뜸음의 ${keyLabel(parallel(key))}에서 차용`;
          return item;
        }
        item.why = '키 밖의 코드 (반음계적). 전조 가능성 있음';
        return item;
      });

      // 종지·자주 쓰는 흐름
      const notes = [];
      for (let i = 0; i + 1 < items.length; i++) {
        const a = items[i], b = items[i + 1];
        const an = a.numeral.replace(/7|M7|ø7/g, ''), bn = b.numeral.replace(/7|M7|ø7/g, '');
        if ((an === 'V' || an === 'vii°') && (bn === 'I' || bn === 'i')) a.cadence = '정격 종지';
        else if ((an === 'IV' || an === 'iv') && (bn === 'I' || bn === 'i')) a.cadence = '변격 종지 (아멘 종지)';
        else if (an === 'V' && (bn === 'vi' || bn === 'VI')) a.cadence = '거짓 종지 (V → vi)';
        if (i + 2 < items.length) {
          const cn = items[i + 2].numeral.replace(/7|M7|ø7/g, '');
          if (/^ii°?$/.test(an) && bn === 'V' && /^(I|i)$/.test(cn)) notes.push(`${i + 1}~${i + 3}번째: ii–V–I`);
        }
      }
      const lastItem = items[items.length - 1];
      if (lastItem && /^V/.test(lastItem.numeral) && !lastItem.numeral.includes('/')) notes.push('반종지: V로 끝남');
      if (lastItem && isTonic(key, lastItem.c)) notes.push('토닉으로 끝남');
      const inside = items.filter((x) => x.kind === 'diatonic').length;
      result = { chords, bad, items, notes, key, ranked, inside };
    }

    // ---------- 그리기 ----------
    function render() {
      if (!active) return;
      el.text.value = st.text;
      if (!result) analyze();
      const { items, bad } = result;
      if (!items.length) {
        el.summary.innerHTML = bad.length ? `인식 불가: ${bad.join(', ')}` : '코드 입력 후 분석';
        el.chords.innerHTML = el.notes.innerHTML = el.transposed.innerHTML = el.capo.innerHTML = el.alt.innerHTML = '';
        ctx.renderBoard([]);
        return;
      }
      const { key, ranked, inside } = result;
      const auto = !st.key;
      const gap = ranked[0].score - ranked[1].score;
      const sure = gap >= 3 ? '확신 높음' : gap >= 1 ? '확신 보통' : '확신 낮음';
      el.summary.innerHTML = `<b>${keyLabel(key)}</b>${auto ? ` (${sure})` : ' (직접 선택)'} · 다이어토닉 ${inside}/${items.length}` +
        (bad.length ? ` · 인식 불가: ${bad.join(', ')}` : '') +
        (items.some((x) => x.c.approx) ? ' · 텐션(9·11·13 등)은 기본 코드로 분석' : '');
      el.key.innerHTML = '<option value="">자동</option>' +
        FIFTHS.flatMap((pc) => [{ pc, mode: 'major' }, { pc: (pc + 9) % 12, mode: 'minor' }])
          .map((k) => `<option value="${k.pc}:${k.mode}">${keyLabel(k)}</option>`).join('');
      el.key.value = st.key ? `${st.key.pc}:${st.key.mode}` : '';
      const alts = ranked.slice(1, 3).filter((r) => r.score >= ranked[0].score - 2);
      el.alt.innerHTML = auto && alts.length ? `다른 후보: ${alts.map((r) => `<button type="button" class="link" data-key="${r.key.pc}:${r.key.mode}">${keyLabel(r.key)}</button>`).join(' ')}` : '';

      el.chords.innerHTML = items.map((it, i) => {
        const fn = it.fn ? `<em class="fn fn-${it.fn}" title="${FUNC[it.fn].label}: ${FUNC[it.fn].desc}">${FUNC[it.fn].short}</em>` : '';
        const tag = it.kind === 'secondary' ? '<span class="a-tag">세컨더리 도미넌트</span>'
          : it.kind === 'borrowed' ? '<span class="a-tag">모달 인터체인지</span>'
            : it.kind === 'outside' ? '<span class="a-tag out">키 밖</span>' : '';
        const cad = it.cadence ? `<div class="a-cad">→ ${it.cadence}</div>` : '';
        return `<div class="a-chord${i === st.selected ? ' on' : ''} ${it.kind}" data-i="${i}">` +
          `<b>${it.c.text === '%' ? items[i - 1]?.c.text || '%' : it.c.text}</b><span class="a-num">${it.numeral}</span>${fn}${tag}${cad}</div>`;
      }).join('');
      const explain = items.map((it, i) => (it.why ? `<li><b>${it.c.text} (${it.numeral})</b> ${it.why}</li>` : '')).filter(Boolean)
        .concat(result.notes.map((n) => `<li>${n}</li>`));
      el.notes.innerHTML = explain.length ? `<ul>${explain.join('')}</ul>` : '<p class="g-empty">모두 다이어토닉 코드</p>';

      renderTools();
      renderBoard();
    }

    function renderTools() {
      const { items, key } = result;
      // 조옮김
      el.shift.innerHTML = [...Array(13).keys()].map((k) => k - 6).map((d) => {
        const to = { pc: (key.pc + d + 12) % 12, mode: key.mode };
        return `<option value="${d}">${d === 0 ? '그대로' : `${d > 0 ? '+' : ''}${d}반음`} → ${keyLabel(to)}</option>`;
      }).join('');
      el.shift.value = st.shift;
      const toKey = { pc: (key.pc + st.shift + 12) % 12, mode: key.mode };
      el.transposed.textContent = items.map((it) => {
        const c = { ...it.c, rootPc: (it.c.rootPc + st.shift + 12) % 12 };
        const name = build(c, toKey).name;
        const bass = it.c.bass != null ? `/${ctx.noteName((it.c.bass + st.shift + 12) % 12, ctx.accFor(toKey.pc, toKey.mode === 'minor' ? 'min' : 'maj'))}` : '';
        return name + bass;
      }).join('  ');

      // 카포: 모든 코드가 오픈 코드 모양이 되는 자리 (기타 전용)
      el.capo.closest('.field').hidden = FretInst.isBass;
      const opts = [];
      for (let capo = 0; capo <= 7; capo++) {
        const shapes = items.map((it) => ({ rootPc: (it.c.rootPc - capo + 12) % 12, type: it.c.type }));
        if (shapes.every((c) => FretChords.shapeOf(c.rootPc, c.type, 'open'))) {
          const shapeKey = { pc: (key.pc - capo + 12) % 12, mode: key.mode };
          opts.push(`<li><b>${capo ? `카포 ${capo}프렛` : '카포 없이'}</b> ${[...new Set(shapes.map((c) => build(c, shapeKey).name))].join(' · ')}<small> (${keyLabel(shapeKey)} 모양)</small></li>`);
        }
      }
      el.capo.innerHTML = opts.length ? `<ul>${opts.slice(0, 4).join('')}</ul>` : '<p class="g-empty">해당 카포 위치 없음 (바레 코드 필요)</p>';
    }

    // 고른 코드의 운지 (오픈 모양이 있으면 그것, 없으면 범위 안 구성음)
    function renderBoard() {
      const it = result.items[st.selected];
      if (!it) { ctx.renderBoard([]); return; }
      const chord = build(it.c);
      if (FretInst.isBass) { ctx.renderBoard(ctx.rangeMarks(chord)); return; } // 베이스는 구성음 자리만
      const shape = FretChords.shapeOf(it.c.rootPc, it.c.type, 'open')
        || FretChords.shapeOf(it.c.rootPc, it.c.type, 'e') || FretChords.shapeOf(it.c.rootPc, it.c.type, 'a');
      const form = FretChords.shapeOf(it.c.rootPc, it.c.type, 'open') ? 'open' : FretChords.shapeOf(it.c.rootPc, it.c.type, 'e') ? 'e' : 'a';
      ctx.renderBoard(shape ? ctx.shapeMarks(chord, shape, form) : ctx.rangeMarks(chord));
    }

    function playChord(c) {
      FretChords.TYPES[c.type].tones.forEach(([semi], k) => ctx.playTone(48 + c.rootPc + semi, k * 0.03, 1.4, 0.13));
    }

    // ---------- 이벤트 ----------
    el.examples.innerHTML = '<option value="">예시</option>' + EXAMPLES.map(([t, name], i) => `<option value="${i}">${name}: ${t}</option>`).join('');
    el.legend.innerHTML = Object.entries(FUNC).map(([k, f]) => `<span><em class="fn fn-${k}">${f.short}</em>${f.label}: ${f.desc}</span>`).join('') +
      '<span>코드 클릭: 운지 표시·재생</span>';
    const run = () => {
      st.text = el.text.value.trim();
      st.key = null;
      st.shift = 0;
      st.selected = -1;
      save();
      analyze();
      render();
    };
    el.run.addEventListener('click', run);
    el.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } });
    el.examples.addEventListener('change', () => {
      const ex = EXAMPLES[+el.examples.value];
      el.examples.value = '';
      if (!ex) return;
      el.text.value = ex[0];
      run();
    });
    el.key.addEventListener('change', () => {
      const [pc, mode] = el.key.value ? el.key.value.split(':') : [];
      st.key = el.key.value ? { pc: +pc, mode } : null;
      analyze();
      render();
    });
    el.alt.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-key]');
      if (!b) return;
      const [pc, mode] = b.dataset.key.split(':');
      st.key = { pc: +pc, mode };
      analyze();
      render();
    });
    el.chords.addEventListener('click', (e) => {
      const card = e.target.closest('.a-chord');
      if (!card) return;
      st.selected = +card.dataset.i;
      playChord(result.items[st.selected].c);
      render();
    });
    el.shift.addEventListener('change', () => { st.shift = +el.shift.value; renderTools(); });
    const progression = () => result.items.map((it) => ({ rootPc: it.c.rootPc, type: it.c.type }));
    el.toJam.addEventListener('click', () => { if (result?.items.length) ctx.sendProgression('jam', progression(), result.key); });
    el.toGuide.addEventListener('click', () => { if (result?.items.length) ctx.sendProgression('guide', progression(), result.key); });

    return {
      activate() { active = true; result = null; render(); },
      deactivate() { active = false; },
      render() { if (active) { analyze(); render(); } },
      onClick() {},
    };
  }

  global.FretAnalyze = { init, parseText, guessKeys };
})(window);

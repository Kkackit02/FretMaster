// 코드 이론(구성음, 철자)과 크로마 기반 코드 판정
(function (global) {
  'use strict';

  // tones: [근음에서 반음 수, 글자 간격(도수-1), 역할 표시]
  const TYPES = {
    maj:  { suffix: '',     label: 'Major', tones: [[0, 0, 'R'], [4, 2, '3'], [7, 4, '5']] },
    min:  { suffix: 'm',    label: 'm',     tones: [[0, 0, 'R'], [3, 2, '♭3'], [7, 4, '5']] },
    dom7: { suffix: '7',    label: '7',     tones: [[0, 0, 'R'], [4, 2, '3'], [7, 4, '5'], [10, 6, '♭7']] },
    maj7: { suffix: 'maj7', label: 'maj7',  tones: [[0, 0, 'R'], [4, 2, '3'], [7, 4, '5'], [11, 6, '7']] },
    min7: { suffix: 'm7',   label: 'm7',    tones: [[0, 0, 'R'], [3, 2, '♭3'], [7, 4, '5'], [10, 6, '♭7']] },
    sus2: { suffix: 'sus2', label: 'sus2',  tones: [[0, 0, 'R'], [2, 1, '2'], [7, 4, '5']] },
    sus4: { suffix: 'sus4', label: 'sus4',  tones: [[0, 0, 'R'], [5, 3, '4'], [7, 4, '5']] },
    dim:  { suffix: 'dim',  label: 'dim',   tones: [[0, 0, 'R'], [3, 2, '♭3'], [6, 4, '♭5']] },
    aug:  { suffix: 'aug',  label: 'aug',   tones: [[0, 0, 'R'], [4, 2, '3'], [8, 4, '♯5']] },
    m7b5: { suffix: 'm7♭5', label: 'm7♭5',  tones: [[0, 0, 'R'], [3, 2, '♭3'], [6, 4, '♭5'], [10, 6, '♭7']] },
  };

  // 자주 쓰는 코드와 대표 운지 (6번 줄 → 1번 줄, x = 치지 않음)
  const SHAPES = {
    maj:  { C: 'x32010', D: 'xx0232', E: '022100', F: '133211', G: '320003', A: 'x02220', B: 'x24442' },
    min:  { Cm: 'x35543', Dm: 'xx0231', Em: '022000', Fm: '133111', Gm: '355333', Am: 'x02210', Bm: 'x24432' },
    dom7: { C7: 'x32310', D7: 'xx0212', E7: '020100', F7: '131211', G7: '320001', A7: 'x02020', B7: 'x21202' },
    maj7: { Cmaj7: 'x32000', Dmaj7: 'xx0222', Emaj7: '021100', Fmaj7: 'xx3210', Gmaj7: '320002', Amaj7: 'x02120' },
    min7: { Cm7: 'x35343', Dm7: 'xx0211', Em7: '020000', Gm7: '353333', Am7: 'x02010', Bm7: 'x20202' },
    sus2: { Csus2: 'x30033', Dsus2: 'xx0230', Gsus2: '3x0233', Asus2: 'x02200' },
    sus4: { Csus4: 'x33011', Dsus4: 'xx0233', Esus4: '022200', Gsus4: '330013', Asus4: 'x02230' },
    dim:  { Cdim: 'x3454x', Ddim: 'xx0131', Bdim: 'x2343x' },
    aug:  { Caug: 'x32110', Eaug: '032110', Gaug: '321003', Aaug: 'x03221' },
    m7b5: { Bm7b5: 'x2323x' },
  };
  const ROOT_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // 운지 형태
  const FORMS = {
    open: { label: '오픈 코드' },
    e:    { label: '6번 줄 근음 바레 (E폼)', string: 6, openPc: 4 },
    a:    { label: '5번 줄 근음 바레 (A폼)', string: 5, openPc: 9 },
  };

  // 바레 모양: 근음 프렛 기준 상대 프렛 (6번 줄 → 1번 줄, null = 치지 않음)
  const MOVABLE = {
    e: {
      maj:  [0, 2, 2, 1, 0, 0],
      min:  [0, 2, 2, 0, 0, 0],
      dom7: [0, 2, 0, 1, 0, 0],
      maj7: [0, 2, 1, 1, 0, 0],
      min7: [0, 2, 0, 0, 0, 0],
      sus4: [0, 2, 2, 2, 0, 0],
      m7b5: [0, null, 0, 0, -1, null],
    },
    a: {
      maj:  [null, 0, 2, 2, 2, 0],
      min:  [null, 0, 2, 2, 1, 0],
      dom7: [null, 0, 2, 0, 2, 0],
      maj7: [null, 0, 2, 1, 2, 0],
      min7: [null, 0, 2, 0, 1, 0],
      sus2: [null, 0, 2, 2, 0, 0],
      sus4: [null, 0, 2, 2, 3, 0],
      dim:  [null, 0, 1, 2, 1, null],
      aug:  [null, 0, 3, 2, 2, 1],
      m7b5: [null, 0, 1, 0, 1, null],
    },
  };

  /** 바레 폼에서 근음이 잡히는 프렛 (개방현 자리는 12프렛으로) */
  function rootFret(rootPc, form) {
    return (rootPc - FORMS[form].openPc + 12) % 12 || 12;
  }

  /** 운지: [{s, f}] (6번 줄부터), 치지 않는 줄은 f = null. 해당 운지가 없으면 null */
  function shapeOf(rootPc, type, form = 'open') {
    if (form !== 'open') {
      const pattern = MOVABLE[form]?.[type];
      if (!pattern) return null;
      const r = rootFret(rootPc, form);
      return pattern.map((d, i) => ({ s: 6 - i, f: d === null ? null : r + d }));
    }
    for (const [name, frets] of Object.entries(SHAPES[type] || {})) {
      if (ROOT_PC[name[0]] !== rootPc) continue;
      return [...frets].map((c, i) => ({ s: 6 - i, f: c === 'x' ? null : +c }));
    }
    return null;
  }

  const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
  const LETTERS = {
    letter: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    solfege: ['도', '레', '미', '파', '솔', '라', '시'],
  };
  const ACC = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };

  // 근음 pc → 글자 인덱스 (변화음이면 선호 표기에 따라 C♯ / D♭)
  function rootLetter(pc, acc) {
    for (let i = 0; i < 7; i++) if (LETTER_PC[i] === pc) return i;
    const target = acc === 'flat' ? (pc + 1) % 12 : (pc + 11) % 12;
    return LETTER_PC.indexOf(target);
  }

  function spell(letterIdx, pc, naming) {
    const i = letterIdx % 7;
    let d = (((pc - LETTER_PC[i]) % 12) + 12) % 12;
    if (d > 6) d -= 12;
    return LETTERS[naming][i] + ACC[d];
  }

  /** 근음/종류로 코드 이름과 구성음 철자를 만든다 (예: B♭ → B♭ D F) */
  function build(rootPc, type, acc = 'sharp', naming = 'letter', retried = false) {
    const T = TYPES[type];
    const rl = rootLetter(rootPc, acc);
    const tones = T.tones.map(([semi, deg, role]) => {
      const pc = (rootPc + semi) % 12;
      return { pc, role, name: spell(rl + deg, pc, naming) };
    });
    // 겹샵/겹플랫이 나오면 반대 표기로 다시 (예: D♯aug → E♭aug)
    if (!retried && tones.some((t) => /[𝄪𝄫]/u.test(t.name))) {
      return build(rootPc, type, acc === 'flat' ? 'sharp' : 'flat', naming, true);
    }
    return { rootPc, type, name: tones[0].name + T.suffix, tones };
  }

  // ---------- 크로마 템플릿 ----------
  // 기타 음은 배음이 강하므로 템플릿에도 배음(옥타브, 5도, 장3도)을 섞어 둔다
  const HARMONICS = [[0, 1], [12, 0.6], [19, 0.36], [24, 0.22], [28, 0.13], [31, 0.08]];
  const TEMPLATES = [];
  for (const type of Object.keys(TYPES)) {
    for (let root = 0; root < 12; root++) {
      const vec = new Float32Array(12);
      for (const [semi] of TYPES[type].tones) {
        for (const [h, w] of HARMONICS) vec[(root + semi + h) % 12] += w;
      }
      let norm = 0;
      for (let k = 0; k < 12; k++) norm += vec[k] * vec[k];
      norm = Math.sqrt(norm);
      for (let k = 0; k < 12; k++) vec[k] /= norm;
      TEMPLATES.push({ rootPc: root, type, vec });
    }
  }

  function cosine(chroma, vec) {
    let dot = 0, norm = 0;
    for (let k = 0; k < 12; k++) { dot += chroma[k] * vec[k]; norm += chroma[k] * chroma[k]; }
    return norm > 0 ? dot / Math.sqrt(norm) : 0;
  }

  /** 크로마와 가장 비슷한 코드 */
  function best(chroma) {
    let top = null;
    for (const t of TEMPLATES) {
      const score = cosine(chroma, t.vec);
      if (!top || score > top.score) top = { rootPc: t.rootPc, type: t.type, score };
    }
    return top;
  }

  /**
   * 친 소리가 목표 코드인지
   * - 목표 코드가 가장 잘 맞는 코드와 거의 같은 점수이고
   * - 5음을 뺀 구성음이 모두 들려야 한다 (5음은 생략하는 보이싱이 많음)
   */
  function matches(chroma, rootPc, type) {
    const target = TEMPLATES.find((t) => t.rootPc === rootPc && t.type === type);
    const score = cosine(chroma, target.vec);
    const top = best(chroma);
    const tonesHeard = TYPES[type].tones.every(([semi, , role]) =>
      role === '5' || chroma[(rootPc + semi) % 12] >= 0.15);
    return score >= 0.75 && score >= top.score - 0.03 && tonesHeard;
  }

  /** 근음에서 semi 반음, 글자로 step칸 떨어진 음의 철자 (스케일용, 예: F 메이저의 4음 → B♭) */
  function spellDegree(rootPc, semi, step, acc = 'sharp', naming = 'letter') {
    return spell(rootLetter(rootPc, acc) + step, (rootPc + semi) % 12, naming);
  }

  global.FretChords = { TYPES, FORMS, build, best, matches, shapeOf, rootFret, spellDegree };
})(window);

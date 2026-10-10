// 드럼: 루디먼트 / 액센트 / 그루브 / 리딩 악보 + 소리
(function (global) {
  'use strict';

  // 길이 → 틱 (4분음표 = 24틱이라 셋잇단·여섯잇단·32분음표·점음표가 모두 정수)
  const TICKS = { 2: 48, d4: 36, 4: 24, d8: 18, 8: 12, d16: 9, 16: 6, 32: 3, '8t': 8, '16t': 4 };
  const BEAMS = { 48: 0, 36: 0, 24: 0, 18: 1, 12: 1, 9: 2, 8: 1, 6: 2, 4: 2, 3: 3 };
  const DOTTED = new Set([36, 18, 9]);
  const TUPLET = { 8: 3, 4: 6 };
  const BAR = 96; // 4/4 한 마디

  // ---------- 루디먼트 ----------
  // 토큰: [꾸밈음(소문자)][손 R·L 또는 발 K][>액센트][:길이]  예) lR>  llR  R>:8  K  /  unit = 기본 길이
  const RUDIMENTS = [
    { id: 'single', cat: '롤', name: '싱글 스트로크 롤', unit: 16, pattern: 'R L R L R L R L',
      desc: '양손 교대로 한 번씩. 양손 음량을 같게.' },
    { id: 'double', cat: '롤', name: '더블 스트로크 롤', unit: 16, pattern: 'R R L L R R L L',
      desc: '한 손에 두 번씩. 두 번째 타는 리바운드로, 첫 타와 같은 음량.' },
    { id: 'five', cat: '롤', name: '파이브 스트로크 롤', unit: 32, pattern: 'R R L L R>:8 L L R R L>:8',
      desc: '더블 두 번 + 액센트 한 번.' },
    { id: 'seven', cat: '롤', name: '세븐 스트로크 롤', unit: '16t', pattern: 'R R L L R R L>:4 L L R R L L R>:4',
      desc: '더블 세 번 + 액센트 한 번.' },
    { id: 'para', cat: '패러디들', name: '싱글 패러디들', unit: 16, pattern: 'R> L R R L> R L L',
      desc: '싱글 두 번 + 더블 한 번 (RLRR LRLL). 첫 음 액센트, 박마다 시작 손이 바뀜.' },
    { id: 'dpara', cat: '패러디들', name: '더블 패러디들', unit: '16t', pattern: 'R> L R L R R L> R L R L L',
      desc: '싱글 네 번 + 더블 한 번. 여섯잇단.' },
    { id: 'tpara', cat: '패러디들', name: '트리플 패러디들', unit: 16, pattern: 'R> L R L R L R R L> R L R L R L L',
      desc: '싱글 여섯 번 + 더블 한 번. 두 박마다 시작 손이 바뀜.' },
    { id: 'pdd', cat: '패러디들', name: '패러디들-디들', unit: '16t', pattern: 'R> L R R L L R> L R R L L',
      desc: '싱글 두 번 + 더블 두 번 (RLRRLL). 시작 손이 바뀌지 않음.' },
    { id: 'flam', cat: '플램', name: '플램', unit: 4, pattern: 'lR rL lR rL',
      desc: '꾸밈음(약하게) 직후 주음(세게). 두 소리가 겹치지 않게.' },
    { id: 'flamtap', cat: '플램', name: '플램 탭', unit: 16, pattern: 'lR R rL L lR R rL L',
      desc: '플램 + 같은 손 탭.' },
    { id: 'flamacc', cat: '플램', name: '플램 액센트', unit: '8t', pattern: 'lR> L R rL> R L',
      desc: '셋잇단 첫 음에 플램과 액센트. 박마다 시작 손이 바뀜.' },
    { id: 'flamacue', cat: '플램', name: '플라마큐', unit: 16, pattern: 'lR L> R L lR:4',
      desc: '두 번째 음에 액센트. 처음과 끝은 플램.' },
    { id: 'flampara', cat: '플램', name: '플램 패러디들', unit: 16, pattern: 'lR> L R R rL> R L L',
      desc: '싱글 패러디들의 첫 음을 플램으로.' },
    { id: 'swiss', cat: '플램', name: '스위스 아미 트리플렛', unit: '8t', pattern: 'lR R L lR R L',
      desc: '플램 + 같은 손 + 반대 손. 시작 손이 바뀌지 않음.' },
    { id: 'drag', cat: '드래그', name: '드래그 (러프)', unit: 4, pattern: 'llR rrL llR rrL',
      desc: '같은 손 꾸밈음 두 개 + 반대 손 주음.' },
    { id: 'rlk', cat: '손발 조합', name: '손손발 셋잇단 (RLK)', unit: '8t', pattern: 'R> L K R> L K',
      desc: '오른손·왼손·킥 셋잇단. 킥 음량을 손과 같게.' },
    { id: 'rlrk', cat: '손발 조합', name: 'RLRK', unit: 16, pattern: 'R> L R K R> L R K',
      desc: '16분 네 개 중 마지막이 킥. 박의 첫 음은 항상 오른손.' },
    { id: 'rllk', cat: '손발 조합', name: 'RLLK', unit: 16, pattern: 'R> L L K R> L L K',
      desc: '오른손 + 왼손 더블 + 킥.' },
    { id: 'rklk', cat: '손발 조합', name: 'RKLK', unit: 16, pattern: 'R> K L K R> K L K',
      desc: '손과 킥 교대. 킥은 16분 뒷박.' },
    { id: 'gospel', cat: '손발 조합', name: '가스펠 식스 (RLRLKK)', unit: '16t', pattern: 'R> L R L K K R> L R L K K',
      desc: '여섯잇단: 손 네 번 + 킥 두 번.' },
  ];

  const KICK_MODES = { none: '킥 없음', beat: '매 박 (4분음표)', half: '1·3박', accent: '액센트마다' };
  const HAND_CLS = { R: 'r', L: 'l', K: 'k' };

  function parseRudiment(r, kickMode) {
    let t = 0;
    const linear = r.pattern.includes('K');
    return r.pattern.split(/\s+/).map((tok) => {
      const m = tok.match(/^([rl]*)([RLK])(>?)(?::(\w+))?$/);
      const ticks = TICKS[m[4] || r.unit];
      const hand = m[2];
      const accent = !!m[3];
      const kick = !linear && hand !== 'K' && (
        (kickMode === 'beat' && t % 24 === 0) || (kickMode === 'half' && t % 48 === 0) || (kickMode === 'accent' && accent));
      const n = {
        t, ticks, accent, hand, graces: m[1].toUpperCase(),
        heads: hand === 'K' ? ['K'] : kick ? ['S', 'K'] : ['S'],
        labels: [{ text: hand, cls: HAND_CLS[hand] }, kick ? { text: 'K', cls: 'k' } : null],
      };
      t += ticks;
      return n;
    });
  }

  // ---------- 액센트 ----------
  const STICKINGS = {
    single: { label: '싱글 (RLRL)', seq: 'RL' },
    double: { label: '더블 (RRLL)', seq: 'RRLL' },
    para: { label: '패러디들 (RLRR LRLL)', seq: 'RLRRLRLL' },
    right: { label: '오른손만', seq: 'R' },
    left: { label: '왼손만', seq: 'L' },
  };
  const ACCENT_TYPES = {
    shift16: { label: '액센트 이동 (16분)', desc: '마디마다 액센트 위치 이동: 1 → e → & → a. 나머지는 탭.' },
    shift8t: { label: '액센트 이동 (셋잇단)', desc: '마디마다 액센트 위치 이동: 1 → 2 → 3번째 음.' },
    group: { label: '그룹핑 (N개마다 액센트)', desc: '16분 위에 N개마다 액센트. 3·5·7은 박과 어긋남.' },
    random: { label: '랜덤 액센트', desc: '랜덤 액센트 패턴.' },
    custom: { label: '직접 만들기', desc: '음표를 눌러 액센트 켜기·끄기.' },
  };
  const STROKE_NAME = { F: '풀', D: '다운', U: '업', T: '탭' };

  function accentExercise(type, n, stick, customAcc) {
    let count, unit, accentAt;
    if (type === 'shift16') { count = 64; unit = 6; accentAt = (i) => i % 4 === Math.floor(i / 16); }
    else if (type === 'shift8t') { count = 36; unit = 8; accentAt = (i) => i % 3 === Math.floor(i / 12); }
    else if (type === 'group') { count = 32; unit = 6; accentAt = (i) => i % n === 0; }
    else { count = customAcc.length; unit = 6; accentAt = (i) => customAcc[i]; }
    const seq = STICKINGS[stick].seq;
    const notes = [];
    for (let i = 0; i < count; i++) {
      const hand = seq[i % seq.length];
      notes.push({ t: i * unit, ticks: unit, hand, accent: !!accentAt(i), graces: '', heads: ['S'], labels: [{ text: hand, cls: HAND_CLS[hand] }] });
    }
    // 업·다운 스트로크: 같은 손의 다음 음이 액센트인지에 따라 정해짐
    notes.forEach((nt, i) => {
      let j = (i + 1) % notes.length;
      while (notes[j].hand !== nt.hand) j = (j + 1) % notes.length;
      const nextAcc = notes[j].accent;
      nt.stroke = nt.accent ? (nextAcc ? 'F' : 'D') : (nextAcc ? 'U' : 'T');
    });
    return notes;
  }

  function randomAccents() {
    const out = [];
    for (let i = 0; i < 32; i++) out.push(Math.random() < 0.3);
    if (!out.some(Boolean)) out[0] = true;
    return out;
  }

  // ---------- 그루브 ----------
  // 한 줄 = 한 마디. 16칸이면 16분음표, 12칸이면 셋잇단 8분음표 한 칸
  // H: x 하이햇 o 오픈   C: 라이드   X: 크래시   P: 하이햇 페달
  // S: x 스네어 g 고스트 노트 r 크로스 스틱   T: 1 하이 탐 2 미드 탐 3 플로어 탐   K: 킥
  const GROOVES = [
    { id: 'rock8', cat: '록·팝', name: '기본 8비트', desc: '하이햇 8분, 스네어 2·4박, 킥 1·3박.',
      H: 'x-x-x-x-x-x-x-x-', S: '----x-------x---', K: 'x-------x-------' },
    { id: 'rock8b', cat: '록·팝', name: '8비트 (킥 3&)', desc: '기본 8비트 + 3박 뒷박 킥.',
      H: 'x-x-x-x-x-x-x-x-', S: '----x-------x---', K: 'x-------x-x-----' },
    { id: 'rock8c', cat: '록·팝', name: '8비트 (킥 2&)', desc: '기본 8비트 + 2박 뒷박 킥.',
      H: 'x-x-x-x-x-x-x-x-', S: '----x-------x---', K: 'x-----x-x-------' },
    { id: 'quarter', cat: '록·팝', name: '4비트 록', desc: '하이햇 4분, 스네어 2·4박, 킥 1·3박.',
      H: 'x---x---x---x---', S: '----x-------x---', K: 'x-------x-------' },
    { id: 'sixteen', cat: '록·팝', name: '16비트', desc: '하이햇 16분 (양손 교대). 2·4박 스네어는 오른손.',
      H: 'xxxxxxxxxxxxxxxx', S: '----x-------x---', K: 'x-------x-x-----' },
    { id: 'half', cat: '록·팝', name: '하프타임', desc: '스네어 3박만.',
      H: 'x-x-x-x-x-x-x-x-', S: '--------x-------', K: 'x-----x---------' },
    { id: 'synco', cat: '록·팝', name: '싱코페이션 킥', desc: '킥이 e·a 자리에도 들어가는 패턴.',
      H: 'x-x-x-x-x-x-x-x-', S: '----x-------x---', K: 'x--x--x---x-----' },
    { id: 'ride', cat: '록·팝', name: '라이드 8비트', desc: '기본 8비트를 라이드로. 하이햇은 발로 2·4박.',
      C: 'x-x-x-x-x-x-x-x-', P: '----x-------x---', S: '----x-------x---', K: 'x-------x-x-----' },
    { id: 'skank', cat: '록·팝', name: '스캥크 (펑크 록)', desc: '빠른 투비트. 킥은 매 박, 스네어는 매 박 뒷박.',
      H: 'x-x-x-x-x-x-x-x-', S: '--x---x---x---x-', K: 'x---x---x---x---' },
    { id: 'tom', cat: '록·팝', name: '플로어 탐 그루브', desc: '하이햇 대신 플로어 탐 8분.',
      T: '3-3-3-3-3-3-3-3-', S: '----x-------x---', K: 'x--x----x-x-----' },
    { id: 'disco', cat: '펑크·소울', name: '디스코', desc: '킥 매 박 (포 온 더 플로어) + 뒷박 오픈 하이햇.',
      H: 'x-o-x-o-x-o-x-o-', S: '----x-------x---', K: 'x---x---x---x---' },
    { id: 'motown', cat: '펑크·소울', name: '모타운', desc: '스네어 매 박. 2·4박을 더 세게 들리게.',
      H: 'x-x-x-x-x-x-x-x-', S: 'x---x---x---x---', K: 'x-----x-x-------' },
    { id: 'funk', cat: '펑크·소울', name: '펑크 (고스트 노트)', desc: '괄호 음표 = 고스트 노트. 아주 작게 쳐서 그루브만 채움.',
      H: 'x-x-x-x-x-x-x-x-', S: '----x--g-g--x--g', K: 'x-x-------x-----' },
    { id: 'hiphop', cat: '펑크·소울', name: '힙합 (붐뱁)', desc: '느린 템포에서 킥을 뒤로 끌지 않게.',
      H: 'x-x-x-x-x-x-x-x-', S: '----x-------x---', K: 'x------x--x-----' },
    { id: 'shuffle', cat: '셔플·스윙', name: '셔플', desc: '8분음표를 셋잇단 비율(2:1)로 스윙. 표기는 8분.', swing: true,
      H: 'x-x-x-x-x-x-x-x-', S: '----x-------x---', K: 'x-------x-------' },
    { id: 'blues128', cat: '셔플·스윙', name: '12/8 슬로우 블루스', desc: '한 박을 셋잇단 셋으로. 하이햇 셋잇단 계속.',
      H: 'xxxxxxxxxxxx', S: '---x-----x--', K: 'x-----x-x---' },
    { id: 'purdie', cat: '셔플·스윙', name: '하프타임 셔플', desc: '셋잇단 가운데 음은 고스트 노트, 백비트는 3박.',
      H: 'x-xx-xx-xx-x', S: '-g--g-xg--g-', K: 'x-------x---' },
    { id: 'jazz', cat: '셔플·스윙', name: '재즈 스윙', desc: '라이드 "칭 칭-가 칭", 하이햇 페달 2·4박. 스윙.', swing: true,
      C: 'x---x-x-x---x-x-', P: '----x-------x---', S: '----------g-----', K: '----------------' },
    { id: 'onedrop', cat: '라틴·기타', name: '원 드롭 (레게)', desc: '1박 비움. 3박에 킥과 스네어.',
      H: 'x-x-x-x-x-x-x-x-', S: '--------x-------', K: '--------x-------' },
    { id: 'bossa', cat: '라틴·기타', name: '보사노바', desc: '크로스 스틱으로 클라베 리듬, 킥은 "쿵 따쿵" 반복.',
      H: 'x-x-x-x-x-x-x-x-', S: 'r--r--r---r--r--', K: 'x--xx--xx--xx--x' },
  ];
  const GROOVE_ROWS = {
    H: { x: 'H', o: 'O' }, C: { x: 'C' }, X: { x: 'X' }, T: { 1: '1', 2: '2', 3: '3' },
    S: { x: 'S', g: 'G', r: 'M' }, K: { x: 'K' }, P: { x: 'P' },
  };
  const COUNT16 = ['', 'e', '&', 'a'];

  function countLabel(t) {
    const beat = Math.floor((t % BAR) / 24) + 1;
    const off = t % 24;
    if (off === 0) return String(beat);
    if (off % 6 === 0) return COUNT16[off / 6];
    if (off === 8) return 'trip';
    if (off === 16) return 'let';
    return '';
  }

  function grooveNotes(g) {
    const len = g.K.length;
    const unit = BAR / len; // 16칸 = 6틱, 12칸 = 8틱
    const steps = [];
    for (let i = 0; i < len; i++) {
      const heads = [];
      for (const [row, map] of Object.entries(GROOVE_ROWS)) {
        const h = g[row] && map[g[row][i]];
        if (h) heads.push(h);
      }
      steps.push(heads);
    }
    const notes = [];
    steps.forEach((heads, i) => {
      if (!heads.length) return;
      let j = i + 1;
      while (j < len && !steps[j].length) j++;
      const t = i * unit;
      notes.push({ t, ticks: (j - i) * unit, heads, accent: false, graces: '', labels: [{ text: countLabel(t), cls: 'c' }] });
    });
    return notes;
  }

  // ---------- 필인 ----------
  // start: 필인이 시작하는 틱 (그 앞은 그루브 그대로), unit: 한 칸 길이, steps: 칸마다 악기(+로 동시), stick: 칸마다 손
  const FILLS = [
    { id: 'eighth', name: '8분 탐 다운 (쉬움)', unit: 12, steps: 'S S 1 1 2 2 3 3', stick: 'R L R L R L R L',
      desc: '스네어 → 하이 탐 → 미드 탐 → 플로어 탐, 8분음표로 두 번씩.' },
    { id: 'snare16', name: '스네어 16분', unit: 6, steps: 'S S S S S S S S S S S S S S S S', stick: 'R L R L R L R L R L R L R L R L',
      desc: '한 마디 내내 스네어 16분. 마디 끝까지 템포 유지.' },
    { id: 'tom16', name: '16분 탐 다운', unit: 6, steps: 'S S S S 1 1 1 1 2 2 2 2 3 3 3 3', stick: 'R L R L R L R L R L R L R L R L',
      desc: '한 박마다 스네어 → 하이 → 미드 → 플로어.' },
    { id: 'beat4', name: '4박 필 (한 박)', start: 72, unit: 6, steps: 'S S 2 3', stick: 'R L R L',
      desc: '3박까지 그루브, 마지막 한 박만 필인. 그루브로 돌아오는 연습에 좋음.' },
    { id: 'half', name: '3·4박 필 (두 박)', start: 48, unit: 6, steps: 'S S S S 1 1 3 3', stick: 'R L R L R L R L',
      desc: '두 박은 그루브, 뒤 두 박은 필인.' },
    { id: 'trip', name: '셋잇단 탐 다운', unit: 8, steps: 'S S S 1 1 1 2 2 2 3 3 3', stick: 'R L R L R L R L R L R L',
      desc: '셋잇단으로 한 박씩 내려감. 박마다 시작 손이 바뀜.' },
    { id: 'linear', name: '리니어 (손손발)', unit: 6, steps: 'S S K 1 1 K 2 2 K 3 3 K S S 3 3', stick: 'R L K R L K R L K R L K R L R L',
      desc: '손손발 셋 묶음이 박과 어긋나게 돌다가 마지막 박에서 맞춰짐.' },
  ];
  const FILL_BARS = { 0: '필인 없음', 1: '1마디 + 필인', 3: '3마디 + 필인', 7: '7마디 + 필인' };

  /** 그루브 한 마디 중 start 이후를 필인으로 바꾼 마디 (t는 0부터) */
  function fillBar(g, f) {
    const start = f.start || 0;
    const notes = grooveNotes(g).filter((n) => n.t < start).map((n) => ({ ...n, ticks: Math.min(n.ticks, start - n.t) }));
    const steps = f.steps.split(' ');
    const stick = f.stick.split(' ');
    steps.forEach((tok, k) => {
      const t = start + k * f.unit;
      const hand = stick[k];
      notes.push({
        t, ticks: f.unit, heads: tok.split('+'), hand, accent: false, graces: '',
        labels: [{ text: countLabel(t), cls: 'c' }, { text: hand, cls: HAND_CLS[hand] }],
      });
    });
    return notes;
  }

  // ---------- 서브디비전 ----------
  const SUBS = { 1: ['4분', 24], 2: ['8분', 12], 3: ['셋잇단', 8], 4: ['16분', 6], 6: ['6잇단', 4], 8: ['32분', 3] };
  const LADDERS = {
    up: { label: '4분 → 8분 → 셋잇단 → 16분', seq: [1, 2, 3, 4] },
    updown: { label: '올라갔다 내려오기 (6잇단까지)', seq: [1, 2, 3, 4, 6, 4, 3, 2] },
    swap: { label: '8분 ↔ 셋잇단 ↔ 16분', seq: [2, 3, 4, 3] },
    full: { label: '4분 → 32분 전부', seq: [1, 2, 3, 4, 6, 8] },
  };

  function subNotes(ladder, barsEach) {
    const notes = [];
    let t = 0;
    let k = 0;
    for (const d of LADDERS[ladder].seq) {
      const ticks = SUBS[d][1];
      for (let i = 0; i < barsEach * 4 * d; i++) {
        const hand = k++ % 2 ? 'L' : 'R';
        notes.push({
          t, ticks, hand, accent: t % 24 === 0, graces: '', heads: ['S'],
          labels: [{ text: hand, cls: HAND_CLS[hand] }, i === 0 ? { text: SUBS[d][0], cls: 'c' } : null],
        });
        t += ticks;
      }
    }
    return notes;
  }

  // ---------- 리딩 ----------
  // 한 박 / 두 박짜리 리듬 조각 (틱)
  const FIGURES = {
    easy: [[24], [24], [12, 12], [12, 12], [48]],
    mid: [[24], [12, 12], [12, 12], [48], [36, 12], [12, 24, 12]],
    hard: [[24], [12, 12], [36, 12], [12, 24, 12], [6, 6, 12], [12, 6, 6], [6, 12, 6], [18, 6], [6, 6, 6, 6]],
  };

  function readingNotes(level, bars, showCount) {
    const figs = FIGURES[level];
    const notes = [];
    let t = 0;
    for (let b = 0; b < bars; b++) {
      let beat = 0;
      while (beat < 4) {
        const ok = figs.filter((f) => {
          const len = f.reduce((a, x) => a + x, 0) / 24;
          return len <= 4 - beat && (len === 1 || beat % 2 === 0); // 두 박짜리는 1·3박에서만
        });
        const fig = ok[Math.floor(Math.random() * ok.length)];
        for (const ticks of fig) {
          notes.push({ t, ticks, heads: ['S'], accent: false, graces: '', labels: [showCount ? { text: countLabel(t), cls: 'c' } : null] });
          t += ticks;
        }
        beat += fig.reduce((a, x) => a + x, 0) / 24;
      }
    }
    return notes;
  }

  // ---------- 악보 그리기 ----------
  const STAFFS = {
    one: { lines: [60], pos: { S: 60, K: 73 }, top: 44, bottom: 76, dots: [53, 67] },
    five: {
      lines: [40, 50, 60, 70, 80], top: 40, bottom: 80, dots: [55, 65],
      pos: { X: 30, H: 35, O: 35, C: 40, 1: 45, 2: 50, S: 55, G: 55, M: 55, 3: 65, K: 75, P: 85 },
    },
  };

  const X_HEADS = new Set(['H', 'O', 'C', 'X', 'P', 'M']);

  function drawHead(inst, x, y, ticks, cls) {
    if (X_HEADS.has(inst)) {
      let out = `<path class="d-xhead ${cls}" d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x - 5} ${y + 5}L${x + 5} ${y - 5}"/>`;
      if (inst === 'O') out += `<circle class="d-open" cx="${x}" cy="${y - 13}" r="3.5"/>`;
      if (inst === 'X') out += `<line class="d-staff" x1="${x - 9}" y1="${y}" x2="${x + 9}" y2="${y}"/>`; // 덧줄
      if (inst === 'M') out += `<circle class="d-open" cx="${x}" cy="${y}" r="7"/>`;                     // 크로스 스틱
      return out;
    }
    const hollow = ticks >= 48;
    const head = `<ellipse class="${hollow ? 'hollow ' : ''}${cls}" cx="${x}" cy="${y}" rx="6.2" ry="4.4" transform="rotate(-20 ${x} ${y})"/>`;
    if (inst === 'G') return head + `<text class="d-paren" x="${x - 11}" y="${y + 5}">(</text><text class="d-paren" x="${x + 11}" y="${y + 5}">)</text>`;
    return head;
  }

  function measureLine(staff, x) {
    return `<line class="d-staff" x1="${x}" y1="${staff.top}" x2="${x}" y2="${staff.bottom}"/>`;
  }

  function repeatSign(staff, x0, dir) {
    const thin = x0 + 6 * dir, dots = x0 + 12 * dir;
    return `<rect class="d-bar" x="${Math.min(x0, x0 + 4 * dir)}" y="${staff.top}" width="4" height="${staff.bottom - staff.top}"/>` +
      measureLine(staff, thin) +
      staff.dots.map((y) => `<circle class="d-dot" cx="${dots}" cy="${y}" r="2.2"/>`).join('');
  }

  /** 한 줄(시스템) 그리기. notes에는 전체 인덱스(i)가 들어 있음 */
  function drawLine(notes, { staffId, first, last, timeTop, editable, rows }) {
    const staff = STAFFS[staffId];
    const parts = [];
    let x = first ? 92 : 40;
    let prevBar = Math.floor(notes[0].t / BAR);
    const bars = [];
    for (const n of notes) {
      const bar = Math.floor(n.t / BAR);
      if (bar !== prevBar) { bars.push(x - 10); x += 12; prevBar = bar; }
      x += n.graces.length ? 12 + n.graces.length * 13 : 0;
      n.x = x;
      x += 24 + Math.min(n.ticks, 24) * 1.7 + (DOTTED.has(n.ticks) ? 6 : 0);
    }
    const width = x + 30;

    staff.lines.forEach((y) => parts.push(`<line class="d-staff" x1="10" y1="${y}" x2="${width - 10}" y2="${y}"/>`));
    if (first) {
      if (staffId === 'five') {
        parts.push(`<text class="d-time big" x="30" y="${58}">${timeTop}</text><text class="d-time big" x="30" y="${78}">4</text>`);
      } else {
        parts.push(`<text class="d-time" x="30" y="${56}">${timeTop}</text><text class="d-time" x="30" y="${78}">4</text>`);
      }
      parts.push(repeatSign(staff, 52, 1));
    } else {
      parts.push(measureLine(staff, 12));
    }
    bars.forEach((bx) => parts.push(measureLine(staff, bx)));
    parts.push(last ? repeatSign(staff, width - 16, -1) : measureLine(staff, width - 12));

    const lowest = Math.max(...notes.flatMap((n) => n.heads.map((h) => staff.pos[h])), staff.bottom);
    const accentY = lowest + 17;
    const rowY = (r) => accentY + 18 + r * 16;

    // 박 단위로 빔 묶기
    const groups = [];
    for (const n of notes) {
      const beat = Math.floor(n.t / 24);
      const last = groups[groups.length - 1];
      if (last && last.beat === beat && BEAMS[n.ticks] > 0 && BEAMS[last.notes[0].ticks] > 0) last.notes.push(n);
      else groups.push({ beat, notes: [n] });
    }
    for (const g of groups) {
      const tops = g.notes.map((n) => Math.min(...n.heads.map((h) => staff.pos[h])));
      g.beamY = Math.min(...tops) - (staffId === 'five' ? 30 : 34);
      g.notes.forEach((n) => { n.beamY = g.beamY; });
    }

    for (const n of notes) {
      const ys = n.heads.map((h) => staff.pos[h]);
      const sx = n.x + 5.6;
      // 꾸밈음 (한 줄 보표의 스네어)
      if (n.graces) {
        const gx = n.graces.split('').map((_, k) => n.x - 15 - (n.graces.length - 1 - k) * 13);
        gx.forEach((g) => {
          parts.push(`<ellipse class="d-grace" cx="${g}" cy="${staff.pos.S}" rx="3.7" ry="2.7" transform="rotate(-20 ${g} ${staff.pos.S})"/>`);
          parts.push(`<line class="d-stem" x1="${g + 3.4}" y1="${staff.pos.S - 1}" x2="${g + 3.4}" y2="${staff.pos.S - 26}"/>`);
        });
        if (gx.length === 1) {
          parts.push(`<line class="d-stem" x1="${gx[0] - 1}" y1="${staff.pos.S - 12}" x2="${gx[0] + 8}" y2="${staff.pos.S - 22}"/>`);
        } else {
          for (const off of [0, 4]) {
            parts.push(`<line class="d-beam-thin" x1="${gx[0] + 3.4}" y1="${staff.pos.S - 26 + off}" x2="${gx[gx.length - 1] + 3.4}" y2="${staff.pos.S - 26 + off}"/>`);
          }
        }
        gx.forEach((g, k) => parts.push(`<text class="d-stick grace" x="${g}" y="${rowY(0)}">${n.graces[k].toLowerCase()}</text>`));
      }
      const heads = n.heads.map((h) => drawHead(h, n.x, staff.pos[h], n.ticks, n.hand === 'K' || h === 'K' ? 'kick' : '')).join('');
      const dots = DOTTED.has(n.ticks)
        ? n.heads.map((h) => `<circle class="d-dot" cx="${n.x + 11}" cy="${staff.pos[h] - (staff.lines.includes(staff.pos[h]) ? 4 : 0)}" r="2"/>`).join('')
        : '';
      const hit = editable ? `<rect class="d-hit" x="${n.x - 10}" y="${n.beamY - 6}" width="20" height="${accentY - n.beamY + 12}"/>` : '';
      parts.push(`<g class="d-note${n.ghost ? ' ghost' : ''}" data-i="${n.i}">${hit}${heads}${dots}` +
        `<line class="d-stem" x1="${sx}" y1="${Math.max(...ys) - 2}" x2="${sx}" y2="${n.beamY}"/></g>`);
      if (n.accent) parts.push(`<text class="d-accent" x="${n.x}" y="${accentY}">&gt;</text>`);
      for (let r = 0; r < rows; r++) {
        const lab = n.labels[r];
        if (lab) parts.push(`<text class="d-stick ${lab.cls}" data-i="${n.i}" x="${n.x}" y="${rowY(r)}">${lab.text}</text>`);
      }
    }

    // 빔 / 깃발 / 잇단음표 숫자
    for (const g of groups) {
      const ns = g.notes;
      if (!BEAMS[ns[0].ticks]) continue;
      if (ns.length === 1) {
        const n = ns[0];
        for (let k = 0; k < BEAMS[n.ticks]; k++) {
          parts.push(`<path class="d-flag" d="M${n.x + 5.6} ${g.beamY + k * 7} q 10 6 8 18"/>`);
        }
        continue;
      }
      const first = ns[0].x + 5.6, lastX = ns[ns.length - 1].x + 5.6;
      parts.push(`<rect class="d-beam" x="${first - 0.8}" y="${g.beamY}" width="${lastX - first + 1.6}" height="4"/>`);
      for (let level = 2; level <= 3; level++) {
        const y = g.beamY + (level - 1) * 7;
        let k = 0;
        while (k < ns.length) {
          if (BEAMS[ns[k].ticks] < level) { k++; continue; }
          let j = k;
          while (j + 1 < ns.length && BEAMS[ns[j + 1].ticks] >= level) j++;
          let a = ns[k].x + 5.6, b = ns[j].x + 5.6;
          if (k === j) { if (k === 0) b = a + 9; else a = b - 9; } // 혼자면 옆으로 짧게
          parts.push(`<rect class="d-beam" x="${a - 0.8}" y="${y}" width="${b - a + 1.6}" height="4"/>`);
          k = j + 1;
        }
      }
      const tup = TUPLET[ns[0].ticks];
      if (tup && ns.every((n) => TUPLET[n.ticks])) {
        parts.push(`<text class="d-tuplet" x="${(first + lastX) / 2}" y="${g.beamY - 6}">${tup}</text>`);
      }
    }

    // 크래시처럼 높은 음의 빔이 위로 잘리지 않게 아래로 밀기
    const shift = Math.max(0, 16 - Math.min(...groups.map((g) => g.beamY)));
    const height = rowY(Math.max(rows, 1) - 1) + 8 + shift;
    return `<svg viewBox="0 0 ${width} ${height}" style="width:${Math.round(width * 1.3)}px" role="img" aria-label="드럼 악보"><g transform="translate(0 ${shift})">${parts.join('')}</g></svg>`;
  }

  /** 마디 단위로 줄을 나눠 그림 */
  function drawScore(score, editable) {
    const notes = score.notes;
    notes.forEach((n, i) => { n.i = i; });
    const total = notes.reduce((a, n) => a + n.ticks, 0);
    const barTicks = Math.min(total, BAR);
    // 글자 줄 수: 마지막으로 내용이 있는 줄까지
    const rows = Math.max(0, ...notes.map((n) => n.labels.reduce((k, lab, r) => (lab ? r + 1 : k), 0)));
    // 마디별로 묶고, 한 줄에 음표 18개 정도까지
    const measures = [];
    for (const n of notes) {
      const m = Math.floor(n.t / barTicks);
      (measures[m] ||= []).push(n);
    }
    const lines = [];
    let cur = [];
    for (const m of measures.filter(Boolean)) {
      if (cur.length && cur.length + m.length > 18) { lines.push(cur); cur = []; }
      cur = cur.concat(m);
    }
    if (cur.length) lines.push(cur);
    const timeTop = barTicks / 24;
    return lines.map((ln, k) => drawLine(ln, {
      staffId: score.staff, first: k === 0, last: k === lines.length - 1, timeTop, editable, rows,
    })).join('');
  }

  // ---------- 소리 ----------
  let ac = null;
  let noise = null;

  function audio() {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    if (!noise) {
      noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.5), ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return ac;
  }

  function noiseHit(time, { freq, type, q = 0.7, level, decay, pan = 0 }) {
    const ctx = audio();
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);
    let node = src.connect(f).connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(ctx.destination);
    src.start(time);
    src.stop(time + decay + 0.05);
  }

  // 스네어: 스네어 줄 소리(잡음) + 몸통(짧은 저음). 오른손은 오른쪽, 왼손은 왼쪽
  function snare(time, hand, level) {
    const ctx = audio();
    const pan = hand === 'R' ? 0.35 : hand === 'L' ? -0.35 : 0;
    noiseHit(time, { freq: 2400, type: 'bandpass', level, decay: 0.06 + level * 0.12, pan });
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(hand === 'L' ? 185 : 200, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 0.7, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
    let node = osc.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      node = node.connect(p);
    }
    node.connect(ctx.destination);
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
    noiseHit(time, { freq: 1200, type: 'lowpass', level: level * 0.25, decay: 0.02 });
  }

  function hat(time, open, level) {
    noiseHit(time, { freq: 7000, type: 'highpass', level, decay: open ? 0.32 : 0.045, pan: 0.15 });
  }

  // 탐: 음높이가 조금 떨어지는 사인파
  function tom(time, freq, level) {
    const ctx = audio();
    const osc = ctx.createOscillator();
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.62, time + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
    osc.connect(g).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.45);
    noiseHit(time, { freq: 1800, type: 'bandpass', level: level * 0.25, decay: 0.03 });
  }

  // 심벌: 서로 안 맞는 높이의 사각파 여러 개 + 고역 잡음 (금속성 소리)
  function cymbal(time, level, decay, pan = -0.2) {
    const ctx = audio();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level * 0.5, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + decay);
    let node = hp.connect(g);
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node = node.connect(p); }
    node.connect(ctx.destination);
    for (const f of [205.3, 304.4, 369.6, 522.7, 540, 800]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f * 1.7;
      o.connect(hp);
      o.start(time);
      o.stop(time + decay + 0.05);
    }
    noiseHit(time, { freq: 6000, type: 'highpass', level: level * 0.6, decay: decay * 0.8, pan });
  }

  // 크로스 스틱: 짧고 높은 '딱'
  function rim(time, level) {
    const ctx = audio();
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 1750;
    const g = ctx.createGain();
    g.gain.setValueAtTime(level, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    osc.connect(g).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);
    noiseHit(time, { freq: 3500, type: 'bandpass', q: 2, level: level * 0.6, decay: 0.03 });
  }

  const TOM_FREQ = { 1: 220, 2: 165, 3: 105 };

  /** 악보 기호 하나 소리 내기 (t: 마디 안 위치, scale: 전체 음량) */
  function playHead(h, time, { t = 0, hand = 'R', scale = 1 } = {}) {
    if (h === 'S') snare(time, hand, 0.85 * scale);
    else if (h === 'G') snare(time, hand, 0.16 * scale);
    else if (h === 'M') rim(time, 0.45 * scale);
    else if (h === 'K') kick(time, 0.85 * scale);
    else if (h === 'H') hat(time, false, (t % 24 === 0 ? 0.42 : 0.3) * scale);
    else if (h === 'O') hat(time, true, 0.4 * scale);
    else if (h === 'P') noiseHit(time, { freq: 5000, type: 'highpass', level: 0.22 * scale, decay: 0.03, pan: 0.15 });
    else if (h === 'C') cymbal(time, (t % 24 === 0 ? 0.32 : 0.24) * scale, 0.5);
    else if (h === 'X') cymbal(time, 0.55 * scale, 1.6, 0.25);
    else if (TOM_FREQ[h]) tom(time, TOM_FREQ[h], 0.8 * scale);
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
  const MODES = { rud: '루디먼트', acc: '액센트', groove: '그루브', sub: '서브디비전', read: '리딩' };

  function init({ settings, persist }) {
    const saved = settings.drum || {};
    const st = {
      mode: saved.mode || 'rud',
      id: saved.id || 'para',
      kick: saved.kick || 'none',
      accType: saved.accType || 'shift16',
      accN: saved.accN || 3,
      accStick: saved.accStick || 'single',
      strokes: saved.strokes ?? true,
      custom: saved.custom || Array(16).fill(false).map((_, i) => i % 4 === 0),
      random: saved.random || randomAccents(),
      groove: saved.groove || 'rock8',
      fillBars: saved.fillBars ?? 0,
      fill: saved.fill || 'eighth',
      subLadder: saved.subLadder || 'up',
      subBars: saved.subBars || 1,
      readLevel: saved.readLevel || 'easy',
      readBars: saved.readBars || 2,
      readCount: saved.readCount ?? true,
      bpm: saved.bpm || 80,
      loop: saved.loop ?? true,
      click: saved.click ?? true,
      ladder: saved.ladder ?? false,
      ladderStep: saved.ladderStep || 5,
      ladderMax: saved.ladderMax || 160,
    };
    let reading = null; // 리딩 문제 (새로 만들 때만 바뀜)
    let score = { notes: [], staff: 'one' };
    const run = { on: false, timer: 0, idx: 0, loopStart: 0, visuals: [] };
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      modes: $('d-modes'), list: $('d-list'), kick: $('d-kick'),
      accType: $('d-acc-type'), accN: $('d-acc-n'), accNField: $('d-acc-n-field'), accStick: $('d-acc-stick'), accNew: $('d-acc-new'), strokes: $('d-acc-strokes'),
      grooves: $('d-grooves'), fillBars: $('d-fill-bars'), fill: $('d-fill'), fillField: $('d-fill-field'),
      subLadder: $('d-sub-ladder'), subBars: $('d-sub-bars'),
      readLevel: $('d-read-level'), readBars: $('d-read-bars'), readCount: $('d-read-count'), readNew: $('d-read-new'),
      name: $('d-name'), desc: $('d-desc'), score: $('d-score'), legend: $('d-legend'),
      play: $('d-play'), bpm: $('d-bpm'), down: $('d-down'), up: $('d-up'), loop: $('d-loop'), click: $('d-click'),
      ladder: $('d-ladder'), ladderStep: $('d-ladder-step'), ladderMax: $('d-ladder-max'),
    };

    function save() {
      settings.drum = { ...st };
      persist();
    }

    // ---------- 악보 만들기 ----------
    function buildScore() {
      if (st.mode === 'rud') {
        const r = RUDIMENTS.find((x) => x.id === st.id) || RUDIMENTS[0];
        return { staff: 'one', name: r.name, desc: r.desc, notes: parseRudiment(r, st.kick), level: (n) => (n.accent ? 1 : 0.42) };
      }
      if (st.mode === 'acc') {
        const customAcc = st.accType === 'random' ? st.random : st.custom;
        const notes = accentExercise(st.accType, st.accN, st.accStick, customAcc);
        if (st.strokes) notes.forEach((n) => { n.labels.push({ text: n.stroke, cls: `s-${n.stroke}` }); });
        const t = ACCENT_TYPES[st.accType];
        return {
          staff: 'one', notes, level: (n) => (n.accent ? 1 : 0.2),
          name: st.accType === 'group' ? `${st.accN}개마다 액센트` : t.label, desc: t.desc,
        };
      }
      if (st.mode === 'groove') {
        const g = GROOVES.find((x) => x.id === st.groove) || GROOVES[0];
        if (!st.fillBars) return { staff: 'five', name: g.name, desc: g.desc, notes: grooveNotes(g), swing: g.swing };
        // 그루브 N마디 + 필인 1마디. 반복하면 필인 다음 첫 박에 크래시
        const f = FILLS.find((x) => x.id === st.fill) || FILLS[0];
        const notes = [];
        for (let b = 0; b <= st.fillBars; b++) {
          const bar = b < st.fillBars ? grooveNotes(g) : fillBar(g, f);
          bar.forEach((n) => notes.push({ ...n, t: n.t + b * BAR }));
        }
        const first = notes[0];
        if (first.t === 0) first.heads = ['X', ...first.heads.filter((h) => !['H', 'O', 'C'].includes(h))];
        else notes.unshift({ t: 0, ticks: first.t, heads: ['X'], accent: false, graces: '', labels: [{ text: '1', cls: 'c' }] });
        return {
          staff: 'five', swing: g.swing, notes,
          name: `${g.name} + ${f.name}`,
          desc: `${st.fillBars}마디 그루브 + 1마디 필인. ${f.desc} 필인 다음 첫 박은 크래시.`,
        };
      }
      if (st.mode === 'sub') {
        const l = LADDERS[st.subLadder] || LADDERS.up;
        return {
          staff: 'one', name: '서브디비전 계단', notes: subNotes(st.subLadder, st.subBars), level: (n) => (n.accent ? 0.95 : 0.45),
          desc: `${l.label}. ${st.subBars}마디마다 쪼개기가 바뀜. 박 첫 음은 액센트, 템포는 그대로.`,
        };
      }
      if (!reading) reading = readingNotes(st.readLevel, st.readBars, st.readCount);
      reading.forEach((n) => { n.labels = [st.readCount ? { text: countLabel(n.t), cls: 'c' } : null]; });
      return {
        staff: 'one', name: '리딩 연습', notes: reading, level: () => 0.7,
        desc: '랜덤 리듬 악보.',
      };
    }

    // ---------- 그리기 ----------
    function render() {
      if (!active) return;
      el.modes.innerHTML = Object.entries(MODES).map(([id, label]) =>
        `<button type="button" data-mode="${id}" class="${id === st.mode ? 'on' : ''}">${label}</button>`).join('');
      document.querySelectorAll('[data-dmode]').forEach((n) => { n.hidden = n.dataset.dmode !== st.mode; });

      if (st.mode === 'rud') {
        const cats = [...new Set(RUDIMENTS.map((r) => r.cat))];
        el.list.innerHTML = cats.map((c) =>
          `<div class="d-cat"><small>${c}</small>${RUDIMENTS.filter((r) => r.cat === c).map((r) =>
            `<button type="button" data-id="${r.id}" class="${r.id === st.id ? 'on' : ''}">${r.name}</button>`).join('')}</div>`).join('');
        const linear = (RUDIMENTS.find((r) => r.id === st.id) || RUDIMENTS[0]).pattern.includes('K');
        el.kick.disabled = linear;
        el.kick.value = linear ? 'none' : st.kick;
      } else if (st.mode === 'acc') {
        el.accType.value = st.accType;
        el.accN.value = st.accN;
        el.accStick.value = st.accStick;
        el.strokes.checked = st.strokes;
        el.accNField.hidden = st.accType !== 'group';
        el.accNew.hidden = st.accType !== 'random';
      } else if (st.mode === 'groove') {
        const cats = [...new Set(GROOVES.map((g) => g.cat))];
        el.grooves.innerHTML = cats.map((c) =>
          `<div class="d-cat"><small>${c}</small>${GROOVES.filter((g) => g.cat === c).map((g) =>
            `<button type="button" data-groove="${g.id}" class="${g.id === st.groove ? 'on' : ''}">${g.name}</button>`).join('')}</div>`).join('');
        el.fillBars.value = st.fillBars;
        el.fill.value = st.fill;
        el.fillField.hidden = !st.fillBars;
      } else if (st.mode === 'sub') {
        el.subLadder.value = st.subLadder;
        el.subBars.value = st.subBars;
      } else {
        el.readLevel.value = st.readLevel;
        el.readBars.value = st.readBars;
        el.readCount.checked = st.readCount;
      }

      score = buildScore();
      el.name.textContent = score.name;
      el.desc.textContent = score.desc;
      const editable = st.mode === 'acc';
      el.score.innerHTML = drawScore(score, editable);
      el.score.classList.toggle('editable', editable);
      el.legend.innerHTML = legend();

      el.bpm.value = st.bpm;
      el.loop.checked = st.loop;
      el.click.checked = st.click;
      el.ladder.checked = st.ladder;
      el.ladderStep.value = st.ladderStep;
      el.ladderMax.value = st.ladderMax;
      el.play.innerHTML = run.on ? '■ 정지 <kbd>Space</kbd>' : '▶ 재생 <kbd>Space</kbd>';
    }

    function legend() {
      const hands = '<span><b class="r">R</b> 오른손</span><span><b class="l">L</b> 왼손</span>';
      if (st.mode === 'rud') {
        return `${hands}<span><b class="k">K</b> 킥 (줄 아래 음표)</span><span><b>&gt;</b> 액센트</span>` +
          '<span><b>♪</b> 작은 음표: 꾸밈음 (플램 1개, 드래그 2개)</span><span>오른손 소리는 오른쪽, 왼손 소리는 왼쪽</span>';
      }
      if (st.mode === 'acc') {
        return `${hands}<span><b>&gt;</b> 액센트 (세게)</span>` +
          (st.strokes ? Object.entries(STROKE_NAME).map(([k, v]) => `<span><b class="s-${k}">${k}</b> ${v}${{
            F: ' (높음 → 높음)', D: ' (높음 → 낮음)', U: ' (낮음 → 높음)', T: ' (낮음 → 낮음)',
          }[k]}</span>`).join('') : '') + '<span>음표 클릭: 액센트 켜기·끄기</span>';
      }
      if (st.mode === 'groove') {
        // 지금 악보에 나온 기호만
        const used = new Set(score.notes.flatMap((n) => n.heads));
        const NAMES = [
          ['X', '<b>×</b> 크래시 (덧줄 위)'], ['H', '<b>×</b> 하이햇 (맨 위)'], ['O', '<b>×°</b> 오픈 하이햇'], ['C', '<b>×</b> 라이드 (첫째 줄)'],
          ['1', '<b>●</b> 하이 탐'], ['2', '<b>●</b> 미드 탐'], ['S', '<b>●</b> 스네어 (가운데)'], ['G', '<b>(●)</b> 고스트 노트 (아주 작게)'],
          ['M', '<b>⊗</b> 크로스 스틱 (스틱을 눕혀 림 치기)'], ['3', '<b>●</b> 플로어 탐'], ['K', '<b>●</b> 킥'], ['P', '<b>×</b> 하이햇 페달 (줄 아래)'],
        ];
        return NAMES.filter(([h]) => used.has(h)).map(([, t]) => `<span>${t}</span>`).join('') +
          (st.fillBars ? '<span>필인 아래 줄: 손 (R 오른손, L 왼손, K 킥)</span>' : '') +
          '<span>아래 숫자: 카운트 (1 e & a, 셋잇단은 1 trip let)</span>';
      }
      if (st.mode === 'sub') {
        return `${hands}<span><b>&gt;</b> 박 첫 음 액센트</span><span>새 쪼개기가 시작하는 곳에 이름 표시</span><span>박자 클릭을 켜 두고 박에 맞춰 바꾸기</span>`;
      }
      return '<span>점음표: 1.5배 길이</span><span>빈 머리: 2분음표</span><span>아래 숫자: 카운트 (1 e & a)</span>';
    }

    // ---------- 재생 ----------
    function schedule() {
      const ctx = audio();
      const notes = score.notes;
      const total = notes.reduce((a, n) => a + n.ticks, 0);
      let tickSec = 60 / st.bpm / 24;
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
          // 템포 계단: 한 바퀴 돌 때마다 빠르게
          if (st.ladder && st.bpm < st.ladderMax) {
            st.bpm = Math.min(st.ladderMax, st.bpm + st.ladderStep);
            el.bpm.value = st.bpm;
            save();
            tickSec = 60 / st.bpm / 24;
          }
        }
        const n = notes[run.idx];
        const swingShift = score.swing && n.t % 24 === 12 ? 4 : 0; // 뒷 8분을 셋잇단 셋째 자리로
        const time = run.loopStart + (n.t + swingShift) * tickSec;
        if (time > ctx.currentTime + 0.15) return;
        play(n, time);
        if (st.click) {
          for (let b = Math.ceil(n.t / 24) * 24; b < n.t + n.ticks; b += 24) click(run.loopStart + b * tickSec, b % BAR === 0);
        }
        const i = run.idx;
        run.visuals.push(setTimeout(() => highlight(i), Math.max(0, (time - ctx.currentTime) * 1000)));
        run.idx++;
      }
    }

    function play(n, time) {
      const level = score.level ? score.level(n) : 0.8;
      for (const h of n.heads) {
        if (h === 'S') snare(time, n.hand || 'R', score.level ? level : 0.85);
        else if (h === 'K') kick(time, n.hand === 'K' && n.accent ? 1 : 0.85);
        else playHead(h, time, { t: n.t, hand: n.hand || 'R' });
      }
      if (n.graces) {
        const graceHand = n.hand === 'R' ? 'L' : 'R';
        n.graces.split('').forEach((g, k) => {
          const before = n.graces.length === 1 ? 0.028 : (n.graces.length - k) * 0.032;
          snare(time - before, n.graces.length === 1 ? graceHand : g, 0.13);
        });
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

    // 설정을 바꾸면 처음부터 다시 (재생 중이었으면 이어서 재생)
    function change(fn) {
      fn();
      const wasOn = run.on;
      stop();
      save();
      render();
      if (wasOn) start();
    }

    // ---------- 이벤트 ----------
    el.kick.innerHTML = Object.entries(KICK_MODES).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.accType.innerHTML = Object.entries(ACCENT_TYPES).map(([v, t]) => `<option value="${v}">${t.label}</option>`).join('');
    el.accN.innerHTML = [2, 3, 4, 5, 6, 7].map((n) => `<option value="${n}">${n}개마다</option>`).join('');
    el.accStick.innerHTML = Object.entries(STICKINGS).map(([v, s]) => `<option value="${v}">${s.label}</option>`).join('');
    el.fillBars.innerHTML = Object.entries(FILL_BARS).map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
    el.fill.innerHTML = FILLS.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
    el.subLadder.innerHTML = Object.entries(LADDERS).map(([v, l]) => `<option value="${v}">${l.label}</option>`).join('');
    el.subBars.innerHTML = [1, 2].map((n) => `<option value="${n}">${n}마디씩</option>`).join('');
    el.ladderStep.innerHTML = [1, 2, 5, 10].map((n) => `<option value="${n}">+${n} BPM</option>`).join('');

    el.modes.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode]');
      if (b) change(() => { st.mode = b.dataset.mode; });
    });
    el.list.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-id]');
      if (b) change(() => { st.id = b.dataset.id; });
    });
    el.kick.addEventListener('change', () => { const v = el.kick.value; change(() => { st.kick = v; }); });
    el.accType.addEventListener('change', () => { const v = el.accType.value; change(() => { st.accType = v; }); });
    el.accN.addEventListener('change', () => { const v = +el.accN.value; change(() => { st.accN = v; }); });
    el.accStick.addEventListener('change', () => { const v = el.accStick.value; change(() => { st.accStick = v; }); });
    el.strokes.addEventListener('change', () => { const v = el.strokes.checked; change(() => { st.strokes = v; }); });
    el.accNew.addEventListener('click', () => change(() => { st.random = randomAccents(); }));
    el.grooves.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-groove]');
      if (b) change(() => { st.groove = b.dataset.groove; });
    });
    el.fillBars.addEventListener('change', () => { const v = +el.fillBars.value; change(() => { st.fillBars = v; }); });
    el.fill.addEventListener('change', () => { const v = el.fill.value; change(() => { st.fill = v; }); });
    el.subLadder.addEventListener('change', () => { const v = el.subLadder.value; change(() => { st.subLadder = v; }); });
    el.subBars.addEventListener('change', () => { const v = +el.subBars.value; change(() => { st.subBars = v; }); });
    el.readLevel.addEventListener('change', () => { const v = el.readLevel.value; change(() => { st.readLevel = v; reading = null; }); });
    el.readBars.addEventListener('change', () => { const v = +el.readBars.value; change(() => { st.readBars = v; reading = null; }); });
    el.readCount.addEventListener('change', () => { const v = el.readCount.checked; change(() => { st.readCount = v; }); });
    el.readNew.addEventListener('click', () => change(() => { reading = null; }));

    // 액센트: 음표를 눌러 액센트 켜고 끄기 → 직접 만들기로 전환
    el.score.addEventListener('click', (e) => {
      if (st.mode !== 'acc') return;
      const g = e.target.closest('.d-note');
      if (!g) return;
      const i = +g.dataset.i;
      change(() => {
        if (st.accType !== 'custom') {
          st.custom = score.notes.slice(0, 32).map((n) => n.accent);
          if (st.custom.length < 16) st.custom = st.custom.concat(Array(16 - st.custom.length).fill(false));
          st.accType = 'custom';
        }
        if (i < st.custom.length) st.custom[i] = !st.custom[i];
      });
    });

    el.play.addEventListener('click', () => (run.on ? stop() : start()));
    const setBpm = (v) => {
      const bpm = Math.max(30, Math.min(260, Math.round(+v || st.bpm)));
      if (run.on) {
        // 다음에 예약할 음의 박자 위치는 그대로 두고 그 뒤부터 새 템포로 (박이 튀지 않게)
        const total = score.notes.reduce((a, n) => a + n.ticks, 0);
        const pos = run.idx < score.notes.length ? score.notes[run.idx].t : total;
        const at = run.loopStart + pos * (60 / st.bpm / 24);
        run.loopStart = at - pos * (60 / bpm / 24);
      }
      st.bpm = bpm;
      el.bpm.value = st.bpm;
      save();
    };
    el.bpm.addEventListener('change', () => setBpm(el.bpm.value));
    el.down.addEventListener('click', () => setBpm(st.bpm - 5));
    el.up.addEventListener('click', () => setBpm(st.bpm + 5));
    el.loop.addEventListener('change', () => { st.loop = el.loop.checked; save(); });
    el.click.addEventListener('change', () => { st.click = el.click.checked; save(); });
    el.ladder.addEventListener('change', () => { st.ladder = el.ladder.checked; if (st.ladder) { st.loop = true; el.loop.checked = true; } save(); });
    el.ladderStep.addEventListener('change', () => { st.ladderStep = +el.ladderStep.value; save(); });
    el.ladderMax.addEventListener('change', () => { st.ladderMax = Math.max(30, Math.min(260, +el.ladderMax.value || 160)); el.ladderMax.value = st.ladderMax; save(); });

    return {
      activate() { active = true; render(); },
      deactivate() { stop(); active = false; },
      render,
      toggle() { if (run.on) stop(); else start(); },
      onClick() {},
    };
  }

  global.FretDrum = {
    init, RUDIMENTS, GROOVES, parse: (r) => parseRudiment(r, 'none'), accentExercise, grooveNotes, readingNotes,
    sound: { audio, snare, kick, hat, playHead }, // 잼 트랙에서 같은 오디오로 반주
  };
})(window);

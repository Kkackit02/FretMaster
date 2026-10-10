// 악기 정의: 기타 / 베이스 4현 / 베이스 5현
// 다른 파일은 FretInst.open, FretInst.strings를 그대로 참조하고, 악기를 바꾸면 이 둘을 제자리에서 고친다.
(function (global) {
  'use strict';

  const INSTRUMENTS = {
    guitar: { label: '기타', open: { 1: 64, 2: 59, 3: 55, 4: 50, 5: 45, 6: 40 }, minFreq: 60 },  // E A D G B E
    bass4: { label: '베이스 4현', open: { 1: 43, 2: 38, 3: 33, 4: 28 }, minFreq: 36 },           // E1 A1 D2 G2
    bass5: { label: '베이스 5현', open: { 1: 43, 2: 38, 3: 33, 4: 28, 5: 23 }, minFreq: 28 },    // B0 E1 A1 D2 G2
  };

  const open = {};
  const strings = [];
  const inst = {
    INSTRUMENTS,
    id: 'guitar',
    open,
    strings,
    get isBass() { return inst.id !== 'guitar'; },
    get count() { return strings.length; },
    get lowest() { return strings.length; },          // 가장 낮은 줄 번호
    get minFreq() { return INSTRUMENTS[inst.id].minFreq; },
    get label() { return INSTRUMENTS[inst.id].label; },
    set(id) {
      const def = INSTRUMENTS[id] || INSTRUMENTS.guitar;
      inst.id = INSTRUMENTS[id] ? id : 'guitar';
      for (const k of Object.keys(open)) delete open[k];
      Object.assign(open, def.open);
      strings.length = 0;
      strings.push(...Object.keys(def.open).map(Number).sort((a, b) => a - b));
    },
  };
  inst.set('guitar');

  global.FretInst = inst;
})(window);

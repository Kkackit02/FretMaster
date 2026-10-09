// 연습 기록 저장: 날짜별 연습 시간·정답·오답, 코드 전환 챌린지 결과
(function (global) {
  'use strict';

  const KEY = 'fretmaster.log';
  let data = load();

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && d.days) return { days: d.days, changes: d.changes || {} };
    } catch { /* 처음이거나 저장 불가 */ }
    return { days: {}, changes: {} };
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 저장 불가 환경은 무시 */ }
  }

  // 로컬 날짜 기준 YYYY-MM-DD
  function dayKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function today() {
    const k = dayKey();
    return data.days[k] || (data.days[k] = { sec: 0, ok: 0, bad: 0 });
  }

  /** 정답/오답 한 번 */
  function answer(ok, n = 1) {
    const t = today();
    if (ok) t.ok += n; else t.bad += n;
    save();
  }

  /** 연습 시간 (초) */
  function tick(sec) {
    today().sec += sec;
    save();
  }

  function addChange(pairKey, count, dur) {
    (data.changes[pairKey] ||= []).push({ d: Date.now(), n: count, dur });
    save();
  }

  /** 지난 n일 (오래된 날부터) */
  function lastDays(n) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const k = dayKey(date);
      out.push({ key: k, date, ...(data.days[k] || { sec: 0, ok: 0, bad: 0 }) });
    }
    return out;
  }

  const practiced = (d) => d && (d.sec >= 60 || d.ok + d.bad > 0);

  /** 연속 연습 일수: 오늘(또는 오늘 아직 안 했으면 어제)부터 거꾸로 */
  function streak() {
    let n = 0;
    const date = new Date();
    if (!practiced(data.days[dayKey(date)])) date.setDate(date.getDate() - 1);
    while (practiced(data.days[dayKey(date)])) {
      n++;
      date.setDate(date.getDate() - 1);
    }
    return n;
  }

  function totals() {
    return Object.values(data.days).reduce((a, d) => ({ sec: a.sec + d.sec, ok: a.ok + d.ok, bad: a.bad + d.bad }), { sec: 0, ok: 0, bad: 0 });
  }

  function reset() {
    data = { days: {}, changes: {} };
    save();
  }

  global.FretLog = {
    answer, tick, addChange, lastDays, streak, totals, reset, dayKey,
    get changes() { return data.changes; },
  };
})(window);

// 연습 기록 탭: 요약, 최근 14일 연습 시간, 지판 약점 지도, 약한 음, 코드 전환 기록
(function (global) {
  'use strict';

  const OPEN_MIDI = FretInst.open; // 현재 악기의 개방현 (instrument.js)
  // 약점 정도: 한 가지 색(주황)의 밝기 단계. 연할수록 잘함, 진할수록 자주 틀리거나 느림
  const RAMP = ['#fbe7c6', '#f7cf8f', '#f0a63a', '#d9822a', '#b4601d', '#8a4214'];
  const DARK_TEXT_UNTIL = 2; // 이 단계까지는 글자를 어둡게

  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

  function init(ctx) {
    const { settings } = ctx;
    const st = { source: settings.statsSource || 'all' };
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = {
      tiles: $('s2-tiles'), days: $('s2-days'), source: $('s2-source'), legend: $('s2-legend'),
      weak: $('s2-weak'), changes: $('s2-changes'), reset: $('s2-reset'),
    };

    // ---------- 약점 계산 ----------
    function cellStat(s, pc) {
      const stats = ctx.getStats();
      const keys = [];
      const ip = FretInst.isBass ? `${FretInst.id}:` : '';
      if (st.source !== 'board') keys.push(`${ip}${s}:${pc}`, `${ip}*:${pc}`);
      if (st.source !== 'note') keys.push(`${ip}board:${s}:${pc}`, `${ip}board:*:${pc}`);
      const sum = { seen: 0, clean: 0, cleanMs: 0 };
      for (const k of keys) {
        const x = stats[k];
        if (!x) continue;
        sum.seen += x.seen;
        sum.clean += x.clean;
        sum.cleanMs += x.cleanMs;
      }
      if (!sum.seen) return null;
      const missRate = 1 - sum.clean / sum.seen;
      const avg = sum.clean ? sum.cleanMs / sum.clean : null;
      const slow = avg == null ? 1 : clamp((avg - 1500) / 3500);
      return { ...sum, missRate, avg, weak: clamp(0.7 * missRate + 0.3 * slow) };
    }

    const step = (w) => Math.min(RAMP.length - 1, Math.floor(w * RAMP.length));
    const pct = (x) => `${Math.round(x * 100)}%`;
    const describe = (x) => `정답률 ${pct(1 - x.missRate)} (${x.clean}/${x.seen})${x.avg != null ? ` · 평균 ${(x.avg / 1000).toFixed(1)}초` : ''}`;

    // ---------- 그리기 ----------
    function renderTiles() {
      const days = FretLog.lastDays(7);
      const today = days[days.length - 1];
      const week = days.reduce((a, d) => a + d.sec, 0);
      const t = FretLog.totals();
      const rate = t.ok + t.bad ? pct(t.ok / (t.ok + t.bad)) : '–';
      const tile = (value, label, sub = '') => `<div class="st-tile"><b>${value}</b><small>${label}</small>${sub ? `<em>${sub}</em>` : ''}</div>`;
      el.tiles.innerHTML =
        tile(`${Math.round(today.sec / 60)}분`, '오늘 연습', `정답 ${today.ok} · 오답 ${today.bad}`) +
        tile(`${Math.round(week / 60)}분`, '최근 7일') +
        tile(`${FretLog.streak()}일`, '연속 연습') +
        tile(rate, '전체 정답률', `정답 ${t.ok} · 오답 ${t.bad}`);
    }

    // 최근 14일 연습 시간 막대 (한 가지 값이라 한 색, 범례 없이 제목으로)
    function renderDays() {
      const days = FretLog.lastDays(14);
      const mins = days.map((d) => d.sec / 60);
      const narrow = window.matchMedia('(max-width: 640px)').matches; // 좁은 화면에선 글자가 작아지지 않게 좁은 좌표로
      const W = narrow ? 360 : 640, H = narrow ? 150 : 170, L = 30, R = 6, T = 16, B = 26;
      const top = Math.max(10, Math.ceil(Math.max(...mins) / 10) * 10);
      const bw = (W - L - R) / days.length;
      const y = (v) => T + (1 - v / top) * (H - T - B);
      const ticks = [0, top / 2, top];
      const parts = ticks.map((t) =>
        `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text class="ch-axis" x="${L - 6}" y="${y(t) + 4}" text-anchor="end">${t}</text>`);
      days.forEach((d, i) => {
        const v = mins[i];
        const x = L + i * bw + 1; // 막대 사이 2px 간격
        const w = bw - 2;
        const h = (H - T - B) * (v / top);
        const r = Math.min(4, h, w / 2);
        const base = H - B;
        // 위쪽만 둥근 막대 (바닥에 붙음)
        const bar = h > 0
          ? `<path class="ch-bar${i === days.length - 1 ? ' today' : ''}" d="M${x} ${base}V${base - h + r}Q${x} ${base - h} ${x + r} ${base - h}H${x + w - r}Q${x + w} ${base - h} ${x + w} ${base - h + r}V${base}Z"/>`
          : '';
        const label = i % 2 === (days.length - 1) % 2 ? `<text class="ch-axis" x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${d.date.getMonth() + 1}/${d.date.getDate()}</text>` : '';
        parts.push(`<g class="ch-col"><title>${d.date.getMonth() + 1}/${d.date.getDate()} · ${Math.round(v)}분 · 정답 ${d.ok} · 오답 ${d.bad}</title>` +
          `<rect x="${x}" y="${T}" width="${w}" height="${H - T - B}" fill="transparent"/>${bar}</g>${label}`);
      });
      el.days.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 14일 연습 시간(분)">${parts.join('')}</svg>`;
    }

    function renderHeatmap() {
      const marks = [];
      const max = Math.max(12, settings.fretMax);
      for (const s of FretInst.strings) {
        for (let f = 0; f <= max; f++) {
          const midi = OPEN_MIDI[s] + f;
          const pc = midi % 12;
          const x = cellStat(s, pc);
          const name = ctx.noteName(pc);
          if (!x) {
            marks.push({ s, f, midi, cls: 'unseen', still: true, label: name, title: `${s}번 줄 ${f}프렛 ${name} · 기록 없음` });
            continue;
          }
          const k = step(x.weak);
          marks.push({
            s, f, midi, cls: 'heat', still: true, label: name, color: RAMP[k], textColor: k <= DARK_TEXT_UNTIL ? '#1c1813' : '#fff7ea',
            title: `${s}번 줄 ${f}프렛 ${name} · ${describe(x)}`,
          });
        }
      }
      ctx.renderBoard(marks);
      el.legend.innerHTML = `<span>강함</span>${RAMP.map((c) => `<i style="background:${c}"></i>`).join('')}<span>약함</span>` +
        '<span class="st-unseen"><i></i>기록 없음</span>';
    }

    function renderWeak() {
      const list = [];
      for (const s of FretInst.strings) {
        for (let pc = 0; pc < 12; pc++) {
          const x = cellStat(s, pc);
          if (x && x.seen >= 2) list.push({ s, pc, ...x });
        }
      }
      list.sort((a, b) => b.weak - a.weak);
      const top = list.slice(0, 8).filter((x) => x.weak > 0.15);
      el.weak.innerHTML = top.length
        ? top.map((x) => {
          const frets = [0, 12].map((o) => ((x.pc - OPEN_MIDI[x.s] % 12 + 12) % 12) + o).filter((f) => f <= 15);
          return `<div class="st-weak"><i style="background:${RAMP[step(x.weak)]}"></i><b>${x.s}번 줄 ${ctx.noteName(x.pc)}</b>` +
            `<small>${frets.join('·')}프렛</small><span>${describe(x)}</span></div>`;
        }).join('')
        : '<p class="g-empty">데이터 부족 (같은 음 2회 이상 필요)</p>';
    }

    function renderChanges() {
      const entries = Object.entries(FretLog.changes);
      if (!entries.length) { el.changes.innerHTML = '<p class="g-empty">기록 없음</p>'; return; }
      const name = (k) => {
        const [r, t] = k.split(':');
        return FretChords.build(+r, t, ctx.accFor(+r, t), settings.naming).name;
      };
      el.changes.innerHTML = `<table class="st-table"><thead><tr><th>코드</th><th>도전</th><th>최고 (분당)</th><th>최근 (분당)</th></tr></thead><tbody>${
        entries.map(([key, list]) => {
          const perMin = list.map((h) => Math.round((h.n * 60) / h.dur));
          return `<tr><td>${key.split('|').map(name).join(' ↔ ')}</td><td>${list.length}회</td><td>${Math.max(...perMin)}회</td><td>${perMin[perMin.length - 1]}회</td></tr>`;
        }).join('')}</tbody></table>`;
    }

    function render() {
      if (!active) return;
      el.source.value = st.source;
      renderTiles();
      renderDays();
      renderHeatmap();
      renderWeak();
      renderChanges();
    }

    el.source.addEventListener('change', () => {
      st.source = el.source.value;
      settings.statsSource = st.source;
      ctx.persist();
      render();
    });
    el.reset.addEventListener('click', () => {
      if (!confirm('연습 시간·정답·코드 전환 기록을 초기화할까요? (지판 약점 기록은 설정에서 따로 초기화)')) return;
      FretLog.reset();
      render();
    });

    return {
      activate() { active = true; render(); },
      deactivate() { active = false; },
      render() { if (active) render(); },
      onClick() {},
    };
  }

  global.FretStats = { init };
})(window);

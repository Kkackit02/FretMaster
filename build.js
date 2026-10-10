// 코드 만들기: 근음 하나를 기준으로 코드 종류별 만드는 법 정리
(function (global) {
  'use strict';

  // 표 순서와 메이저 기준으로 만드는 법
  const ROWS = [
    { type: 'maj', how: '근음 + 장3도 + 완전5도 (기본)' },
    { type: 'min', how: 'M에서 3음 반음↓' },
    { type: 'aug', how: 'M에서 5음 반음↑' },
    { type: 'dim', how: 'm에서 5음 반음↓' },
    { type: 'sus2', how: 'M에서 3음 대신 장2도' },
    { type: 'sus4', how: 'M에서 3음 대신 완전4도' },
    { type: 'dom7', how: 'M + 단7도' },
    { type: 'maj7', how: 'M + 장7도' },
    { type: 'min7', how: 'm + 단7도' },
    { type: 'm7b5', how: 'dim + 단7도 (m7에서 5음 반음↓)' },
  ];
  const MAJOR_ROLES = new Set(['R', '3', '5']); // 이 밖의 도수는 메이저에서 바뀐 음
  const FORMS = [['open', '오픈 코드'], ['e', 'E폼 바레'], ['a', 'A폼 바레'], ['all', '구성음 전체']];

  function init(ctx) {
    const { settings } = ctx;
    const saved = settings.build || {};
    const st = { root: saved.root ?? 0, type: saved.type || 'maj', form: saved.form || 'open' };
    let active = false;

    const $ = (id) => document.getElementById(id);
    const el = { root: $('b-root'), form: $('b-form'), table: $('b-table'), detail: $('b-detail') };

    function save() {
      settings.build = { ...st };
      ctx.persist();
    }

    const build = (type) => FretChords.build(st.root, type, ctx.accFor(st.root, type), settings.naming);

    function play(type) {
      FretChords.TYPES[type].tones.forEach(([semi], k) => ctx.playTone(48 + st.root + semi, k * 0.12, 1.4, 0.15));
      const t = FretChords.TYPES[type].tones.length * 0.12 + 0.1;
      FretChords.TYPES[type].tones.forEach(([semi]) => ctx.playTone(48 + st.root + semi, t, 1.8, 0.11));
    }

    function render() {
      if (!active) return;
      el.root.value = st.root;
      el.form.value = st.form;

      el.table.innerHTML =
        '<thead><tr><th>코드</th><th>만드는 법</th><th>도수</th><th>반음</th><th>구성음</th></tr></thead><tbody>' +
        ROWS.map(({ type, how }) => {
          const chord = build(type);
          const semis = FretChords.TYPES[type].tones.map(([semi]) => semi);
          const changed = (role) => (MAJOR_ROLES.has(role) ? '' : ' class="chg"');
          return `<tr data-type="${type}" class="${type === st.type ? 'on' : ''}">` +
            `<td><b>${chord.name}</b></td><td>${how}</td>` +
            `<td>${chord.tones.map((t) => `<span${changed(t.role)}>${t.role}</span>`).join(' · ')}</td>` +
            `<td>${semis.join(' · ')}</td>` +
            `<td>${chord.tones.map((t) => `<span${changed(t.role)}>${t.name}</span>`).join(' · ')}</td></tr>`;
        }).join('') + '</tbody>';

      // 고른 코드: 설명 + 건반 + 지판
      const chord = build(st.type);
      el.detail.innerHTML = FretChords.explain(st.root, st.type, ctx.accFor(st.root, st.type), settings.naming)
        .map((l) => `<div>${l}</div>`).join('');
      ctx.showOnPiano(chord);
      const shape = st.form !== 'all' && FretChords.shapeOf(st.root, st.type, st.form);
      ctx.renderBoard(shape ? ctx.shapeMarks(chord, shape, st.form) : ctx.rangeMarks(chord));
      el.form.querySelectorAll('option').forEach((o) => {
        o.disabled = o.value !== 'all' && !FretChords.shapeOf(st.root, st.type, o.value);
      });
    }

    el.root.innerHTML = [...Array(12).keys()].map((pc) => `<option value="${pc}">${ctx.noteName(pc, ctx.accFor(pc, 'maj'))}</option>`).join('');
    el.form.innerHTML = FORMS.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');

    // 고른 운지가 없는 코드면 있는 운지로
    function fitForm() {
      if (st.form !== 'all' && !FretChords.shapeOf(st.root, st.type, st.form)) {
        st.form = ['open', 'a', 'e'].find((f) => FretChords.shapeOf(st.root, st.type, f)) || 'all';
      }
    }

    el.root.addEventListener('change', () => { st.root = +el.root.value; fitForm(); save(); render(); play(st.type); });
    el.form.addEventListener('change', () => { st.form = el.form.value; save(); render(); });
    el.table.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-type]');
      if (!row) return;
      st.type = row.dataset.type;
      fitForm();
      save();
      render();
      play(st.type);
    });

    return {
      activate() { active = true; fitForm(); render(); },
      deactivate() { active = false; },
      render() { if (active) render(); },
      onClick() {},
    };
  }

  global.FretBuild = { init };
})(window);

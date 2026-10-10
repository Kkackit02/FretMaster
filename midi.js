// MIDI 키보드 입력 (Web MIDI): 건반을 누르면 note 이벤트
(function (global) {
  'use strict';

  let access = null;
  const listeners = { note: new Set(), state: new Set() };
  const state = { connected: false, names: [] };

  const emit = (type, ...args) => listeners[type].forEach((fn) => fn(...args));

  function onMessage(e) {
    const [status, note, velocity] = e.data;
    const cmd = status & 0xf0;
    if (cmd === 0x90 && velocity > 0) emit('note', note, velocity); // note on (velocity 0은 note off)
  }

  function bind() {
    state.names = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = onMessage;
      if (input.state === 'connected') state.names.push(input.name);
    }
    state.connected = state.names.length > 0;
    emit('state', state);
  }

  async function connect() {
    if (!navigator.requestMIDIAccess) throw new Error('이 브라우저는 MIDI 미지원 (Chrome·Edge에서 사용)');
    if (!access) {
      access = await navigator.requestMIDIAccess();
      access.onstatechange = bind; // 연결·해제를 바로 반영
    }
    bind();
    return state;
  }

  global.FretMidi = {
    connect,
    on(type, fn) { listeners[type].add(fn); },
    get supported() { return !!navigator.requestMIDIAccess; },
    get enabled() { return !!access; },
    get connected() { return state.connected; },
    get names() { return state.names; },
  };
})(window);

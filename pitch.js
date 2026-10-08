// YIN 알고리즘 기반 단일음 피치 검출기
// 참고: de Cheveigné & Kawahara, "YIN, a fundamental frequency estimator for speech and music" (2002)
(function (global) {
  'use strict';

  const MIN_FREQ = 60;    // 6번줄 E2(82Hz)보다 조금 낮게
  const MAX_FREQ = 1400;  // 1번줄 24프렛 E6(1319Hz)까지

  let diff = null;

  /**
   * @param {Float32Array} buf  시간 영역 샘플
   * @param {number} sampleRate
   * @param {number} threshold  CMNDF 임계값 (작을수록 엄격)
   * @returns {{freq:number, clarity:number} | null}
   */
  function detect(buf, sampleRate, threshold = 0.15) {
    const W = buf.length >> 1;
    const minTau = Math.max(2, Math.floor(sampleRate / MAX_FREQ));
    const maxTau = Math.min(W - 1, Math.ceil(sampleRate / MIN_FREQ));
    if (!diff || diff.length < maxTau + 2) diff = new Float32Array(maxTau + 2);

    // 1) 차분 함수
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      let sum = 0;
      for (let i = 0; i < W; i++) {
        const d = buf[i] - buf[i + tau];
        sum += d * d;
      }
      diff[tau] = sum;
    }

    // 2) 누적 평균 정규화 차분 함수 (CMNDF)
    diff[0] = 1;
    let running = 0;
    for (let tau = 1; tau <= maxTau + 1; tau++) {
      running += diff[tau];
      diff[tau] = running > 0 ? (diff[tau] * tau) / running : 1;
    }

    // 3) 절대 임계값 아래로 처음 내려가는 지점의 극소값
    let tau = -1;
    for (let t = minTau; t <= maxTau; t++) {
      if (diff[t] < threshold) {
        while (t + 1 <= maxTau && diff[t + 1] < diff[t]) t++;
        tau = t;
        break;
      }
    }
    if (tau === -1) return null;

    // 4) 포물선 보간으로 정밀도 향상
    const a = diff[tau - 1], b = diff[tau], c = diff[tau + 1];
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    const betterTau = tau + Math.max(-1, Math.min(1, shift));

    return { freq: sampleRate / betterTau, clarity: 1 - b };
  }

  function rms(buf) {
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    return Math.sqrt(sum / buf.length);
  }

  // 주파수 → MIDI 번호(실수)
  function freqToMidi(freq) {
    return 69 + 12 * Math.log2(freq / 440);
  }

  /**
   * 크로마(12음 에너지 분포) — 여러 음이 동시에 울리는 코드 인식용
   * 스펙트럼의 피크만 골라 가장 가까운 음이름 칸에 더한다.
   * @param {Float32Array} db  AnalyserNode.getFloatFrequencyData 결과 (dB)
   * @param {Float32Array} [out]
   * @returns {Float32Array} 최댓값이 1이 되도록 정규화된 12칸 (C=0 … B=11)
   */
  function chroma(db, sampleRate, fftSize, out = new Float32Array(12)) {
    out.fill(0);
    const binHz = sampleRate / fftSize;
    const lo = Math.max(1, Math.ceil(75 / binHz));
    const hi = Math.min(db.length - 2, Math.floor(2000 / binHz));

    let peak = -Infinity;
    for (let i = lo; i <= hi; i++) if (db[i] > peak) peak = db[i];
    const floor = peak - 40; // 가장 큰 피크보다 40dB 이상 작은 건 잡음으로 취급

    for (let i = lo; i <= hi; i++) {
      const b = db[i];
      if (b < floor || b < db[i - 1] || b < db[i + 1]) continue;
      const a = db[i - 1], c = db[i + 1];
      const denom = a - 2 * b + c;
      const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
      const m = freqToMidi((i + shift) * binHz);
      const nearest = Math.round(m);
      if (Math.abs(m - nearest) > 0.35) continue; // 음 사이에 걸친 피크는 버림
      out[((nearest % 12) + 12) % 12] += Math.pow(10, b / 20);
    }

    let max = 0;
    for (let k = 0; k < 12; k++) if (out[k] > max) max = out[k];
    if (max > 0) for (let k = 0; k < 12; k++) out[k] /= max;
    return out;
  }

  global.FretPitch = { detect, rms, freqToMidi, chroma, MIN_FREQ, MAX_FREQ };
})(window);

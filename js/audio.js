// Efectos sintetizados con Web Audio (autoría propia, sin archivos externos).
let ctx = null;

export function initAudio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  return ctx.resume();
}

function tone(freq, start, dur, { type = 'sine', vol = 0.15 } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start);
  o.stop(start + dur + 0.02);
}

// campana: fundamental + parciales inarmónicos que decaen
function campana(freq, start, vol = 0.12) {
  [1, 2.76, 5.4].forEach((k, i) => tone(freq * k, start, 2.2 / (i + 1), { vol: vol / (i + 1) }));
}

const SFX = {
  petalos: t => [523, 659, 784, 1047, 784].forEach((f, i) => campana(f, t + i * 0.12, 0.08)),
  velas: t => { campana(196, t, 0.18); campana(294, t + 0.25, 0.12); },
  cambio: t => { tone(880, t, 0.25, { type: 'triangle', vol: 0.1 }); tone(1320, t + 0.08, 0.35, { type: 'triangle', vol: 0.08 }); },
};

export function sfx(nombre) {
  if (ctx?.state === 'running') SFX[nombre]?.(ctx.currentTime);
}

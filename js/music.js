/** Тихий сказочный луп: арфа в дорийском ладу и мягкая педаль. */

let ctx;
let timer;
let playing = false;

const SCALE = [0, 2, 3, 5, 7, 9, 10, 12];

function tone(ac, freq, t, dur, type, gain) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 1800;
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(f); f.connect(g); g.connect(ac.destination);
  o.start(t); o.stop(t + dur + 0.05);
}

function midi(n) { return 440 * Math.pow(2, (n - 69) / 12); }

export function ensureMusic(enabled) {
  if (!enabled) { stopMusic(); return; }
  if (playing) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = ctx || new AC();
  if (ctx.state === "suspended") ctx.resume();
  playing = true;
  const root = 62;
  let step = 0;
  const tick = () => {
    if (!playing || !ctx) return;
    const t = ctx.currentTime + 0.02;
    const degree = SCALE[step % SCALE.length];
    const oct = step % 16 < 8 ? 0 : 12;
    tone(ctx, midi(root + degree + oct), t, 0.42, "triangle", 0.018);
    if (step % 4 === 0) tone(ctx, midi(root - 12 + (step % 8 === 0 ? 0 : 7)), t, 1.3, "sine", 0.02);
    if (step % 8 === 4) tone(ctx, midi(root + 12 + degree), t, 0.7, "sine", 0.01);
    step++;
  };
  tick();
  timer = setInterval(tick, 420);
}

export function stopMusic() {
  playing = false;
  if (timer) clearInterval(timer);
  timer = null;
}

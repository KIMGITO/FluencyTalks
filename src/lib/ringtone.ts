// Call sounds, made with Web Audio so there are no files to download. `incoming` rings the person being called;
// `ringback` is the quieter tone the caller hears while it rings. Browsers only allow sound after the page has been
// tapped once, so the audio is unlocked on the first tap anywhere; until then an incoming call only vibrates.

type Kind = 'incoming' | 'ringback';
let ctx: AudioContext | null = null;
const audio = () => {
  if (ctx) return ctx;
  const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!C) return null;
  ctx = new C(); return ctx;
};
if (typeof window !== 'undefined') {
  const unlock = () => { void audio()?.resume().catch(() => undefined); };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

/** One burst: a few tones together, faded in and out so it doesn't click. */
function burst(c: AudioContext, out: AudioNode, start: number, freqs: number[], length: number, volume: number) {
  const g = c.createGain(); g.connect(out);
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(volume, start + 0.02);
  g.gain.setValueAtTime(volume, start + length - 0.04);
  g.gain.linearRampToValueAtTime(0, start + length);
  for (const f of freqs) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); o.start(start); o.stop(start + length); }
}

const PATTERNS: Record<Kind, { every: number; play: (c: AudioContext, out: AudioNode, t: number) => void; vibrate?: number[] }> = {
  // Two quick rising rings, then a pause.
  incoming: {
    every: 2600,
    play: (c, out, t) => { for (const [i, f] of [[0, 784], [1, 988], [2.4, 784], [3.4, 988]]) burst(c, out, t + i * 0.13, [f], 0.12, 0.22); },
    vibrate: [400, 200, 400],
  },
  // The familiar phone ringback: a soft double tone, two seconds on, four off.
  ringback: { every: 6000, play: (c, out, t) => burst(c, out, t, [440, 480], 2, 0.06) },
};

let stopCurrent: (() => void) | null = null;

/** Starts a call sound and returns how to stop it. Starting another stops the first. */
export function ring(kind: Kind): () => void {
  stopCurrent?.();
  const p = PATTERNS[kind]; const c = audio();
  let out: GainNode | null = null;
  if (c) { out = c.createGain(); out.connect(c.destination); void c.resume().catch(() => undefined); }
  const tick = () => {
    if (c && out && c.state === 'running') p.play(c, out, c.currentTime + 0.02);
    if (p.vibrate && document.visibilityState === 'visible') navigator.vibrate?.(p.vibrate);
  };
  tick();
  const timer = setInterval(tick, p.every);
  let stopped = false;
  const stop = () => {
    if (stopped) return; stopped = true;
    clearInterval(timer); navigator.vibrate?.(0);
    if (out && c) { out.gain.setValueAtTime(0, c.currentTime); setTimeout(() => out?.disconnect(), 100); }
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}

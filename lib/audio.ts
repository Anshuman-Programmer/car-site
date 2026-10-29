"use client";

/**
 * Procedural sound: wind, water, birds, engine and UI chimes are synthesised
 * with Web Audio, so there are no audio files to fail. Nothing is created
 * until the visitor turns sound on (which is also the user gesture browsers require).
 */

type Nodes = {
  ctx: AudioContext;
  master: GainNode;
  engineGain: GainNode;
  engineOsc: OscillatorNode;
  engineOsc2: OscillatorNode;
  engineFilter: BiquadFilterNode;
  waterGain: GainNode;
  windLfo: OscillatorNode;
  noise: AudioBuffer;
  sources: AudioScheduledSourceNode[];
  birdTimer: number;
};

let nodes: Nodes | null = null;
let enabled = false;

function noiseBuffer(ctx: AudioContext, seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    // Brown-ish noise: softer than white.
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}

function build(): Nodes | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  const sources: AudioScheduledSourceNode[] = [];
  const noise = noiseBuffer(ctx);

  // Wind: lowpassed noise with a slow swell.
  const wind = ctx.createBufferSource();
  wind.buffer = noise;
  wind.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = "lowpass";
  windFilter.frequency.value = 420;
  const windGain = ctx.createGain();
  windGain.gain.value = 0.16;
  const windLfo = ctx.createOscillator();
  windLfo.frequency.value = 0.07;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.08;
  windLfo.connect(lfoGain).connect(windGain.gain);
  wind.connect(windFilter).connect(windGain).connect(master);
  wind.start();
  windLfo.start();
  sources.push(wind, windLfo);

  // Water: bandpassed noise, louder near the lake, stream and coast.
  const water = ctx.createBufferSource();
  water.buffer = noise;
  water.loop = true;
  water.playbackRate.value = 1.7;
  const waterFilter = ctx.createBiquadFilter();
  waterFilter.type = "bandpass";
  waterFilter.frequency.value = 900;
  waterFilter.Q.value = 0.6;
  const waterGain = ctx.createGain();
  waterGain.gain.value = 0;
  water.connect(waterFilter).connect(waterGain).connect(master);
  water.start();
  sources.push(water);

  // Engine: two detuned oscillators through a lowpass.
  const engineOsc = ctx.createOscillator();
  engineOsc.type = "sawtooth";
  engineOsc.frequency.value = 45;
  const engineOsc2 = ctx.createOscillator();
  engineOsc2.type = "square";
  engineOsc2.frequency.value = 22.5;
  const engineFilter = ctx.createBiquadFilter();
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 260;
  const engineGain = ctx.createGain();
  engineGain.gain.value = 0;
  const o2g = ctx.createGain();
  o2g.gain.value = 0.5;
  engineOsc.connect(engineFilter);
  engineOsc2.connect(o2g).connect(engineFilter);
  engineFilter.connect(engineGain).connect(master);
  engineOsc.start();
  engineOsc2.start();
  sources.push(engineOsc, engineOsc2);

  const n: Nodes = { ctx, master, engineGain, engineOsc, engineOsc2, engineFilter, waterGain, windLfo, noise, sources, birdTimer: 0 };
  n.birdTimer = window.setInterval(() => chirp(n), 2600);
  return n;
}

function chirp(n: Nodes) {
  if (!enabled || Math.random() < 0.45) return;
  const { ctx, master } = n;
  const t = ctx.currentTime;
  const base = 2200 + Math.random() * 1600;
  const count = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < count; i++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    const st = t + i * 0.13;
    o.frequency.setValueAtTime(base, st);
    o.frequency.exponentialRampToValueAtTime(base * 1.45, st + 0.07);
    g.gain.setValueAtTime(0, st);
    g.gain.linearRampToValueAtTime(0.025, st + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, st + 0.1);
    o.connect(g).connect(master);
    o.start(st);
    o.stop(st + 0.12);
  }
}

export const audio = {
  get enabled() {
    return enabled;
  },
  async setEnabled(on: boolean) {
    enabled = on;
    if (on && !nodes) nodes = build();
    if (!nodes) return;
    try {
      if (on && nodes.ctx.state === "suspended") await nodes.ctx.resume();
    } catch {
      // Autoplay policies can still refuse; the site works fine silently.
    }
    const t = nodes.ctx.currentTime;
    nodes.master.gain.cancelScheduledValues(t);
    nodes.master.gain.setTargetAtTime(on ? 0.7 : 0, t, 0.25);
  },
  /** speed01: 0..1 of top speed. */
  updateEngine(speed01: number, throttle: number) {
    if (!nodes || !enabled) return;
    const t = nodes.ctx.currentTime;
    nodes.engineOsc.frequency.setTargetAtTime(42 + speed01 * 75 + throttle * 12, t, 0.08);
    nodes.engineOsc2.frequency.setTargetAtTime(21 + speed01 * 37 + throttle * 6, t, 0.08);
    nodes.engineFilter.frequency.setTargetAtTime(220 + speed01 * 520 + throttle * 200, t, 0.1);
    nodes.engineGain.gain.setTargetAtTime(0.03 + speed01 * 0.05 + throttle * 0.03, t, 0.1);
  },
  /** 0..1, how close the listener is to water. */
  setWater(level: number) {
    if (!nodes || !enabled) return;
    nodes.waterGain.gain.setTargetAtTime(0.02 + level * 0.22, nodes.ctx.currentTime, 0.4);
  },
  bump(strength: number) {
    if (!nodes || !enabled) return;
    const { ctx, master } = nodes;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(0.12 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.22);
  },
  /** Something breaking: a thud plus a short crackle of splintering. */
  smash(strength: number) {
    if (!nodes || !enabled) return;
    const { ctx, master, noise } = nodes;
    const t = ctx.currentTime;
    audio.bump(Math.min(1, strength + 0.2));
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = 3.5;
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * strength, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + 0.3);
  },
  chime(kind: "open" | "discover" = "open") {
    if (!nodes || !enabled) return;
    const { ctx, master } = nodes;
    const t = ctx.currentTime;
    const notes = kind === "discover" ? [659.25, 830.61, 987.77, 1318.5] : [783.99, 1046.5];
    notes.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const st = t + i * 0.09;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.06, st + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.6);
      o.connect(g).connect(master);
      o.start(st);
      o.stop(st + 0.65);
    });
  },
  suspend() {
    nodes?.ctx.suspend().catch(() => {});
  },
  resume() {
    if (enabled) nodes?.ctx.resume().catch(() => {});
  },
  dispose() {
    if (!nodes) return;
    window.clearInterval(nodes.birdTimer);
    nodes.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    nodes.ctx.close().catch(() => {});
    nodes = null;
    enabled = false;
  },
};

export type SynthId = 'marimba' | 'chimes' | 'harp';

export interface SynthDefinition {
  id: SynthId;
  name: string;
}

export const SYNTHS: SynthDefinition[] = [
  { id: 'marimba', name: '空灵马林巴' },
  { id: 'chimes', name: '玻璃风铃' },
  { id: 'harp', name: '水晶竖琴' },
];

export interface TriggerNoteOptions {
  ctx: AudioContext;
  destination: AudioNode;
  frequency: number;
  time: number;
  velocity: number; // 0..1
  pan: number; // -1..1
  synthId: SynthId;
}

export function triggerSynthNote(opts: TriggerNoteOptions): void {
  const { ctx, destination, frequency, time, velocity, pan, synthId } = opts;
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), time);
  panner.connect(destination);

  if (synthId === 'marimba') {
    playMarimba(ctx, panner, frequency, time, velocity);
  } else if (synthId === 'chimes') {
    playGlassChimes(ctx, panner, frequency, time, velocity);
  } else {
    playCrystalHarp(ctx, panner, frequency, time, velocity);
  }
}

function playMarimba(
  ctx: AudioContext,
  output: AudioNode,
  freq: number,
  time: number,
  velocity: number,
): void {
  const masterGain = ctx.createGain();
  const peak = 0.24 * velocity;
  masterGain.gain.setValueAtTime(0.0001, time);
  masterGain.gain.linearRampToValueAtTime(peak, time + 0.006);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.95);
  masterGain.connect(output);

  // Warm fundamental sine
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, time);
  osc1.connect(masterGain);

  // Wooden marimba 4th harmonic transient
  const osc2 = ctx.createOscillator();
  const harmonicGain = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 4, time);
  harmonicGain.gain.setValueAtTime(0.0001, time);
  harmonicGain.gain.linearRampToValueAtTime(peak * 0.28, time + 0.003);
  harmonicGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  osc2.connect(harmonicGain);
  harmonicGain.connect(output);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 1.0);
  osc2.stop(time + 0.12);
}

function playGlassChimes(
  ctx: AudioContext,
  output: AudioNode,
  freq: number,
  time: number,
  velocity: number,
): void {
  const peak = 0.16 * velocity;

  // Fundamental bell tone
  const osc1 = ctx.createOscillator();
  const g1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, time);
  g1.gain.setValueAtTime(0.0001, time);
  g1.gain.linearRampToValueAtTime(peak, time + 0.012);
  g1.gain.exponentialRampToValueAtTime(0.0001, time + 1.85);
  osc1.connect(g1);
  g1.connect(output);

  // Shimmering glassy overtone (bell partial ~2.756)
  const osc2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2.756, time);
  g2.gain.setValueAtTime(0.0001, time);
  g2.gain.linearRampToValueAtTime(peak * 0.22, time + 0.008);
  g2.gain.exponentialRampToValueAtTime(0.0001, time + 0.75);
  osc2.connect(g2);
  g2.connect(output);

  // Subtle octave sparkle
  const osc3 = ctx.createOscillator();
  const g3 = ctx.createGain();
  osc3.type = 'sine';
  osc3.frequency.setValueAtTime(freq * 2, time);
  g3.gain.setValueAtTime(0.0001, time);
  g3.gain.linearRampToValueAtTime(peak * 0.18, time + 0.02);
  g3.gain.exponentialRampToValueAtTime(0.0001, time + 1.25);
  osc3.connect(g3);
  g3.connect(output);

  osc1.start(time);
  osc2.start(time);
  osc3.start(time);
  osc1.stop(time + 1.95);
  osc2.stop(time + 0.8);
  osc3.stop(time + 1.3);
}

function playCrystalHarp(
  ctx: AudioContext,
  output: AudioNode,
  freq: number,
  time: number,
  velocity: number,
): void {
  const peak = 0.2 * velocity;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(7200, freq * 6.5), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.6), time + 1.1);
  filter.Q.setValueAtTime(1.5, time);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.linearRampToValueAtTime(peak, time + 0.009);
  env.gain.exponentialRampToValueAtTime(0.0001, time + 1.45);

  const osc1 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc1.frequency.setValueAtTime(freq, time);

  const osc2 = ctx.createOscillator();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(freq * 2, time);
  const subMix = ctx.createGain();
  subMix.gain.setValueAtTime(0.25, time);

  osc1.connect(filter);
  osc2.connect(subMix);
  subMix.connect(filter);
  filter.connect(env);
  env.connect(output);

  osc1.start(time);
  osc2.start(time);
  osc1.stop(time + 1.55);
  osc2.stop(time + 1.55);
}

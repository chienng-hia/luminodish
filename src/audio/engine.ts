import { GRID_SIZE } from '../core/life';
import { getScaleRootFrequency, rowToFrequency, type ScaleId } from './scales';
import { triggerSynthNote, type SynthId } from './synths';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private noteBus: GainNode | null = null;
  private recordDest: MediaStreamAudioDestinationNode | null = null;

  // Ambient deep-sea bed nodes
  private ambientGain: GainNode | null = null;
  private droneOsc: OscillatorNode | null = null;
  private ambientEnabled = true;
  private currentScale: ScaleId = 'pentatonic';

  public async ensureInitialized(): Promise<void> {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupGraph();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  public getAudioStream(): MediaStream | null {
    return this.recordDest ? this.recordDest.stream : null;
  }

  public setScale(scaleId: ScaleId): void {
    this.currentScale = scaleId;
    if (this.droneOsc && this.ctx) {
      const targetFreq = getScaleRootFrequency(scaleId);
      this.droneOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.8);
    }
  }

  public setAmbientEnabled(enabled: boolean): void {
    this.ambientEnabled = enabled;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setTargetAtTime(enabled ? 0.16 : 0.0001, this.ctx.currentTime, 0.45);
    }
  }

  public triggerColumn(
    col: number,
    activeRows: number[],
    scaleId: ScaleId,
    synthId: SynthId,
  ): void {
    if (!this.ctx || !this.noteBus || activeRows.length === 0) return;

    const now = this.ctx.currentTime + 0.005;
    const pan = (col / (GRID_SIZE - 1)) * 1.3 - 0.65;
    // Soften polyphony so dense chords remain lush and never clip
    const polyScale = 1 / Math.sqrt(Math.max(1, activeRows.length * 0.72));

    // Cap simultaneous voices per step to 7 well-spaced notes if a column is overly dense
    const selectedRows =
      activeRows.length <= 7
        ? activeRows
        : activeRows.filter((_, i) => i % Math.ceil(activeRows.length / 7) === 0);

    selectedRows.forEach((row, idx) => {
      const freq = rowToFrequency(row, GRID_SIZE, scaleId);
      // Slight micro-strum (4ms) makes chords sound organic and harp-like
      const strumOffset = idx * 0.004;
      triggerSynthNote({
        ctx: this.ctx!,
        destination: this.noteBus!,
        frequency: freq,
        time: now + strumOffset,
        velocity: Math.min(1, polyScale),
        pan,
        synthId,
      });
    });
  }

  public triggerPreviewNote(col: number, row: number, scaleId: ScaleId, synthId: SynthId): void {
    if (!this.ctx || !this.noteBus) return;
    const freq = rowToFrequency(row, GRID_SIZE, scaleId);
    const pan = (col / (GRID_SIZE - 1)) * 1.2 - 0.6;
    triggerSynthNote({
      ctx: this.ctx,
      destination: this.noteBus,
      frequency: freq,
      time: this.ctx.currentTime + 0.004,
      velocity: 0.65,
      pan,
      synthId,
    });
  }

  private setupGraph(): void {
    const ctx = this.ctx!;

    const noteBus = ctx.createGain();
    noteBus.gain.value = 0.9;

    // Lush underwater convolution reverb
    const convolver = ctx.createConvolver();
    convolver.buffer = this.createUnderwaterImpulse(ctx, 2.8, 2.4);

    const reverbFilter = ctx.createBiquadFilter();
    reverbFilter.type = 'lowpass';
    reverbFilter.frequency.value = 2600;

    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.48;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.78;

    // Gentle stereo echo
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.32;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = 0.24;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.value = 1800;
    const delayWet = ctx.createGain();
    delayWet.gain.value = 0.22;

    delay.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delay);
    delayFilter.connect(delayWet);

    // Master dynamics compressor & gain
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 20;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.18;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.88;

    // Routing
    noteBus.connect(dryGain);
    noteBus.connect(convolver);
    noteBus.connect(delay);

    convolver.connect(reverbFilter);
    reverbFilter.connect(wetGain);

    dryGain.connect(compressor);
    wetGain.connect(compressor);
    delayWet.connect(compressor);

    compressor.connect(masterGain);
    masterGain.connect(ctx.destination);

    // Recording tap
    const recordDest = ctx.createMediaStreamDestination();
    masterGain.connect(recordDest);

    this.noteBus = noteBus;
    this.recordDest = recordDest;

    this.setupAmbientBed(ctx, masterGain);
  }

  private setupAmbientBed(ctx: AudioContext, destination: AudioNode): void {
    const ambientGain = ctx.createGain();
    ambientGain.gain.value = this.ambientEnabled ? 0.16 : 0.0001;
    ambientGain.connect(destination);

    // Filtered deep-sea brown noise
    const bufferSize = ctx.sampleRate * 4;
    const noiseBuffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = noiseBuffer.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 2.8;
      }
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const seaFilter = ctx.createBiquadFilter();
    seaFilter.type = 'lowpass';
    seaFilter.frequency.value = 240;
    seaFilter.Q.value = 1.2;

    // Slow LFO breathing on the ocean current filter
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain);
    lfoGain.connect(seaFilter.frequency);

    const noiseMix = ctx.createGain();
    noiseMix.gain.value = 0.55;

    noiseSource.connect(seaFilter);
    seaFilter.connect(noiseMix);
    noiseMix.connect(ambientGain);

    // Ultra-soft sub-oceanic root drone
    const droneOsc = ctx.createOscillator();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = getScaleRootFrequency(this.currentScale);
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.22;
    droneOsc.connect(droneGain);
    droneGain.connect(ambientGain);

    noiseSource.start();
    lfo.start();
    droneOsc.start();

    this.ambientGain = ambientGain;
    this.droneOsc = droneOsc;
  }

  private createUnderwaterImpulse(
    ctx: AudioContext,
    duration: number,
    decay: number,
  ): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const channel = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        channel[i] = (Math.random() * 2 - 1) * env;
      }
    }
    return impulse;
  }
}

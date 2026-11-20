import { PRESETS } from '../core/presets';
import { SCALES, type ScaleId } from '../audio/scales';
import { SYNTHS, type SynthId } from '../audio/synths';

export interface ControlHandlers {
  onWakeAndPlay: () => void;
  onTogglePlay: () => void;
  onStep: () => void;
  onClear: () => void;
  onSelectPreset: (presetId: string) => void;
  onSelectScale: (scaleId: ScaleId) => void;
  onSelectSynth: (synthId: SynthId) => void;
  onChangeBpm: (bpm: number) => void;
  onChangeEvolveBars: (bars: number) => void;
  onToggleAutoHeal: () => void;
  onToggleAmbient: () => void;
  onShare: () => void;
  onToggleRecord: () => void;
}

export class ControlsUI {
  private readonly btnPlay: HTMLButtonElement;
  private readonly playIcon: HTMLElement;
  private readonly playLabel: HTMLElement;
  private readonly startOverlay: HTMLElement;
  private readonly statGen: HTMLElement;
  private readonly statAlive: HTMLElement;
  private readonly selectPreset: HTMLSelectElement;
  private readonly selectScale: HTMLSelectElement;
  private readonly selectSynth: HTMLSelectElement;
  private readonly selectEvolve: HTMLSelectElement;
  private readonly sliderBpm: HTMLInputElement;
  private readonly bpmValue: HTMLElement;
  private readonly btnAutoHeal: HTMLButtonElement;
  private readonly btnAmbient: HTMLButtonElement;
  private readonly btnRecord: HTMLButtonElement;
  private readonly recordLabel: HTMLElement;
  private readonly toastEl: HTMLElement;

  private toastTimer: number | null = null;

  constructor(handlers: ControlHandlers) {
    this.btnPlay = this.el('btn-play');
    this.playIcon = this.el('play-icon');
    this.playLabel = this.el('play-label');
    this.startOverlay = this.el('start-overlay');
    this.statGen = this.el('stat-gen');
    this.statAlive = this.el('stat-alive');
    this.selectPreset = this.el('select-preset');
    this.selectScale = this.el('select-scale');
    this.selectSynth = this.el('select-synth');
    this.selectEvolve = this.el('select-evolve');
    this.sliderBpm = this.el('slider-bpm');
    this.bpmValue = this.el('bpm-value');
    this.btnAutoHeal = this.el('btn-autoheal');
    this.btnAmbient = this.el('btn-ambient');
    this.btnRecord = this.el('btn-record');
    this.recordLabel = this.el('record-label');
    this.toastEl = this.el('toast');

    this.populateSelects();
    this.bindEvents(handlers);
  }

  private el<T extends HTMLElement>(id: string): T {
    const node = document.getElementById(id);
    if (!node) throw new Error(`Missing required element #${id}`);
    return node as T;
  }

  private populateSelects(): void {
    for (const preset of PRESETS) {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.name;
      this.selectPreset.appendChild(opt);
    }

    for (const scale of SCALES) {
      const opt = document.createElement('option');
      opt.value = scale.id;
      opt.textContent = scale.name;
      this.selectScale.appendChild(opt);
    }

    for (const synth of SYNTHS) {
      const opt = document.createElement('option');
      opt.value = synth.id;
      opt.textContent = synth.name;
      this.selectSynth.appendChild(opt);
    }
  }

  private bindEvents(handlers: ControlHandlers): void {
    this.el('btn-wake').addEventListener('click', () => handlers.onWakeAndPlay());
    this.btnPlay.addEventListener('click', () => handlers.onTogglePlay());
    this.el('btn-step').addEventListener('click', () => handlers.onStep());
    this.el('btn-clear').addEventListener('click', () => handlers.onClear());
    this.el('btn-share').addEventListener('click', () => handlers.onShare());
    this.btnRecord.addEventListener('click', () => handlers.onToggleRecord());

    this.selectPreset.addEventListener('change', () => {
      handlers.onSelectPreset(this.selectPreset.value);
    });

    this.selectScale.addEventListener('change', () => {
      handlers.onSelectScale(this.selectScale.value as ScaleId);
    });

    this.selectSynth.addEventListener('change', () => {
      handlers.onSelectSynth(this.selectSynth.value as SynthId);
    });

    this.selectEvolve.addEventListener('change', () => {
      handlers.onChangeEvolveBars(Number(this.selectEvolve.value));
    });

    this.sliderBpm.addEventListener('input', () => {
      const bpm = Number(this.sliderBpm.value);
      this.bpmValue.textContent = String(bpm);
      handlers.onChangeBpm(bpm);
    });

    this.btnAutoHeal.addEventListener('click', () => handlers.onToggleAutoHeal());
    this.btnAmbient.addEventListener('click', () => handlers.onToggleAmbient());

    window.addEventListener('keydown', (ev) => {
      if (ev.target instanceof HTMLInputElement || ev.target instanceof HTMLSelectElement) {
        return;
      }
      if (ev.code === 'Space') {
        ev.preventDefault();
        handlers.onTogglePlay();
      } else if (ev.key === 's' || ev.key === 'S') {
        handlers.onStep();
      } else if (ev.key === 'c' || ev.key === 'C') {
        handlers.onClear();
      } else if (ev.key === 'r' || ev.key === 'R') {
        this.selectPreset.value = 'plankton';
        handlers.onSelectPreset('plankton');
      }
    });
  }

  public hideOverlay(): void {
    this.startOverlay.classList.add('hidden');
  }

  public setPlaying(playing: boolean): void {
    this.playIcon.textContent = playing ? '⏸' : '▶';
    this.playLabel.textContent = playing ? '暂停' : '播放';
  }

  public updateStats(generation: number, alive: number): void {
    this.statGen.textContent = String(generation);
    this.statAlive.textContent = String(alive);
  }

  public syncSettings(opts: {
    bpm: number;
    scaleId: ScaleId;
    synthId: SynthId;
    evolveBars: number;
    autoHeal: boolean;
    ambient: boolean;
    presetId?: string;
  }): void {
    this.sliderBpm.value = String(opts.bpm);
    this.bpmValue.textContent = String(opts.bpm);
    this.selectScale.value = opts.scaleId;
    this.selectSynth.value = opts.synthId;
    this.selectEvolve.value = String(opts.evolveBars);
    if (opts.presetId) {
      this.selectPreset.value = opts.presetId;
    }
    this.setToggleState(this.btnAutoHeal, opts.autoHeal);
    this.setToggleState(this.btnAmbient, opts.ambient);
  }

  public setRecordingState(recording: boolean, elapsedSec = 0): void {
    this.btnRecord.classList.toggle('recording', recording);
    if (recording) {
      const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const ss = String(elapsedSec % 60).padStart(2, '0');
      this.recordLabel.textContent = `停止 ${mm}:${ss}`;
    } else {
      this.recordLabel.textContent = '录制导出';
    }
  }

  public showToast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('visible');
    if (this.toastTimer !== null) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toastEl.classList.remove('visible');
    }, 2400);
  }

  private setToggleState(btn: HTMLButtonElement, active: boolean): void {
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

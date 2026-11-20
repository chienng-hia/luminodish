import { CELL_COUNT } from './life';
import type { ScaleId } from '../audio/scales';
import type { SynthId } from '../audio/synths';

export interface ShareableState {
  cells: Uint8Array;
  bpm: number;
  scaleId: ScaleId;
  synthId: SynthId;
  evolveBars: number; // 0 = frozen, 1 = every bar, 2 = every 2 bars
  autoHeal: boolean;
  ambient: boolean;
}

const SCALE_LIST: ScaleId[] = ['pentatonic', 'lydian', 'abyssal', 'hirajoshi'];
const SYNTH_LIST: SynthId[] = ['marimba', 'chimes', 'harp'];

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array | null {
  try {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function encodeStateToHash(state: ShareableState): string {
  // 32 bytes for 256 cells + 3 metadata bytes = 35 bytes
  const bytes = new Uint8Array(35);
  for (let i = 0; i < CELL_COUNT; i++) {
    if (state.cells[i]) {
      bytes[i >> 3] |= 1 << (i & 7);
    }
  }

  const bpmClamped = Math.max(50, Math.min(180, Math.round(state.bpm)));
  const scaleIdx = Math.max(0, SCALE_LIST.indexOf(state.scaleId));
  const synthIdx = Math.max(0, SYNTH_LIST.indexOf(state.synthId));
  const evolveIdx = state.evolveBars === 0 ? 0 : state.evolveBars === 2 ? 2 : 1;

  bytes[32] = bpmClamped;
  bytes[33] = (scaleIdx & 0x0f) | ((synthIdx & 0x0f) << 4);
  bytes[34] =
    (evolveIdx & 0x03) |
    (state.autoHeal ? 0x04 : 0) |
    (state.ambient ? 0x08 : 0);

  return `#v1=${toBase64Url(bytes)}`;
}

export function decodeStateFromHash(hash: string): ShareableState | null {
  if (!hash || !hash.startsWith('#v1=')) return null;
  const payload = hash.slice(4);
  const bytes = fromBase64Url(payload);
  if (!bytes || bytes.length < 35) return null;

  const cells = new Uint8Array(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) {
    cells[i] = (bytes[i >> 3] >> (i & 7)) & 1;
  }

  const bpm = Math.max(50, Math.min(180, bytes[32] || 92));
  const scaleIdx = bytes[33] & 0x0f;
  const synthIdx = (bytes[33] >> 4) & 0x0f;
  const evolveRaw = bytes[34] & 0x03;

  return {
    cells,
    bpm,
    scaleId: SCALE_LIST[scaleIdx] ?? 'pentatonic',
    synthId: SYNTH_LIST[synthIdx] ?? 'marimba',
    evolveBars: evolveRaw === 0 ? 0 : evolveRaw === 2 ? 2 : 1,
    autoHeal: Boolean(bytes[34] & 0x04),
    ambient: Boolean(bytes[34] & 0x08),
  };
}

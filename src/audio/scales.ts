export type ScaleId = 'pentatonic' | 'lydian' | 'abyssal' | 'hirajoshi';

export interface ScaleDefinition {
  id: ScaleId;
  name: string;
  rootMidi: number;
  intervals: number[]; // Semitones within one octave
}

export const SCALES: ScaleDefinition[] = [
  {
    id: 'pentatonic',
    name: '深海五声',
    rootMidi: 48, // C3
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: 'lydian',
    name: '治愈利底亚',
    rootMidi: 53, // F3
    intervals: [0, 2, 4, 6, 7, 9, 11],
  },
  {
    id: 'abyssal',
    name: '深海小调',
    rootMidi: 50, // D3
    intervals: [0, 2, 3, 5, 7, 9, 10],
  },
  {
    id: 'hirajoshi',
    name: '日本平调',
    rootMidi: 48, // C3
    intervals: [0, 2, 3, 7, 8],
  },
];

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function getScaleById(id: ScaleId): ScaleDefinition {
  return SCALES.find((s) => s.id === id) ?? SCALES[0];
}

/**
 * Returns frequency for a grid row (0 = top/highest, gridSize - 1 = bottom/lowest).
 */
export function rowToFrequency(row: number, gridSize: number, scaleId: ScaleId): number {
  const scale = getScaleById(scaleId);
  const degreeFromBottom = gridSize - 1 - row;
  const len = scale.intervals.length;
  const octave = Math.floor(degreeFromBottom / len);
  const step = degreeFromBottom % len;
  const midi = scale.rootMidi + octave * 12 + scale.intervals[step];
  return midiToFreq(midi);
}

export function getScaleRootFrequency(scaleId: ScaleId): number {
  const scale = getScaleById(scaleId);
  return midiToFreq(scale.rootMidi - 12);
}

import { GRID_SIZE } from './life';

export interface Preset {
  id: string;
  name: string;
  subtitle: string;
  generate: () => Array<[number, number]>;
}

export const PRESETS: Preset[] = [
  {
    id: 'jellyfish',
    name: '荧光水母',
    subtitle: '对称脉冲与舒缓波纹',
    generate: () => [
      // Bell dome
      [6, 3], [7, 3], [8, 3], [9, 3],
      [5, 4], [10, 4],
      [4, 5], [7, 5], [8, 5], [11, 5],
      [5, 6], [6, 6], [9, 6], [10, 6],
      // Trailing tentacles
      [5, 8], [10, 8],
      [6, 9], [9, 9],
      [5, 10], [7, 10], [8, 10], [10, 10],
      [6, 12], [9, 12],
    ],
  },
  {
    id: 'gliders',
    name: '浮游滑翔队',
    subtitle: '不断漂移的对角旋律',
    generate: () => [
      // Glider 1 (top-left)
      [2, 1], [3, 2], [1, 3], [2, 3], [3, 3],
      // Glider 2 (mid)
      [9, 5], [10, 6], [8, 7], [9, 7], [10, 7],
      // Glider 3 (bottom-left)
      [4, 10], [5, 11], [3, 12], [4, 12], [5, 12],
      // Gentle anchor blinker
      [13, 11], [13, 12], [13, 13],
    ],
  },
  {
    id: 'coral',
    name: '深海珊瑚',
    subtitle: '中心绽放的丰富和声',
    generate: () => [
      [7, 5], [8, 5],
      [6, 6], [9, 6],
      [5, 7], [7, 7], [8, 7], [10, 7],
      [5, 8], [7, 8], [8, 8], [10, 8],
      [6, 9], [9, 9],
      [7, 10], [8, 10],
      // Corner polyps
      [2, 3], [3, 3], [2, 4],
      [12, 12], [13, 12], [13, 11],
    ],
  },
  {
    id: 'anemone',
    name: '海葵律动',
    subtitle: '稳定周期的治愈节拍',
    generate: () => [
      // Toad 1
      [2, 4], [3, 4], [4, 4],
      [1, 5], [2, 5], [3, 5],
      // Beacon
      [10, 2], [11, 2], [10, 3],
      [13, 4], [12, 5], [13, 5],
      // Blinkers
      [6, 8], [7, 8], [8, 8],
      [12, 10], [12, 11], [12, 12],
      // Toad 2
      [3, 12], [4, 12], [5, 12],
      [2, 13], [3, 13], [4, 13],
    ],
  },
  {
    id: 'plankton',
    name: '随机浮游群',
    subtitle: '每次播种都是未知乐章',
    generate: () => {
      const coords: Array<[number, number]> = [];
      for (let row = 1; row < GRID_SIZE - 1; row++) {
        for (let col = 1; col < GRID_SIZE - 1; col++) {
          if (Math.random() < 0.16) {
            coords.push([col, row]);
          }
        }
      }
      return coords;
    },
  },
];

export function getPresetById(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

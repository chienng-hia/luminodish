import './style.css';
import { GRID_SIZE, LifeGrid } from './core/life';
import { getPresetById } from './core/presets';
import { decodeStateFromHash, encodeStateToHash } from './core/share';
import { AudioEngine } from './audio/engine';
import { DishRecorder } from './audio/recorder';
import type { ScaleId } from './audio/scales';
import type { SynthId } from './audio/synths';
import { DishRenderer } from './render/canvas';
import { ControlsUI } from './ui/controls';

interface AppState {
  isPlaying: boolean;
  bpm: number;
  scaleId: ScaleId;
  synthId: SynthId;
  evolveBars: number; // 0 = frozen, 1 = every bar, 2 = every 2 bars
  autoHeal: boolean;
  ambient: boolean;
}

const state: AppState = {
  isPlaying: false,
  bpm: 92,
  scaleId: 'pentatonic',
  synthId: 'marimba',
  evolveBars: 1,
  autoHeal: true,
  ambient: true,
};

const grid = new LifeGrid();
const audio = new AudioEngine();
const recorder = new DishRecorder();

const canvas = document.getElementById('dish-canvas') as HTMLCanvasElement;

let scanProgress = 0; // continuous 0..GRID_SIZE
let lastTriggeredCol = -1;
let barsSinceEvolve = 0;
let lastFrameTime = performance.now();

const renderer = new DishRenderer(canvas, {
  onPaintCell: (col, row, alive, isInitialClick) => {
    void audio.ensureInitialized();
    ui.hideOverlay();

    let targetAlive = alive;
    if (isInitialClick && alive) {
      // Left click toggles the cell under the cursor and sets drag paint mode accordingly
      targetAlive = grid.get(col, row) === 0;
      renderer.setPaintMode(targetAlive);
    }

    grid.set(col, row, targetAlive);
    if (targetAlive) {
      renderer.triggerCellBloom(col, row);
      audio.triggerPreviewNote(col, row, state.scaleId, state.synthId);
    }
    ui.updateStats(grid.generation, grid.getAliveCount());
  },
});

const ui = new ControlsUI({
  onWakeAndPlay: async () => {
    await startPlayback();
  },
  onTogglePlay: async () => {
    if (state.isPlaying) {
      state.isPlaying = false;
      ui.setPlaying(false);
    } else {
      await startPlayback();
    }
  },
  onStep: () => {
    performEvolution();
  },
  onClear: () => {
    grid.clear();
    ui.updateStats(grid.generation, grid.getAliveCount());
    ui.showToast('培养皿已清空，点击画布播撒荧光细胞');
  },
  onSelectPreset: (presetId) => {
    const preset = getPresetById(presetId);
    grid.loadPattern(preset.generate());
    barsSinceEvolve = 0;
    ui.updateStats(grid.generation, grid.getAliveCount());
    ui.showToast(`已载入图鉴：${preset.name}`);
  },
  onSelectScale: (scaleId) => {
    state.scaleId = scaleId;
    audio.setScale(scaleId);
  },
  onSelectSynth: (synthId) => {
    state.synthId = synthId;
  },
  onChangeBpm: (bpm) => {
    state.bpm = bpm;
  },
  onChangeEvolveBars: (bars) => {
    state.evolveBars = bars;
    barsSinceEvolve = 0;
  },
  onToggleAutoHeal: () => {
    state.autoHeal = !state.autoHeal;
    ui.syncSettings(state);
    ui.showToast(state.autoHeal ? '生态自愈已开启：永不冷场' : '生态自愈已关闭');
  },
  onToggleAmbient: () => {
    state.ambient = !state.ambient;
    audio.setAmbientEnabled(state.ambient);
    ui.syncSettings(state);
  },
  onShare: async () => {
    const hash = encodeStateToHash({
      cells: grid.cells,
      bpm: state.bpm,
      scaleId: state.scaleId,
      synthId: state.synthId,
      evolveBars: state.evolveBars,
      autoHeal: state.autoHeal,
      ambient: state.ambient,
    });
    window.history.replaceState(null, '', hash);
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      ui.showToast('深海乐曲链接已复制，发给朋友即可打开聆听');
    } catch {
      ui.showToast('链接已更新到地址栏，可直接复制分享');
    }
  },
  onToggleRecord: async () => {
    if (recorder.active) {
      recorder.stop();
      ui.setRecordingState(false);
      ui.showToast('录制完成，正在导出 WebM 文件');
      return;
    }

    await startPlayback();
    const ok = recorder.start(canvas, audio.getAudioStream());
    if (ok) {
      ui.setRecordingState(true, 0);
      ui.showToast('开始录制音画短片，再次点击停止并导出');
    } else {
      ui.showToast('当前浏览器不支持 MediaRecorder 录制');
    }
  },
});

async function startPlayback(): Promise<void> {
  await audio.ensureInitialized();
  audio.setScale(state.scaleId);
  audio.setAmbientEnabled(state.ambient);
  ui.hideOverlay();
  state.isPlaying = true;
  ui.setPlaying(true);
}

function performEvolution(): void {
  const spore = grid.step(state.autoHeal);
  if (spore) {
    renderer.triggerSporePulse(spore.col, spore.row);
    ui.showToast(
      spore.reason === 'extinction'
        ? '生态自愈：深海重新播撒了荧光孢子'
        : '生态自愈：检测到循环停滞，已滴入新孢子',
    );
  }
  ui.updateStats(grid.generation, grid.getAliveCount());
}

function initFromUrlOrPreset(): void {
  const decoded = decodeStateFromHash(window.location.hash);
  if (decoded) {
    grid.clear();
    grid.cells.set(decoded.cells);
    for (let i = 0; i < grid.cells.length; i++) {
      grid.ages[i] = grid.cells[i];
    }
    state.bpm = decoded.bpm;
    state.scaleId = decoded.scaleId;
    state.synthId = decoded.synthId;
    state.evolveBars = decoded.evolveBars;
    state.autoHeal = decoded.autoHeal;
    state.ambient = decoded.ambient;
    ui.syncSettings(state);
    ui.showToast('已从分享链接还原深海培养皿');
  } else {
    const initialPreset = getPresetById('jellyfish');
    grid.loadPattern(initialPreset.generate());
    ui.syncSettings({ ...state, presetId: initialPreset.id });
  }
  ui.updateStats(grid.generation, grid.getAliveCount());
}

function tick(now: number): void {
  const dt = Math.min(0.1, (now - lastFrameTime) / 1000);
  lastFrameTime = now;

  if (state.isPlaying) {
    // 16th notes per second = (bpm / 60) * 4, slowed slightly (x0.5 = 8th-note feel) for calm deep-sea pacing
    const colsPerSecond = (state.bpm / 60) * 2;
    scanProgress += dt * colsPerSecond;

    if (scanProgress >= GRID_SIZE) {
      scanProgress -= GRID_SIZE;
      lastTriggeredCol = -1;
      if (state.evolveBars > 0) {
        barsSinceEvolve += 1;
        if (barsSinceEvolve >= state.evolveBars) {
          barsSinceEvolve = 0;
          performEvolution();
        }
      }
    }

    const currentCol = Math.floor(scanProgress);
    if (currentCol !== lastTriggeredCol && currentCol >= 0 && currentCol < GRID_SIZE) {
      lastTriggeredCol = currentCol;
      const activeRows = grid.getActiveRowsInColumn(currentCol);
      if (activeRows.length > 0) {
        audio.triggerColumn(currentCol, activeRows, state.scaleId, state.synthId);
        for (const row of activeRows) {
          renderer.triggerCellBloom(currentCol, row);
        }
      }
    }
  }

  if (recorder.active) {
    ui.setRecordingState(true, recorder.elapsedSeconds);
  }

  renderer.render(grid, scanProgress, state.isPlaying, now / 1000);
  requestAnimationFrame(tick);
}

window.addEventListener('resize', () => renderer.resize());

initFromUrlOrPreset();
requestAnimationFrame(tick);

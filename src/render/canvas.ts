import { CELL_COUNT, GRID_SIZE, type LifeGrid } from '../core/life';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  hue: number;
  alpha: number;
  lineWidth: number;
}

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hue: number;
  life: number;
  maxLife: number;
}

interface AmbientDust {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  vx: number;
  vy: number;
  r: number;
  alpha: number;
  phase: number;
}

export interface CellPointerCallback {
  onPaintCell: (col: number, row: number, alive: boolean, isInitialClick: boolean) => void;
}

export class DishRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: CellPointerCallback;

  private cssSize = 600;
  private dishRadius = 270;
  private gridOrigin = 80;
  private gridPixelSize = 440;
  private cellSize = 27.5;

  private readonly cellGlow = new Float32Array(CELL_COUNT);
  private readonly cellPhase = new Float32Array(CELL_COUNT);
  private ripples: Ripple[] = [];
  private motes: Mote[] = [];
  private dust: AmbientDust[] = [];

  private hoverCell: { col: number; row: number } | null = null;
  private isPointerDown = false;
  private paintMode = true;
  private lastPaintedKey = '';

  constructor(canvas: HTMLCanvasElement, callbacks: CellPointerCallback) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = ctx;
    this.callbacks = callbacks;

    for (let i = 0; i < CELL_COUNT; i++) {
      this.cellPhase[i] = Math.random() * Math.PI * 2;
    }

    for (let i = 0; i < 42; i++) {
      this.dust.push({
        x: Math.random(),
        y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00018,
        vy: -0.00008 - Math.random() * 0.00016,
        r: 0.8 + Math.random() * 1.8,
        alpha: 0.12 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
      });
    }

    this.resize();
    this.bindPointerEvents();
  }

  public resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.max(280, Math.floor(Math.min(rect.width, rect.height)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.cssSize = size;
    this.canvas.width = Math.floor(size * dpr);
    this.canvas.height = Math.floor(size * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.dishRadius = size * 0.465;
    // Inscribed square with gentle breathing margin inside circular petri dish
    this.gridPixelSize = this.dishRadius * 1.32;
    this.gridOrigin = (size - this.gridPixelSize) / 2;
    this.cellSize = this.gridPixelSize / GRID_SIZE;
  }

  public triggerCellBloom(col: number, row: number): void {
    const idx = row * GRID_SIZE + col;
    this.cellGlow[idx] = 1.0;

    const { x, y } = this.cellCenter(col, row);
    const hue = this.rowHue(row);

    this.ripples.push({
      x,
      y,
      radius: this.cellSize * 0.35,
      maxRadius: this.cellSize * 2.6,
      hue,
      alpha: 0.72,
      lineWidth: 2.0,
    });

    // Spawn 2-3 rising bioluminescent motes
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.22 + Math.random() * 0.55;
      this.motes.push({
        x,
        y,
        vx: Math.cos(angle) * speed * 0.6,
        vy: Math.sin(angle) * speed * 0.6 - 0.35,
        radius: 1.2 + Math.random() * 1.8,
        hue,
        life: 0,
        maxLife: 45 + Math.random() * 35,
      });
    }
  }

  public triggerSporePulse(col: number, row: number): void {
    const { x, y } = this.cellCenter(col, row);
    this.ripples.push({
      x,
      y,
      radius: this.cellSize * 0.4,
      maxRadius: this.cellSize * 5.2,
      hue: 154, // luminous emerald-mint
      alpha: 0.85,
      lineWidth: 2.6,
    });
  }

  public render(
    grid: LifeGrid,
    scanProgress: number, // 0..GRID_SIZE continuous position
    isPlaying: boolean,
    timeSec: number,
  ): void {
    const ctx = this.ctx;
    const size = this.cssSize;
    const cx = size / 2;
    const cy = size / 2;

    // 1. Deep abyssal background fill (also looks great when recorded via captureStream)
    const bgGrad = ctx.createRadialGradient(cx, cy, this.dishRadius * 0.1, cx, cy, size * 0.72);
    bgGrad.addColorStop(0, '#072030');
    bgGrad.addColorStop(0.62, '#04121d');
    bgGrad.addColorStop(1, '#02080f');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, size, size);

    // 2. Clip inside circular petri dish for organic ocean interior
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, this.dishRadius, 0, Math.PI * 2);
    ctx.clip();

    // Inner dish subtle radial glow
    const dishGrad = ctx.createRadialGradient(
      cx - this.dishRadius * 0.18,
      cy - this.dishRadius * 0.2,
      this.dishRadius * 0.05,
      cx,
      cy,
      this.dishRadius,
    );
    dishGrad.addColorStop(0, 'rgba(18, 86, 108, 0.34)');
    dishGrad.addColorStop(0.68, 'rgba(6, 30, 48, 0.42)');
    dishGrad.addColorStop(1, 'rgba(2, 14, 26, 0.85)');
    ctx.fillStyle = dishGrad;
    ctx.fillRect(0, 0, size, size);

    // Subtle concentric sonar guide rings
    ctx.strokeStyle = 'rgba(100, 220, 235, 0.055)';
    ctx.lineWidth = 1;
    for (const ratio of [0.35, 0.65, 0.92]) {
      ctx.beginPath();
      ctx.arc(cx, cy, this.dishRadius * ratio, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 3. Drifting ambient micro-plankton dust
    for (const p of this.dust) {
      p.x = (p.x + p.vx + 1) % 1;
      p.y = (p.y + p.vy + 1) % 1;
      const shimmer = 0.55 + 0.45 * Math.sin(timeSec * 1.4 + p.phase);
      ctx.fillStyle = `rgba(120, 240, 245, ${p.alpha * shimmer})`;
      ctx.beginPath();
      ctx.arc(p.x * size, p.y * size, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Sonar scan beam (when playing)
    if (isPlaying) {
      const beamX = this.gridOrigin + scanProgress * this.cellSize;
      const beamWidth = this.cellSize * 2.2;
      const beamGrad = ctx.createLinearGradient(beamX - beamWidth, 0, beamX + this.cellSize * 0.3, 0);
      beamGrad.addColorStop(0, 'rgba(56, 238, 224, 0)');
      beamGrad.addColorStop(0.76, 'rgba(56, 238, 224, 0.085)');
      beamGrad.addColorStop(0.95, 'rgba(130, 255, 242, 0.22)');
      beamGrad.addColorStop(1, 'rgba(130, 255, 242, 0)');

      ctx.fillStyle = beamGrad;
      ctx.fillRect(beamX - beamWidth, 0, beamWidth + this.cellSize * 0.3, size);

      // Crisp leading sonar filament
      ctx.strokeStyle = 'rgba(155, 255, 246, 0.32)';
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(beamX, 0);
      ctx.lineTo(beamX, size);
      ctx.stroke();
    }

    // 5. Subtle petri grid dots & active column highlight
    const activeCol = isPlaying ? Math.floor(scanProgress) % GRID_SIZE : -1;
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const { x, y } = this.cellCenter(col, row);
        const isColBeat = col % 4 === 0;
        const isCurrentCol = col === activeCol;

        ctx.fillStyle = isCurrentCol
          ? 'rgba(125, 250, 240, 0.26)'
          : isColBeat
            ? 'rgba(100, 210, 225, 0.14)'
            : 'rgba(100, 210, 225, 0.075)';
        ctx.beginPath();
        ctx.arc(x, y, isColBeat ? 1.5 : 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Hover preview halo
    if (this.hoverCell) {
      const { x, y } = this.cellCenter(this.hoverCell.col, this.hoverCell.row);
      const hue = this.rowHue(this.hoverCell.row);
      ctx.strokeStyle = `hsla(${hue}, 90%, 75%, 0.45)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, this.cellSize * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 7. Expanding water ripples
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.radius += (r.maxRadius - r.radius) * 0.085 + 0.45;
      r.alpha *= 0.945;

      if (r.alpha < 0.015 || r.radius >= r.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      ctx.strokeStyle = `hsla(${r.hue}, 95%, 74%, ${r.alpha})`;
      ctx.lineWidth = r.lineWidth;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 8. Bioluminescent cells
    for (let row = 0; row < GRID_SIZE; row++) {
      const hue = this.rowHue(row);
      for (let col = 0; col < GRID_SIZE; col++) {
        const idx = row * GRID_SIZE + col;
        // Decay trigger glow smoothly
        this.cellGlow[idx] *= 0.91;

        if (grid.cells[idx] !== 1) continue;

        const { x, y } = this.cellCenter(col, row);
        const phase = this.cellPhase[idx];
        const age = grid.ages[idx];
        const breathe = 1 + 0.08 * Math.sin(timeSec * 2.6 + phase);
        const glowBoost = this.cellGlow[idx];

        // Gentle organic float offset
        const ox = Math.sin(timeSec * 1.3 + phase) * 0.9;
        const oy = Math.cos(timeSec * 1.1 + phase * 1.3) * 0.9;

        const baseRadius = this.cellSize * (0.31 + Math.min(age, 4) * 0.014) * breathe;
        const haloRadius = baseRadius * (2.3 + glowBoost * 1.35);

        // Outer soft bioluminescent halo
        const haloGrad = ctx.createRadialGradient(x + ox, y + oy, baseRadius * 0.2, x + ox, y + oy, haloRadius);
        haloGrad.addColorStop(0, `hsla(${hue}, 96%, 72%, ${0.5 + glowBoost * 0.42})`);
        haloGrad.addColorStop(0.45, `hsla(${hue}, 92%, 58%, ${0.18 + glowBoost * 0.22})`);
        haloGrad.addColorStop(1, `hsla(${hue}, 92%, 50%, 0)`);

        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // Translucent cell body
        const bodyGrad = ctx.createRadialGradient(
          x + ox - baseRadius * 0.25,
          y + oy - baseRadius * 0.25,
          baseRadius * 0.1,
          x + ox,
          y + oy,
          baseRadius,
        );
        bodyGrad.addColorStop(0, `hsla(${hue}, 100%, ${88 + glowBoost * 12}%, 0.98)`);
        bodyGrad.addColorStop(0.6, `hsla(${hue}, 94%, 66%, 0.88)`);
        bodyGrad.addColorStop(1, `hsla(${hue + 10}, 88%, 48%, 0.72)`);

        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, baseRadius * (1 + glowBoost * 0.22), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 9. Rising bioluminescent motes
    for (let i = this.motes.length - 1; i >= 0; i--) {
      const m = this.motes[i];
      m.x += m.vx;
      m.y += m.vy;
      m.life += 1;
      if (m.life >= m.maxLife) {
        this.motes.splice(i, 1);
        continue;
      }
      const alpha = (1 - m.life / m.maxLife) * 0.75;
      ctx.fillStyle = `hsla(${m.hue}, 100%, 82%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius * (1 - (m.life / m.maxLife) * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 10. Glass petri dish rim & specular refraction
    ctx.save();
    // Outer soft rim shadow/glow
    ctx.strokeStyle = 'rgba(84, 224, 232, 0.22)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(cx, cy, this.dishRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Outer glass lip
    ctx.strokeStyle = 'rgba(170, 246, 255, 0.09)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, this.dishRadius + 4, 0, Math.PI * 2);
    ctx.stroke();

    // Top-left glass specular highlight arc
    ctx.strokeStyle = 'rgba(205, 250, 255, 0.22)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(cx, cy, this.dishRadius - 3, Math.PI * 1.12, Math.PI * 1.44);
    ctx.stroke();
    ctx.restore();
  }

  private cellCenter(col: number, row: number): { x: number; y: number } {
    return {
      x: this.gridOrigin + (col + 0.5) * this.cellSize,
      y: this.gridOrigin + (row + 0.5) * this.cellSize,
    };
  }

  /**
   * Bottom rows (low notes) = deep oceanic cyan-teal (188°),
   * Mid rows = luminous aqua-mint (168°),
   * Top rows (high notes) = ethereal bioluminescent azure/violet (218° -> 252°).
   */
  private rowHue(row: number): number {
    const t = 1 - row / (GRID_SIZE - 1); // 0 at bottom, 1 at top
    if (t < 0.5) {
      // 178 -> 158 (teal to luminous mint)
      return 178 - t * 40;
    }
    // 158 -> 238 (mint -> cyan -> ethereal violet-blue)
    return 158 + (t - 0.5) * 160;
  }

  private pointerToCell(ev: PointerEvent): { col: number; row: number } | null {
    const rect = this.canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    const col = Math.floor((x - this.gridOrigin) / this.cellSize);
    const row = Math.floor((y - this.gridOrigin) / this.cellSize);
    if (col < 0 || col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) {
      return null;
    }
    return { col, row };
  }

  private bindPointerEvents(): void {
    this.canvas.addEventListener('pointerdown', (ev) => {
      const cell = this.pointerToCell(ev);
      if (!cell) return;
      this.canvas.setPointerCapture(ev.pointerId);
      this.isPointerDown = true;
      this.lastPaintedKey = `${cell.col},${cell.row}`;
      // Right-click erases; left-click toggles via callback decision
      this.paintMode = ev.button !== 2;
      this.callbacks.onPaintCell(cell.col, cell.row, this.paintMode, true);
    });

    this.canvas.addEventListener('pointermove', (ev) => {
      const cell = this.pointerToCell(ev);
      this.hoverCell = cell;
      if (!this.isPointerDown || !cell) return;
      const key = `${cell.col},${cell.row}`;
      if (key === this.lastPaintedKey) return;
      this.lastPaintedKey = key;
      this.callbacks.onPaintCell(cell.col, cell.row, this.paintMode, false);
    });

    const endDrag = () => {
      this.isPointerDown = false;
      this.lastPaintedKey = '';
    };

    this.canvas.addEventListener('pointerup', endDrag);
    this.canvas.addEventListener('pointercancel', endDrag);
    this.canvas.addEventListener('pointerleave', () => {
      this.hoverCell = null;
      endDrag();
    });
    this.canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  public setPaintMode(alive: boolean): void {
    this.paintMode = alive;
  }
}

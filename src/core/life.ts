export const GRID_SIZE = 16;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export interface SporeEvent {
  col: number;
  row: number;
  reason: 'extinction' | 'stagnation';
}

export class LifeGrid {
  public readonly size = GRID_SIZE;
  public cells: Uint8Array = new Uint8Array(CELL_COUNT);
  public ages: Uint8Array = new Uint8Array(CELL_COUNT);
  public generation = 0;

  private recentHashes: string[] = [];
  private stagnantBars = 0;

  public index(col: number, row: number): number {
    return row * this.size + col;
  }

  public get(col: number, row: number): number {
    if (col < 0 || col >= this.size || row < 0 || row >= this.size) return 0;
    return this.cells[this.index(col, row)];
  }

  public set(col: number, row: number, alive: boolean): void {
    if (col < 0 || col >= this.size || row < 0 || row >= this.size) return;
    const idx = this.index(col, row);
    const next = alive ? 1 : 0;
    if (this.cells[idx] !== next) {
      this.cells[idx] = next;
      this.ages[idx] = next ? 1 : 0;
    }
  }

  public clear(): void {
    this.cells.fill(0);
    this.ages.fill(0);
    this.generation = 0;
    this.recentHashes = [];
    this.stagnantBars = 0;
  }

  public loadPattern(coords: Array<[number, number]>): void {
    this.clear();
    for (const [col, row] of coords) {
      if (col >= 0 && col < this.size && row >= 0 && row < this.size) {
        const idx = this.index(col, row);
        this.cells[idx] = 1;
        this.ages[idx] = 1;
      }
    }
  }

  public getAliveCount(): number {
    let count = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      count += this.cells[i];
    }
    return count;
  }

  public getActiveRowsInColumn(col: number): number[] {
    const rows: number[] = [];
    for (let row = 0; row < this.size; row++) {
      if (this.cells[this.index(col, row)] === 1) {
        rows.push(row);
      }
    }
    return rows;
  }

  public computeHash(): string {
    let hex = '';
    for (let i = 0; i < CELL_COUNT; i += 4) {
      const nibble =
        (this.cells[i] << 3) |
        (this.cells[i + 1] << 2) |
        (this.cells[i + 2] << 1) |
        this.cells[i + 3];
      hex += nibble.toString(16);
    }
    return hex;
  }

  public step(autoHeal: boolean): SporeEvent | null {
    const nextCells = new Uint8Array(CELL_COUNT);
    const nextAges = new Uint8Array(CELL_COUNT);
    const size = this.size;

    for (let row = 0; row < size; row++) {
      const up = (row - 1 + size) % size;
      const down = (row + 1) % size;
      for (let col = 0; col < size; col++) {
        const left = (col - 1 + size) % size;
        const right = (col + 1) % size;

        const neighbors =
          this.cells[up * size + left] +
          this.cells[up * size + col] +
          this.cells[up * size + right] +
          this.cells[row * size + left] +
          this.cells[row * size + right] +
          this.cells[down * size + left] +
          this.cells[down * size + col] +
          this.cells[down * size + right];

        const idx = row * size + col;
        const alive = this.cells[idx] === 1;

        if (alive && (neighbors === 2 || neighbors === 3)) {
          nextCells[idx] = 1;
          nextAges[idx] = Math.min(255, this.ages[idx] + 1);
        } else if (!alive && neighbors === 3) {
          nextCells[idx] = 1;
          nextAges[idx] = 1;
        }
      }
    }

    this.cells = nextCells;
    this.ages = nextAges;
    this.generation += 1;

    if (!autoHeal) {
      return null;
    }

    const aliveCount = this.getAliveCount();
    if (aliveCount === 0) {
      this.recentHashes = [];
      this.stagnantBars = 0;
      return this.injectSpore('extinction');
    }

    const hash = this.computeHash();
    if (this.recentHashes.includes(hash)) {
      this.stagnantBars += 1;
    } else {
      this.stagnantBars = 0;
    }

    this.recentHashes.push(hash);
    if (this.recentHashes.length > 8) {
      this.recentHashes.shift();
    }

    // If stuck in a static shape or short loop for 3 generations, gently introduce a new spore
    if (this.stagnantBars >= 3 || aliveCount > CELL_COUNT * 0.45) {
      this.stagnantBars = 0;
      this.recentHashes = [];
      return this.injectSpore('stagnation');
    }

    return null;
  }

  private injectSpore(reason: 'extinction' | 'stagnation'): SporeEvent {
    const motifs: Array<Array<[number, number]>> = [
      // Glider
      [
        [1, 0],
        [2, 1],
        [0, 2],
        [1, 2],
        [2, 2],
      ],
      // R-pentomino fragment
      [
        [1, 0],
        [2, 0],
        [0, 1],
        [1, 1],
        [1, 2],
      ],
      // Organic tri-cluster
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [2, 2],
      ],
    ];

    const motif = motifs[Math.floor(Math.random() * motifs.length)];
    const originCol = Math.floor(Math.random() * (this.size - 3));
    const originRow = Math.floor(Math.random() * (this.size - 3));

    for (const [dc, dr] of motif) {
      const col = (originCol + dc) % this.size;
      const row = (originRow + dr) % this.size;
      const idx = this.index(col, row);
      this.cells[idx] = 1;
      this.ages[idx] = 1;
    }

    return {
      col: originCol + 1,
      row: originRow + 1,
      reason,
    };
  }
}

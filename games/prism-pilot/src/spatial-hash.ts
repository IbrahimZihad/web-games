export class SpatialHashGrid<T> {
  private readonly cells = new Map<string, Set<T>>();

  constructor(private readonly cellSize = 64) {}

  clear(): void {
    this.cells.clear();
  }

  insert(item: T, x: number, y: number): void {
    const key = this.key(x, y);
    const cell = this.cells.get(key) ?? new Set<T>();
    cell.add(item);
    this.cells.set(key, cell);
  }

  rebuild(items: Iterable<T>, getX: (item: T) => number, getY: (item: T) => number): void {
    this.clear();
    for (const item of items) this.insert(item, getX(item), getY(item));
  }

  query(x: number, y: number, radius = 0): T[] {
    const minX = Math.floor((x - radius) / this.cellSize);
    const maxX = Math.floor((x + radius) / this.cellSize);
    const minY = Math.floor((y - radius) / this.cellSize);
    const maxY = Math.floor((y + radius) / this.cellSize);
    const found = new Set<T>();
    for (let cellY = minY; cellY <= maxY; cellY += 1) {
      for (let cellX = minX; cellX <= maxX; cellX += 1) {
        const cell = this.cells.get(`${cellX},${cellY}`);
        if (!cell) continue;
        for (const item of cell) found.add(item);
      }
    }
    return [...found];
  }

  private key(x: number, y: number): string {
    return `${Math.floor(x / this.cellSize)},${Math.floor(y / this.cellSize)}`;
  }
}

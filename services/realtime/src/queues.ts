export class FifoQueue<T> {
  private items: T[] = [];
  private head = 0;

  enqueue(item: T): void {
    this.items.push(item);
  }

  dequeue(): T | undefined {
    if (this.head >= this.items.length) return undefined;
    const item = this.items[this.head++];
    if (this.head > 64 && this.head * 2 >= this.items.length) {
      this.items = this.items.slice(this.head);
      this.head = 0;
    }
    return item;
  }

  peek(): T | undefined {
    return this.items[this.head];
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    for (let index = this.head; index < this.items.length; index += 1) {
      if (!predicate(this.items[index])) continue;
      const [removed] = this.items.splice(index, 1);
      return removed;
    }
    return undefined;
  }

  clear(): void {
    this.items = [];
    this.head = 0;
  }

  get size(): number {
    return this.items.length - this.head;
  }
}

type Comparator<T> = (left: T, right: T) => number;

export class PriorityQueue<T> {
  private items: T[] = [];

  constructor(private readonly compare: Comparator<T>) {}

  push(item: T): void {
    this.items.push(item);
    this.siftUp(this.items.length - 1);
  }

  pop(): T | undefined {
    if (!this.items.length) return undefined;
    const first = this.items[0];
    const last = this.items.pop();
    if (this.items.length && last !== undefined) {
      this.items[0] = last;
      this.siftDown(0);
    }
    return first;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  values(): T[] {
    return [...this.items];
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.items.findIndex(predicate);
    if (index < 0) return undefined;
    const removed = this.items[index];
    const last = this.items.pop();
    if (index < this.items.length && last !== undefined) {
      this.items[index] = last;
      if (index > 0 && this.compare(this.items[index], this.items[(index - 1) >>> 1]) < 0) this.siftUp(index);
      else this.siftDown(index);
    }
    return removed;
  }

  clear(): void {
    this.items = [];
  }

  get size(): number {
    return this.items.length;
  }

  private siftUp(index: number): void {
    while (index > 0) {
      const parent = (index - 1) >>> 1;
      if (this.compare(this.items[parent], this.items[index]) <= 0) break;
      [this.items[parent], this.items[index]] = [this.items[index], this.items[parent]];
      index = parent;
    }
  }

  private siftDown(index: number): void {
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < this.items.length && this.compare(this.items[left], this.items[smallest]) < 0) smallest = left;
      if (right < this.items.length && this.compare(this.items[right], this.items[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

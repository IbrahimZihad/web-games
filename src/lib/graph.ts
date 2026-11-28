export class RelationshipGraph<T> {
  private readonly adjacency = new Map<T, Set<T>>();

  addVertex(vertex: T): void {
    if (!this.adjacency.has(vertex)) this.adjacency.set(vertex, new Set());
  }

  addEdge(from: T, to: T): void {
    this.addVertex(from);
    this.addVertex(to);
    this.adjacency.get(from)?.add(to);
  }

  neighbors(vertex: T): T[] {
    return [...(this.adjacency.get(vertex) ?? [])];
  }

  distancesFrom(start: T, maxDepth = Number.POSITIVE_INFINITY): Map<T, number> {
    const distances = new Map<T, number>([[start, 0]]);
    const queue: T[] = [start];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      const depth = distances.get(current) ?? 0;
      if (depth >= maxDepth) continue;
      for (const neighbor of this.neighbors(current)) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, depth + 1);
        queue.push(neighbor);
      }
    }
    return distances;
  }

  shortestPath(start: T, goal: T, maxDepth = Number.POSITIVE_INFINITY): T[] | null {
    const previous = new Map<T, T>();
    const distances = new Map<T, number>([[start, 0]]);
    const queue: T[] = [start];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === goal) {
        const path = [goal];
        let cursor = goal;
        while (cursor !== start) {
          const parent = previous.get(cursor);
          if (parent === undefined) return null;
          path.push(parent);
          cursor = parent;
        }
        return path.reverse();
      }
      const depth = distances.get(current) ?? 0;
      if (depth >= maxDepth) continue;
      for (const neighbor of this.neighbors(current)) {
        if (distances.has(neighbor)) continue;
        distances.set(neighbor, depth + 1);
        previous.set(neighbor, current);
        queue.push(neighbor);
      }
    }
    return null;
  }

  get vertexCount(): number {
    return this.adjacency.size;
  }

  get edgeCount(): number {
    let count = 0;
    for (const neighbors of this.adjacency.values()) count += neighbors.size;
    return count;
  }
}

export interface GridPoint {
  x: number;
  y: number;
}

export function findAStarPath(
  start: GridPoint,
  goal: GridPoint,
  width: number,
  height: number,
  isBlocked: (x: number, y: number) => boolean = () => false,
): GridPoint[] | null {
  const key = (point: GridPoint) => `${point.x},${point.y}`;
  const inside = (point: GridPoint) => point.x >= 0 && point.x < width && point.y >= 0 && point.y < height;
  if (!inside(start) || !inside(goal) || isBlocked(start.x, start.y) || isBlocked(goal.x, goal.y)) return null;

  const open: GridPoint[] = [start];
  const openKeys = new Set([key(start)]);
  const closed = new Set<string>();
  const gScore = new Map([[key(start), 0]]);
  const cameFrom = new Map<string, GridPoint>();
  const heuristic = (point: GridPoint) => Math.abs(point.x - goal.x) + Math.abs(point.y - goal.y);

  while (open.length > 0) {
    let bestIndex = 0;
    for (let index = 1; index < open.length; index += 1) {
      const current = open[index];
      const best = open[bestIndex];
      if ((gScore.get(key(current)) ?? 0) + heuristic(current) < (gScore.get(key(best)) ?? 0) + heuristic(best)) bestIndex = index;
    }
    const current = open.splice(bestIndex, 1)[0];
    const currentKey = key(current);
    openKeys.delete(currentKey);
    if (current.x === goal.x && current.y === goal.y) {
      const path = [current];
      let cursor = current;
      while (key(cursor) !== key(start)) {
        const parent = cameFrom.get(key(cursor));
        if (!parent) return null;
        path.push(parent);
        cursor = parent;
      }
      return path.reverse();
    }
    closed.add(currentKey);

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const neighbor of neighbors) {
      if (!inside(neighbor) || isBlocked(neighbor.x, neighbor.y)) continue;
      const neighborKey = key(neighbor);
      if (closed.has(neighborKey)) continue;
      const tentative = (gScore.get(currentKey) ?? 0) + 1;
      if (tentative >= (gScore.get(neighborKey) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighborKey, current);
      gScore.set(neighborKey, tentative);
      if (!openKeys.has(neighborKey)) {
        open.push(neighbor);
        openKeys.add(neighborKey);
      }
    }
  }
  return null;
}

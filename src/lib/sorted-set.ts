export interface SortedSetEntry {
  member: string;
  score: number;
}

export class SortedSet {
  private readonly scores = new Map<string, number>();
  private ordered: string[] = [];

  add(member: string, score: number, onlyIfGreater = false): boolean {
    if (!Number.isFinite(score)) return false;
    const current = this.scores.get(member);
    if (onlyIfGreater && current !== undefined && score <= current) return false;
    if (current !== undefined) {
      const index = this.ordered.indexOf(member);
      if (index >= 0) this.ordered.splice(index, 1);
    }
    this.scores.set(member, score);

    let low = 0;
    let high = this.ordered.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      const candidate = this.ordered[middle];
      const candidateScore = this.scores.get(candidate) ?? 0;
      if (score > candidateScore || (score === candidateScore && member.localeCompare(candidate) < 0)) high = middle;
      else low = middle + 1;
    }
    this.ordered.splice(low, 0, member);
    return true;
  }

  remove(member: string): boolean {
    if (!this.scores.delete(member)) return false;
    const index = this.ordered.indexOf(member);
    if (index >= 0) this.ordered.splice(index, 1);
    return true;
  }

  score(member: string): number | undefined {
    return this.scores.get(member);
  }

  range(start = 0, stop = this.ordered.length - 1): SortedSetEntry[] {
    const normalizedStart = Math.max(0, start);
    const normalizedStop = Math.min(this.ordered.length - 1, stop);
    if (normalizedStart > normalizedStop) return [];
    return this.ordered.slice(normalizedStart, normalizedStop + 1).map((member) => ({
      member,
      score: this.scores.get(member) ?? 0,
    }));
  }

  clear(): void {
    this.scores.clear();
    this.ordered = [];
  }

  get size(): number {
    return this.scores.size;
  }
}

import { FifoQueue, PriorityQueue } from "./queues.js";
import type { RoomRegistry } from "./room-registry.js";

export interface MatchmakingPlayer {
  socketId: string;
  userId: number | null;
  username: string;
  skill: number;
  gameId: number;
  queuedAt: number;
}

export interface MatchmakingMatch {
  roomId: string;
  gameId: number;
  players: [MatchmakingPlayer, MatchmakingPlayer];
}

export interface MatchmakingQueueResult {
  queued: boolean;
  position: number;
  matches: MatchmakingMatch[];
}

export class MatchmakingService {
  private readonly incoming = new FifoQueue<MatchmakingPlayer>();
  private readonly skillQueues = new Map<number, PriorityQueue<MatchmakingPlayer>>();
  private readonly queued = new Set<string>();

  constructor(
    private readonly rooms: RoomRegistry,
    private readonly maxSkillGap = 250,
  ) {}

  enqueue(input: Omit<MatchmakingPlayer, "queuedAt">): MatchmakingQueueResult {
    if (this.queued.has(input.socketId)) {
      return { queued: true, position: this.positionOf(input.socketId), matches: [] };
    }
    const entry = { ...input, queuedAt: Date.now() };
    this.queued.add(entry.socketId);
    this.incoming.enqueue(entry);
    const matches = this.drain();
    return { queued: this.queued.has(entry.socketId), position: this.positionOf(entry.socketId), matches };
  }

  cancel(socketId: string): boolean {
    if (!this.queued.delete(socketId)) return false;
    this.incoming.remove((entry) => entry.socketId === socketId);
    for (const [skill, queue] of this.skillQueues) {
      queue.remove((entry) => entry.socketId === socketId);
      if (queue.size === 0) this.skillQueues.delete(skill);
    }
    return true;
  }

  disconnect(socketId: string): void {
    this.cancel(socketId);
    this.rooms.leave(socketId);
  }

  leaveRoom(socketId: string): string | null {
    return this.rooms.leave(socketId);
  }

  get queueSize(): number {
    return this.queued.size;
  }

  private drain(): MatchmakingMatch[] {
    const matches: MatchmakingMatch[] = [];
    while (this.incoming.size > 0) {
      const entry = this.incoming.dequeue();
      if (!entry) break;
      const queue = this.skillQueues.get(entry.skill) ?? new PriorityQueue<MatchmakingPlayer>(
        (left, right) => left.queuedAt - right.queuedAt || left.socketId.localeCompare(right.socketId),
      );
      queue.push(entry);
      this.skillQueues.set(entry.skill, queue);
      const match = this.findMatch(entry);
      if (match) matches.push(match);
    }
    return matches;
  }

  private findMatch(entry: MatchmakingPlayer): MatchmakingMatch | null {
    let opponent: MatchmakingPlayer | undefined;
    let opponentQueue: PriorityQueue<MatchmakingPlayer> | undefined;
    let smallestGap = Number.POSITIVE_INFINITY;
    for (const [skill, queue] of this.skillQueues) {
      if (Math.abs(skill - entry.skill) > this.maxSkillGap) continue;
      const candidate = queue.peek();
      if (!candidate || candidate.socketId === entry.socketId || candidate.gameId !== entry.gameId) continue;
      const gap = Math.abs(candidate.skill - entry.skill);
      if (gap < smallestGap || (gap === smallestGap && candidate.queuedAt < (opponent?.queuedAt ?? Number.POSITIVE_INFINITY)) {
        opponent = candidate;
        opponentQueue = queue;
        smallestGap = gap;
      }
    }
    if (!opponent || !opponentQueue) return null;

    opponentQueue.pop();
    const entryQueue = this.skillQueues.get(entry.skill);
    entryQueue?.remove((candidate) => candidate.socketId === entry.socketId);
    if (opponentQueue.size === 0) this.skillQueues.delete(opponent.skill);
    if (entryQueue?.size === 0) this.skillQueues.delete(entry.skill);
    this.queued.delete(opponent.socketId);
    this.queued.delete(entry.socketId);

    const room = this.rooms.createRoom(entry.gameId);
    this.rooms.join(opponent.socketId, room.id);
    this.rooms.join(entry.socketId, room.id);
    return { roomId: room.id, gameId: entry.gameId, players: [opponent, entry] };
  }

  private positionOf(socketId: string): number {
    let position = 0;
    let queuedAt = Number.POSITIVE_INFINITY;
    for (const queue of this.skillQueues.values()) {
      for (const entry of queue.values()) {
        if (entry.socketId === socketId) queuedAt = entry.queuedAt;
      }
    }
    if (!Number.isFinite(queuedAt)) return 0;
    for (const queue of this.skillQueues.values()) {
      for (const entry of queue.values()) {
        if (entry.queuedAt < queuedAt) position += 1;
      }
    }
    return position + 1;
  }
}

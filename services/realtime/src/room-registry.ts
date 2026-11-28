export interface RoomRecord {
  id: string;
  gameId: number;
  members: Set<string>;
  createdAt: number;
}

export interface SessionRecord {
  userId: number | null;
  roomId: string | null;
}

export class RoomRegistry {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly onlinePlayers = new Map<number, Set<string>>();
  private roomSequence = 0;

  registerSession(socketId: string, userId: number | null): void {
    const existing = this.sessions.get(socketId);
    if (existing?.userId !== null && existing?.userId !== undefined) {
      this.removeOnlinePlayer(existing.userId, socketId);
    }
    this.sessions.set(socketId, { userId, roomId: existing?.roomId ?? null });
    if (userId !== null) {
      const sockets = this.onlinePlayers.get(userId) ?? new Set<string>();
      sockets.add(socketId);
      this.onlinePlayers.set(userId, sockets);
    }
  }

  unregisterSession(socketId: string): void {
    this.leave(socketId);
    const session = this.sessions.get(socketId);
    if (session?.userId !== null && session?.userId !== undefined) this.removeOnlinePlayer(session.userId, socketId);
    this.sessions.delete(socketId);
  }

  isUserOnline(userId: number): boolean {
    return (this.onlinePlayers.get(userId)?.size ?? 0) > 0;
  }

  createRoom(gameId: number): RoomRecord {
    const id = `match-${gameId}-${++this.roomSequence}-${Date.now().toString(36)}`;
    const room = { id, gameId, members: new Set<string>(), createdAt: Date.now() };
    this.rooms.set(id, room);
    return room;
  }

  join(socketId: string, roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    const session = this.sessions.get(socketId) ?? { userId: null, roomId: null };
    if (session.roomId === roomId) return true;
    if (session.roomId) this.leave(socketId);
    room.members.add(socketId);
    this.sessions.set(socketId, { ...session, roomId });
    return true;
  }

  leave(socketId: string): string | null {
    const session = this.sessions.get(socketId);
    if (!session?.roomId) return null;
    const roomId = session.roomId;
    const room = this.rooms.get(roomId);
    room?.members.delete(socketId);
    if (room && room.members.size === 0) this.rooms.delete(roomId);
    this.sessions.set(socketId, { ...session, roomId: null });
    return roomId;
  }

  getSession(socketId: string): SessionRecord | undefined {
    return this.sessions.get(socketId);
  }

  getRoom(roomId: string): RoomRecord | undefined {
    return this.rooms.get(roomId);
  }

  get roomCount(): number {
    return this.rooms.size;
  }

  get sessionCount(): number {
    return this.sessions.size;
  }

  get onlinePlayerCount(): number {
    return this.onlinePlayers.size;
  }

  private removeOnlinePlayer(userId: number, socketId: string): void {
    const sockets = this.onlinePlayers.get(userId);
    if (!sockets) return;
    sockets.delete(socketId);
    if (sockets.size === 0) this.onlinePlayers.delete(userId);
  }
}

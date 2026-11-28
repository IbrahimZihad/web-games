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
  private roomSequence = 0;

  registerSession(socketId: string, userId: number | null): void {
    if (!this.sessions.has(socketId)) this.sessions.set(socketId, { userId, roomId: null });
  }

  unregisterSession(socketId: string): void {
    this.leave(socketId);
    this.sessions.delete(socketId);
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
}

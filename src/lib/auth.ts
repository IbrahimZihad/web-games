import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, sessionCookie, verifySessionToken } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(sessionCookie.name)?.value;
  if (!token) return null;

  const session = await verifySessionToken(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, email: true, avatarUrl: true, role: true, isActive: true },
  });

  if (!user?.isActive || user.role !== session.role) return null;
  return { id: user.id, username: user.username, email: user.email, avatarUrl: user.avatarUrl, role: user.role };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in to continue.");
  return user;
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Please sign in to continue.");
  if (user.role !== "ADMIN") throw new AuthError("Administrator access required.", 403);
  return user;
}

export async function setSession(user: SessionUser) {
  const token = await createSessionToken({ sub: String(user.id), username: user.username, role: user.role });
  (await cookies()).set(sessionCookie.name, token, sessionCookie.options);
}

export async function clearSession() {
  (await cookies()).delete(sessionCookie.name);
}

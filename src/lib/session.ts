import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "portal_session";
const MAX_AGE = 60 * 60 * 24 * 7;

export interface TokenPayload {
  sub: string;
  username: string;
  role: "PLAYER" | "ADMIN";
}

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: TokenPayload) {
  return new SignJWT({ username: payload.username, role: payload.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey());
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
  if (!payload.sub || (payload.role !== "PLAYER" && payload.role !== "ADMIN")) {
    return null;
  }
  return {
    userId: Number(payload.sub),
    username: String(payload.username || "Player"),
    role: payload.role,
  } as const;
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: MAX_AGE,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  },
};

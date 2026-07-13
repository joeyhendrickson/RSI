import { createHmac, timingSafeEqual } from "crypto";

export const AUTH_COOKIE_NAME = "rsi_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function authSecret(): string {
  return process.env.NEXTAUTH_SECRET ?? "";
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

function loadAuthUsers(): Map<string, string> {
  const users = new Map<string, string>();

  const primaryUsername = process.env.AUTH_USERNAME?.trim();
  const primaryPassword = process.env.AUTH_PASSWORD ?? "";
  if (primaryUsername && primaryPassword) {
    users.set(primaryUsername, primaryPassword);
  }

  const extraUsers = process.env.AUTH_USERS?.trim();
  if (extraUsers) {
    for (const entry of extraUsers.split(",")) {
      const colon = entry.indexOf(":");
      if (colon <= 0) continue;
      const username = entry.slice(0, colon).trim();
      const password = entry.slice(colon + 1);
      if (username && password) {
        users.set(username, password);
      }
    }
  }

  return users;
}

export function verifyCredentials(username: string, password: string): boolean {
  const expectedPassword = loadAuthUsers().get(username);
  if (!expectedPassword) {
    return false;
  }

  return safeEqual(password, expectedPassword);
}

export function createSessionToken(username: string): string | null {
  const secret = authSecret();
  if (!secret) {
    return null;
  }

  const payload = JSON.stringify({
    u: username,
    exp: Date.now() + SESSION_MS,
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

export function isSessionValid(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  const secret = authSecret();
  if (!secret) {
    return false;
  }

  const [payloadB64, signature] = token.split(".");
  if (!payloadB64 || !signature) {
    return false;
  }

  const expectedSignature = createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { u?: string; exp?: number };

    return typeof payload.exp === "number" && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MS / 1000,
  };
}

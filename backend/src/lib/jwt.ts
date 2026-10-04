import jwt from "jsonwebtoken";
import { env } from "../config/env";

// Identity only. Roles and ownership are looked up fresh on each request
// (see lib/authAccount.ts) so they can't go stale inside a long-lived token.
export interface AuthTokenPayload {
  sub: string;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  return jwt.verify(token, env.JWT_SECRET) as AuthTokenPayload;
}

export const AUTH_COOKIE_NAME = "cimun_token";

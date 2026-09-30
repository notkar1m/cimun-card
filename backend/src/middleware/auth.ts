import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/ApiError";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "../lib/jwt";

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    throw new ApiError(401, "UNAUTHENTICATED", "Not logged in");
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.sub, roles: payload.roles, isOwner: payload.isOwner };
    next();
  } catch {
    throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired session");
  }
}

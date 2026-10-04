import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/ApiError";
import { getAuthAccount } from "../lib/authAccount";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "../lib/jwt";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token) {
      throw new ApiError(401, "UNAUTHENTICATED", "Not logged in");
    }

    let accountId: string;
    try {
      accountId = verifyAuthToken(token).sub;
    } catch {
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired session");
    }

    const account = await getAuthAccount(accountId);
    if (!account) {
      throw new ApiError(401, "UNAUTHENTICATED", "Invalid or expired session");
    }

    req.user = { id: account.id, roles: account.roles, isOwner: account.isOwner };
    next();
  } catch (err) {
    next(err);
  }
}

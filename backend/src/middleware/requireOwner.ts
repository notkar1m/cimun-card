import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../lib/ApiError";

// Gates the handful of routes that manage OTHER admin accounts. Every admin
// shares the same access to the app itself (requireRole("SUPERADMIN") is
// enough for that); this is the narrower check for the one admin allowed to
// create or remove the others.
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.isOwner) {
    throw new ApiError(403, "FORBIDDEN", "Only the account owner can manage other admins");
  }
  next();
}

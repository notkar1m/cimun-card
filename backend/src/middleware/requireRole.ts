import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { ApiError } from "../lib/ApiError";

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.some((role) => req.user!.roles.includes(role))) {
      throw new ApiError(403, "FORBIDDEN", "You do not have access to this resource");
    }
    next();
  };
}

import type { Role } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        roles: Role[];
        isOwner: boolean;
      };
    }
  }
}

export {};

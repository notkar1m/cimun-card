import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { AUTH_COOKIE_NAME, signAuthToken } from "../../lib/jwt";
import { env } from "../../config/env";
import * as authService from "./auth.service";
import { getAccountById } from "./auth.service";

const router = Router();

// Keyed by the account being targeted, not the caller's IP. Conference
// venue wifi routinely NATs a few thousand devices behind one or two
// public IPs — an IP-keyed limiter would let the first ~20 logins of the
// event lock out everyone else behind the same gateway, on their very
// first attempt, regardless of which account they're using. Keying by the
// submitted identifier instead means the limit is "20 attempts against
// this one account," which is the actual brute-force protection intended,
// and doesn't care how many *different* people share a network.
function accountKey(req: import("express").Request): string {
  const body = req.body as { identifier?: unknown; email?: unknown } | undefined;
  const raw = body?.identifier ?? body?.email;
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().toLowerCase();
  }
  // No identifier to key on (malformed request) — fall back to IP so this
  // can't be bypassed by omitting the field.
  return req.ip ?? "unknown";
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: accountKey,
});

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function setAuthCookie(res: import("express").Response, token: string) {
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
  });
}

function serializeAccount(account: {
  id: string;
  email: string | null;
  loginId: string | null;
  name: string;
  phone: string | null;
  roles: string[];
  isOwner: boolean;
  mustChangePassword: boolean;
}) {
  return {
    id: account.id,
    email: account.email,
    loginId: account.loginId,
    name: account.name,
    phone: account.phone,
    roles: account.roles,
    isOwner: account.isOwner,
    mustChangePassword: account.mustChangePassword,
  };
}

const loginSchema = z.object({
  // Admins send their email here; delegates send their 4-digit ID. One
  // field, since the service layer already looks up either.
  identifier: z.string().min(1),
  password: z.string().min(1),
  expectedRole: z.enum(["SUPERADMIN", "USER"]).optional(),
});

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { identifier, password, expectedRole } = loginSchema.parse(req.body);
    const account = await authService.login(identifier, password, expectedRole);

    const token = signAuthToken({ sub: account.id, roles: account.roles, isOwner: account.isOwner });
    setAuthCookie(res, token);

    res.json({ user: serializeAccount(account) });
  })
);

router.post("/logout", (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
  res.status(204).send();
});

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const account = await getAccountById(req.user!.id);
    res.json({ user: serializeAccount(account) });
  })
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
  name: z.string().trim().min(1).max(100).optional(),
});

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, name } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, currentPassword, newPassword, { name });
    res.status(204).send();
  })
);

export default router;

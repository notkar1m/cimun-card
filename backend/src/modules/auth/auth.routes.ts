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

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
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
  email: string;
  name: string;
  phone: string | null;
  roles: string[];
  isOwner: boolean;
  mustChangePassword: boolean;
}) {
  return {
    id: account.id,
    email: account.email,
    name: account.name,
    phone: account.phone,
    roles: account.roles,
    isOwner: account.isOwner,
    mustChangePassword: account.mustChangePassword,
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  expectedRole: z.enum(["SUPERADMIN", "USER"]).optional(),
});

router.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, expectedRole } = loginSchema.parse(req.body);
    const account = await authService.login(email, password, expectedRole);

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
  phone: z.string().trim().min(1).max(30).optional(),
});

router.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, name, phone } = changePasswordSchema.parse(req.body);
    await authService.changePassword(req.user!.id, currentPassword, newPassword, { name, phone });
    res.status(204).send();
  })
);

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

router.post(
  "/forgot-password",
  forgotPasswordLimiter,
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    await authService.requestPasswordReset(email);
    // Always return success, whether or not the account exists.
    res.status(204).send();
  })
);

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8),
});

router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);
    await authService.resetPassword(token, newPassword);
    res.status(204).send();
  })
);

export default router;

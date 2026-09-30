import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { generateResetToken, hashResetToken } from "../../lib/resetToken";
import { sendPasswordResetEmail } from "../../lib/mailer";
import { env } from "../../config/env";
import { ApiError } from "../../lib/ApiError";

// Admins log in with email; delegates log in with their 4-digit ID.
// Accepting either through one field keeps this working for delegate
// accounts created before the ID scheme existed (they still have an
// email and no loginId).
export async function login(identifier: string, password: string, expectedRole?: Role) {
  const account = await prisma.account.findFirst({
    where: { OR: [{ email: identifier }, { loginId: identifier }] },
  });

  if (!account) {
    // still run a hash comparison to keep response timing consistent
    await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid login or password");
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid login or password");
  }

  if (expectedRole && !account.roles.includes(expectedRole)) {
    throw new ApiError(
      403,
      "WRONG_LOGIN_PAGE",
      "This account isn't registered for this login page"
    );
  }

  return account;
}

export async function getAccountById(id: string) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) {
    throw new ApiError(404, "NOT_FOUND", "Account not found");
  }
  return account;
}

export async function changePassword(
  accountId: string,
  currentPassword: string,
  newPassword: string,
  profile?: { name?: string }
) {
  const account = await getAccountById(accountId);

  const valid = await verifyPassword(currentPassword, account.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
  }

  // Defensive fallback for any legacy account that predates name being a
  // required field at signup — not a path any current creation flow leaves
  // an account in.
  const name = profile?.name?.trim();
  if (!account.name && !name) {
    throw new ApiError(400, "NAME_REQUIRED", "Your name is required");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.account.update({
    where: { id: accountId },
    data: {
      passwordHash,
      mustChangePassword: false,
      ...(name ? { name } : {}),
    },
  });
}

export async function requestPasswordReset(email: string) {
  const account = await prisma.account.findUnique({ where: { email } });

  // Always behave the same whether or not the account exists, to avoid
  // account enumeration. An ID-based delegate (no email on file) can't be
  // found by this lookup at all, so they fall into the same no-op — which
  // is correct, since there's nowhere to send a reset link. They (or their
  // admin) use the Reset password action on the Users page instead.
  if (!account) {
    return;
  }

  const { token, tokenHash, expiresAt } = generateResetToken();

  await prisma.account.update({
    where: { id: account.id },
    data: { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
  });

  const resetUrl = `${env.APP_URL}/reset-password?token=${token}`;
  try {
    // Guaranteed non-null: this account was only found via findUnique on a
    // literal email string, which can never match a NULL column.
    await sendPasswordResetEmail(account.email!, resetUrl);
  } catch (err) {
    // Don't let a mail delivery failure leak whether the account exists via a differing response.
    console.error("Failed to send password reset email:", err);
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashResetToken(token);

  const account = await prisma.account.findFirst({
    where: { resetTokenHash: tokenHash },
  });

  if (!account || !account.resetTokenExpiresAt || account.resetTokenExpiresAt < new Date()) {
    throw new ApiError(400, "INVALID_TOKEN", "This reset link is invalid or has expired");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.account.update({
    where: { id: account.id },
    data: {
      passwordHash,
      // A legacy account with a blank name still needs to provide one —
      // that only happens on the forced ChangePasswordPage stop, so
      // resetting the password alone can't be the thing that lets this
      // requirement slip through.
      mustChangePassword: !account.name,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
}

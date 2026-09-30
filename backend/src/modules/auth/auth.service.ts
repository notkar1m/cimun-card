import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
import { generateResetToken, hashResetToken } from "../../lib/resetToken";
import { sendPasswordResetEmail } from "../../lib/mailer";
import { env } from "../../config/env";
import { ApiError } from "../../lib/ApiError";

export async function login(email: string, password: string, expectedRole?: Role) {
  const account = await prisma.account.findUnique({ where: { email } });

  if (!account) {
    // still run a hash comparison to keep response timing consistent
    await verifyPassword(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const valid = await verifyPassword(password, account.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
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
  profile?: { name?: string; phone?: string }
) {
  const account = await getAccountById(accountId);

  const valid = await verifyPassword(currentPassword, account.passwordHash);
  if (!valid) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
  }

  // A CSV-imported delegate can have a blank name/phone (filled in by an
  // admin who didn't have it yet); collect it here, on the one screen we
  // know they can't get past without completing. Enforced server-side too,
  // not just as a frontend nicety — this is required, not optional, once an
  // account is missing either field.
  const name = profile?.name?.trim();
  const phone = profile?.phone?.trim();
  if (!account.name && !name) {
    throw new ApiError(400, "NAME_REQUIRED", "Your name is required");
  }
  if (!account.phone && !phone) {
    throw new ApiError(400, "PHONE_REQUIRED", "Your phone number is required");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.account.update({
    where: { id: accountId },
    data: {
      passwordHash,
      mustChangePassword: false,
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
    },
  });
}

export async function requestPasswordReset(email: string) {
  const account = await prisma.account.findUnique({ where: { email } });

  // Always behave the same whether or not the account exists, to avoid account enumeration.
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
    await sendPasswordResetEmail(account.email, resetUrl);
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
      // A CSV-imported delegate with a blank name/phone still needs to
      // provide them — that only happens on the forced ChangePasswordPage
      // stop, so resetting the password alone can't be the thing that lets
      // this requirement slip through. If the profile's already complete,
      // this clears normally and they go straight to the app next login.
      mustChangePassword: !account.name || !account.phone,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    },
  });
}

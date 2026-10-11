import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword, verifyPassword } from "../../lib/password";
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
  currentPassword: string | undefined,
  newPassword: string,
  profile?: { name?: string }
) {
  const account = await getAccountById(accountId);

  if (account.mustChangePassword) {
    // First login: they just typed the temporary password to get in, so don't ask again.
    // It's derived from their name and ID, so it can't also be the one they keep.
    if (await verifyPassword(newPassword, account.passwordHash)) {
      throw new ApiError(400, "PASSWORD_UNCHANGED", "Choose a password different from your temporary one");
    }
  } else {
    if (!currentPassword) {
      throw new ApiError(400, "CURRENT_PASSWORD_REQUIRED", "Your current password is required");
    }
    const valid = await verifyPassword(currentPassword, account.passwordHash);
    if (!valid) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Current password is incorrect");
    }
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

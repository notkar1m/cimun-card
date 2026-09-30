import type { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { generateTempPassword, hashPassword } from "../../lib/password";
import { sendTempPasswordEmail } from "../../lib/mailer";
import { ApiError } from "../../lib/ApiError";

export async function listAdmins() {
  return prisma.account.findMany({
    where: { roles: { has: "SUPERADMIN" } },
    select: {
      id: true,
      email: true,
      name: true,
      roles: true,
      isOwner: true,
      mustChangePassword: true,
      createdAt: true,
    },
    // The owner always reads first, then newest-added.
    orderBy: [{ isOwner: "desc" }, { createdAt: "asc" }],
  });
}

export interface CreateAdminResult {
  account: { id: string; email: string | null; name: string; roles: Role[]; isOwner: boolean };
  // true when this added the SUPERADMIN role to an existing delegate
  // account rather than creating a brand new one.
  upgradedExisting: boolean;
}

export async function createAdmin(input: {
  email: string;
  name: string;
  alsoDelegate: boolean;
}): Promise<CreateAdminResult> {
  const existing = await prisma.account.findUnique({ where: { email: input.email } });

  if (existing) {
    if (existing.roles.includes("SUPERADMIN")) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email is already an admin");
    }
    // An existing delegate account: promote it in place instead of
    // rejecting outright, so "also a delegate" can point at the person's
    // real, already-used account rather than forcing a second one.
    const account = await prisma.account.update({
      where: { id: existing.id },
      data: { roles: { push: "SUPERADMIN" } },
      select: { id: true, email: true, name: true, roles: true, isOwner: true },
    });
    return { account, upgradedExisting: true };
  }

  const roles: Role[] = input.alsoDelegate ? ["SUPERADMIN", "USER"] : ["SUPERADMIN"];
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const account = await prisma.account.create({
    data: {
      email: input.email,
      name: input.name,
      passwordHash,
      roles,
      mustChangePassword: true,
    },
    select: { id: true, email: true, name: true, roles: true, isOwner: true },
  });

  try {
    // input.email, not account.email: admins always have one (required at
    // creation), but Prisma's Account type reflects the column being
    // nullable for delegates, so this is the non-null value we already have.
    await sendTempPasswordEmail(input.email, tempPassword);
  } catch (err) {
    console.error("Failed to send temp password email:", err);
    throw new ApiError(
      502,
      "EMAIL_FAILED",
      "Account was created, but the welcome email could not be sent. Verify SMTP settings."
    );
  }

  return { account, upgradedExisting: false };
}

export async function deleteAdmin(id: string, requesterId: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: { _count: { select: { activations: true } } },
  });

  if (!account || !account.roles.includes("SUPERADMIN")) {
    throw new ApiError(404, "NOT_FOUND", "Admin not found");
  }
  if (account.id === requesterId) {
    throw new ApiError(400, "CANNOT_DELETE_SELF", "You can't remove your own account");
  }
  if (account.isOwner) {
    throw new ApiError(403, "CANNOT_DELETE_OWNER", "The account owner can't be removed");
  }
  // Only relevant for an admin who's also a delegate with activation
  // history — same constraint the delegate-management side enforces.
  if (account._count.activations > 0) {
    throw new ApiError(
      409,
      "USER_HAS_HISTORY",
      "This admin also has delegate activation history and can't be removed."
    );
  }

  await prisma.account.delete({ where: { id } });
}

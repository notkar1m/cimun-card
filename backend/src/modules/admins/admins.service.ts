import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/ApiError";
import { invalidateAuthAccount } from "../../lib/authAccount";

export async function listAdmins() {
  return prisma.account.findMany({
    where: { roles: { has: "SUPERADMIN" } },
    select: {
      id: true,
      email: true,
      loginId: true,
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

// Every admin except the owner is promoted from an existing 4-digit-code
// user rather than created fresh — there's no separate "admin-only"
// account shape anymore. Promoting in place keeps their existing password
// and activation history untouched; they just gain admin-panel access on
// top of being a regular user.
export async function promoteToAdmin(loginId: string) {
  const existing = await prisma.account.findUnique({ where: { loginId } });
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "No user with that ID — add them as a user first");
  }
  if (existing.roles.includes("SUPERADMIN")) {
    throw new ApiError(409, "ALREADY_ADMIN", "This user is already an admin");
  }

  const account = await prisma.account.update({
    where: { id: existing.id },
    data: { roles: { push: "SUPERADMIN" } },
    select: { id: true, loginId: true, name: true, roles: true, isOwner: true },
  });
  invalidateAuthAccount(account.id);
  return account;
}

// Revokes admin-panel access only — the account stays a regular user with
// its login ID, password, and activation history intact. Deleting it
// outright would also be deleting someone's delegate account.
export async function demoteAdmin(id: string, requesterId: string) {
  const account = await prisma.account.findUnique({ where: { id } });

  if (!account || !account.roles.includes("SUPERADMIN")) {
    throw new ApiError(404, "NOT_FOUND", "Admin not found");
  }
  if (account.id === requesterId) {
    throw new ApiError(400, "CANNOT_REMOVE_SELF", "You can't remove your own admin access");
  }
  if (account.isOwner) {
    throw new ApiError(403, "CANNOT_REMOVE_OWNER", "The account owner can't be removed");
  }

  await prisma.account.update({
    where: { id },
    data: { roles: { set: account.roles.filter((role) => role !== "SUPERADMIN") } },
  });
  invalidateAuthAccount(id);
}

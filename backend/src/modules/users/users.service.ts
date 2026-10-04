import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/password";
import { ApiError } from "../../lib/ApiError";
import { invalidateAuthAccount } from "../../lib/authAccount";
import { parseCsv } from "../../lib/csv";

const LOGIN_ID_PATTERN = /^\d{4}$/;

// The temp password a delegate logs in with the first time: their name and
// ID, squashed together lowercase with no spaces (e.g. "Karim Hany" + 9938
// -> "karimhany9938") — easy to type on a phone, no shift key or spacebar
// guessing. Deterministic on purpose — there's no email to deliver it
// through, so the admin (and the delegate, who already knows both pieces)
// can always reconstruct it without needing it stored or emailed anywhere.
function tempPasswordFor(name: string, loginId: string): string {
  return `${name.replace(/\s+/g, "").toLowerCase()}${loginId}`;
}

export async function listUsers() {
  const users = await prisma.account.findMany({
    where: { roles: { has: "USER" } },
    select: {
      id: true,
      loginId: true,
      email: true,
      name: true,
      phone: true,
      roles: true,
      mustChangePassword: true,
      createdAt: true,
      _count: { select: { activations: { where: { status: "REDEEMED" } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return users.map(({ _count, ...user }) => ({ ...user, totalRedemptions: _count.activations }));
}

export interface UserRedemptions {
  user: { id: string; name: string; loginId: string | null };
  total: number;
  // Only offers this user has actually redeemed, most-redeemed first.
  byOffer: { offerId: string; title: string; vendorName: string; count: number }[];
  // Newest first.
  history: { id: string; offerId: string; offerTitle: string; vendorName: string; redeemedAt: Date }[];
}

export async function getUserRedemptions(id: string): Promise<UserRedemptions> {
  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, name: true, loginId: true, roles: true },
  });
  if (!account || !account.roles.includes("USER")) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  const activations = await prisma.activation.findMany({
    where: { userId: id, status: "REDEEMED" },
    select: {
      id: true,
      activatedAt: true,
      redeemedAt: true,
      offer: { select: { id: true, title: true, vendorName: true } },
    },
    orderBy: { activatedAt: "desc" },
  });

  const history = activations.map((a) => ({
    id: a.id,
    offerId: a.offer.id,
    offerTitle: a.offer.title,
    vendorName: a.offer.vendorName,
    redeemedAt: a.redeemedAt ?? a.activatedAt,
  }));

  const byOfferMap = new Map<string, UserRedemptions["byOffer"][number]>();
  for (const h of history) {
    const entry = byOfferMap.get(h.offerId);
    if (entry) {
      entry.count += 1;
    } else {
      byOfferMap.set(h.offerId, { offerId: h.offerId, title: h.offerTitle, vendorName: h.vendorName, count: 1 });
    }
  }
  const byOffer = [...byOfferMap.values()].sort(
    (a, b) => b.count - a.count || a.title.localeCompare(b.title)
  );

  return {
    user: { id: account.id, name: account.name, loginId: account.loginId },
    total: history.length,
    byOffer,
    history,
  };
}

export async function createUser(input: { name: string; loginId: string }) {
  const existing = await prisma.account.findUnique({ where: { loginId: input.loginId } });
  if (existing) {
    throw new ApiError(409, "ID_TAKEN", "An account with this ID already exists");
  }

  const tempPassword = tempPasswordFor(input.name, input.loginId);
  const passwordHash = await hashPassword(tempPassword);

  const account = await prisma.account.create({
    data: {
      loginId: input.loginId,
      name: input.name,
      passwordHash,
      roles: ["USER"],
      mustChangePassword: true,
    },
    select: { id: true, loginId: true, name: true },
  });

  return { ...account, tempPassword };
}

export interface BulkImportUserRowError {
  row: number;
  message: string;
}

export interface BulkImportUserRowResult {
  row: number;
  name: string;
  loginId: string;
  tempPassword: string;
}

export interface BulkImportUsersResult {
  created: number;
  resolved: BulkImportUserRowResult[];
  errors: BulkImportUserRowError[];
}

// Mirrors the offers bulk-import: create as many rows as possible and
// report the rest as per-row errors, rather than failing the whole file
// over one bad row. There's no email to send — every created row's temp
// password comes back in the response, since that's the only place an
// admin can see it.
export async function bulkImportUsers(csvText: string): Promise<BulkImportUsersResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new ApiError(400, "EMPTY_CSV", "The CSV file is empty");
  }

  // A header row ("name,id" / "name,loginId" / ...) won't have a 4-digit
  // second cell; a real data row always does.
  const firstRowSecondCell = (rows[0]?.[1] ?? "").trim();
  const hasHeader = !LOGIN_ID_PATTERN.test(firstRowSecondCell);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const errors: BulkImportUserRowError[] = [];
  const resolved: BulkImportUserRowResult[] = [];
  const seenInFile = new Set<string>();

  for (const [idx, cols] of dataRows.entries()) {
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const [nameRaw, loginIdRaw] = cols;
    const name = nameRaw?.trim() ?? "";
    const loginId = loginIdRaw?.trim() ?? "";

    if (!name) {
      errors.push({ row: rowNumber, message: "Name is required" });
      continue;
    }
    if (!LOGIN_ID_PATTERN.test(loginId)) {
      errors.push({ row: rowNumber, message: `"${loginId}" isn't a 4-digit ID` });
      continue;
    }
    if (seenInFile.has(loginId)) {
      errors.push({ row: rowNumber, message: `ID ${loginId} appears more than once in this file` });
      continue;
    }
    seenInFile.add(loginId);

    const existing = await prisma.account.findUnique({ where: { loginId } });
    if (existing) {
      errors.push({ row: rowNumber, message: `An account with ID ${loginId} already exists` });
      continue;
    }

    const tempPassword = tempPasswordFor(name, loginId);
    const passwordHash = await hashPassword(tempPassword);

    await prisma.account.create({
      data: {
        loginId,
        name,
        passwordHash,
        roles: ["USER"],
        mustChangePassword: true,
      },
    });

    resolved.push({ row: rowNumber, name, loginId, tempPassword });
  }

  return { created: resolved.length, resolved, errors };
}

export async function deleteUser(id: string) {
  const account = await prisma.account.findUnique({
    where: { id },
    include: { _count: { select: { activations: true } } },
  });

  if (!account || !account.roles.includes("USER")) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  // This is the delegate-management surface: deleting here removes the
  // whole account, which would also wipe an admin's access. Send that case
  // to the Admins page instead, where it's handled deliberately.
  if (account.roles.includes("SUPERADMIN")) {
    throw new ApiError(
      409,
      "ALSO_ADMIN",
      "This account is also an admin — remove it from the Admins page instead."
    );
  }

  if (account._count.activations > 0) {
    throw new ApiError(
      409,
      "USER_HAS_HISTORY",
      "This user has activation history and can't be deleted."
    );
  }

  await prisma.account.delete({ where: { id } });
  invalidateAuthAccount(id);
}

export async function updateUser(
  id: string,
  input: { phone?: string; loginId?: string; name?: string }
) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || !account.roles.includes("USER")) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  if (input.loginId) {
    const existing = await prisma.account.findUnique({ where: { loginId: input.loginId } });
    if (existing && existing.id !== id) {
      throw new ApiError(409, "ID_TAKEN", "An account with this ID already exists");
    }
  }

  return prisma.account.update({
    where: { id },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.loginId ? { loginId: input.loginId } : {}),
      ...(input.name ? { name: input.name } : {}),
    },
    select: { id: true, loginId: true, name: true, phone: true },
  });
}

// Every user now logs in with their 4-digit ID, so resetting a password
// always means regenerating the deterministic name+ID temp password and
// showing it on screen — there's no email to send it to.
export async function resetUserPassword(id: string): Promise<{ tempPassword: string }> {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || !account.roles.includes("USER")) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }
  if (!account.loginId) {
    throw new ApiError(400, "NO_LOGIN_METHOD", "This account has no ID to reset a password for.");
  }

  const tempPassword = tempPasswordFor(account.name, account.loginId);
  const passwordHash = await hashPassword(tempPassword);
  await prisma.account.update({
    where: { id },
    data: { passwordHash, mustChangePassword: true },
  });

  return { tempPassword };
}

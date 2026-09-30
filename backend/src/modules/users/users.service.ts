import { prisma } from "../../lib/prisma";
import { generateTempPassword, hashPassword } from "../../lib/password";
import { sendTempPasswordEmail } from "../../lib/mailer";
import { ApiError } from "../../lib/ApiError";
import { parseCsv } from "../../lib/csv";

const LOGIN_ID_PATTERN = /^\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  return prisma.account.findMany({
    where: { roles: { has: "USER" } },
    select: {
      id: true,
      loginId: true,
      email: true,
      name: true,
      phone: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
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
// over one bad row. Unlike that one, there's no email to send — every
// created row's temp password comes back in the response, since that's
// the only place an admin can see it.
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

// "Team members": same USER role and access as a delegate (they redeem
// offers, nothing more), but they log in with their email instead of a
// 4-digit ID, and get a random temp password emailed to them the old way —
// for staff who already have a work email rather than a badge number.
// Name is left blank; they're asked for it on first login, same as any
// other account missing one (see changePassword).
export async function createTeamMember(email: string) {
  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const account = await prisma.account.create({
    data: {
      email,
      name: "",
      passwordHash,
      roles: ["USER"],
      mustChangePassword: true,
    },
    select: { id: true, email: true },
  });

  try {
    await sendTempPasswordEmail(email, tempPassword);
  } catch (err) {
    console.error("Failed to send temp password email:", err);
    throw new ApiError(
      502,
      "EMAIL_FAILED",
      "Account was created, but the welcome email could not be sent. Verify SMTP settings."
    );
  }

  return account;
}

export interface BulkImportTeamRowError {
  row: number;
  message: string;
}

export interface BulkImportTeamResult {
  created: number;
  errors: BulkImportTeamRowError[];
}

// One email per row (optional header). Unlike the ID-based bulk import,
// there's nothing to show on screen afterward — every created account's
// temp password goes straight to their inbox, same as it always did.
export async function bulkImportTeamMembers(csvText: string): Promise<BulkImportTeamResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new ApiError(400, "EMPTY_CSV", "The CSV file is empty");
  }

  const firstCell = (rows[0]?.[0] ?? "").trim();
  const hasHeader = !EMAIL_PATTERN.test(firstCell);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const errors: BulkImportTeamRowError[] = [];
  let created = 0;
  const seenInFile = new Set<string>();

  for (const [idx, cols] of dataRows.entries()) {
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const email = (cols[0] ?? "").trim();

    if (!email) {
      errors.push({ row: rowNumber, message: "Email is required" });
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      errors.push({ row: rowNumber, message: `"${email}" doesn't look like a valid email` });
      continue;
    }
    if (seenInFile.has(email.toLowerCase())) {
      errors.push({ row: rowNumber, message: `${email} appears more than once in this file` });
      continue;
    }
    seenInFile.add(email.toLowerCase());

    const existing = await prisma.account.findUnique({ where: { email } });
    if (existing) {
      errors.push({ row: rowNumber, message: `An account with email ${email} already exists` });
      continue;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const account = await prisma.account.create({
      data: {
        email,
        name: "",
        passwordHash,
        roles: ["USER"],
        mustChangePassword: true,
      },
    });

    try {
      await sendTempPasswordEmail(account.email!, tempPassword);
      created++;
    } catch (err) {
      console.error("Failed to send temp password email:", err);
      // The account exists, so don't count this as a failed row, but do
      // let the admin know this person has no way to log in yet.
      errors.push({ row: rowNumber, message: `${email} was created, but the welcome email failed to send` });
      created++;
    }
  }

  return { created, errors };
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

export interface ResetPasswordResult {
  // Present when the account has no email and the new temp password has
  // to be shown on screen (nowhere else to deliver it). Absent when it was
  // emailed instead — nothing to display, it's already in their inbox.
  tempPassword?: string;
  emailed: boolean;
}

// An ID-based delegate has no email to send a reset link to, so this
// regenerates their deterministic name+ID temp password and shows it on
// screen. A team member has an email on file, so this generates a fresh
// random one and emails it instead — same delivery as account creation.
export async function resetUserPassword(id: string): Promise<ResetPasswordResult> {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || !account.roles.includes("USER")) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  if (account.loginId) {
    const tempPassword = tempPasswordFor(account.name, account.loginId);
    const passwordHash = await hashPassword(tempPassword);
    await prisma.account.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    return { tempPassword, emailed: false };
  }

  if (account.email) {
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);
    await prisma.account.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    try {
      await sendTempPasswordEmail(account.email, tempPassword);
    } catch (err) {
      console.error("Failed to send password reset email:", err);
      throw new ApiError(
        502,
        "EMAIL_FAILED",
        "Password was reset, but the email could not be sent. Verify SMTP settings."
      );
    }
    return { emailed: true };
  }

  throw new ApiError(
    400,
    "NO_LOGIN_METHOD",
    "This account has neither an ID nor an email to reset a password for."
  );
}

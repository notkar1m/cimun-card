import { prisma } from "../../lib/prisma";
import { generateTempPassword, hashPassword } from "../../lib/password";
import { sendTempPasswordEmail } from "../../lib/mailer";
import { ApiError } from "../../lib/ApiError";
import { parseCsv } from "../../lib/csv";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// "0" is the CSV convention for "leave this blank" — spreadsheet tools
// often refuse to leave a cell truly empty when other rows in the column
// have values, so this gives admins an explicit way to say "not provided."
function isBlank(value: string | undefined): boolean {
  const trimmed = (value ?? "").trim();
  return trimmed === "" || trimmed === "0";
}

export async function listUsers() {
  return prisma.account.findMany({
    where: { roles: { has: "USER" } },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      mustChangePassword: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createUser(input: { email: string; name: string; phone: string }) {
  const existing = await prisma.account.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const account = await prisma.account.create({
    data: {
      email: input.email,
      name: input.name,
      phone: input.phone,
      passwordHash,
      roles: ["USER"],
      mustChangePassword: true,
    },
    select: { id: true, email: true, name: true, phone: true },
  });

  try {
    await sendTempPasswordEmail(account.email, tempPassword);
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

export interface BulkImportUserRowError {
  row: number;
  message: string;
}

export interface BulkImportUsersResult {
  created: number;
  errors: BulkImportUserRowError[];
}

// Mirrors the offers bulk-import: create as many rows as possible and
// report the rest as per-row errors, rather than failing the whole file
// over one bad row or one failed email.
export async function bulkImportUsers(csvText: string): Promise<BulkImportUsersResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new ApiError(400, "EMPTY_CSV", "The CSV file is empty");
  }

  const firstCell = (rows[0]?.[0] ?? "").trim();
  const hasHeader = !EMAIL_PATTERN.test(firstCell);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const errors: BulkImportUserRowError[] = [];
  let created = 0;
  const seenInFile = new Set<string>();

  for (const [idx, cols] of dataRows.entries()) {
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const [emailRaw, nameRaw, phoneRaw] = cols;
    const email = emailRaw?.trim() ?? "";

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

    // Blank name/phone are filled in by the delegate themselves on first
    // login (see the mustChangePassword flow), not required up front.
    const name = isBlank(nameRaw) ? "" : nameRaw!.trim();
    const phone = isBlank(phoneRaw) ? null : phoneRaw!.trim();

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const account = await prisma.account.create({
      data: {
        email,
        name,
        phone,
        passwordHash,
        roles: ["USER"],
        mustChangePassword: true,
      },
    });

    try {
      await sendTempPasswordEmail(account.email, tempPassword);
      created++;
    } catch (err) {
      console.error("Failed to send temp password email:", err);
      // The account exists, so don't count this as a failed row, but do
      // let the admin know the delegate has no way to log in yet.
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
  input: { phone?: string; email?: string; name?: string }
) {
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || !account.roles.includes("USER")) {
    throw new ApiError(404, "NOT_FOUND", "User not found");
  }

  if (input.email) {
    const existing = await prisma.account.findUnique({ where: { email: input.email } });
    if (existing && existing.id !== id) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }
  }

  return prisma.account.update({
    where: { id },
    data: {
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email ? { email: input.email } : {}),
      ...(input.name ? { name: input.name } : {}),
    },
    select: { id: true, email: true, name: true, phone: true },
  });
}

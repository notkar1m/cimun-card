import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

export interface AuthAccount {
  id: string;
  roles: Role[];
  isOwner: boolean;
}

// Roles and ownership come from the database on each authenticated request,
// not from the login token — otherwise promoting or demoting an admin (or
// deleting an account) wouldn't apply until their old session expired, and a
// freshly promoted admin's UI would show the dashboard while every admin API
// call 403'd. The short cache keeps that from doubling database load under
// heavy delegate traffic; anything that changes an account's roles or removes
// it must call invalidateAuthAccount so the change is immediate.
const TTL_MS = 15_000;
const cache = new Map<string, { account: AuthAccount; expiresAt: number }>();

export async function getAuthAccount(id: string): Promise<AuthAccount | null> {
  const hit = cache.get(id);
  if (hit && hit.expiresAt > Date.now()) return hit.account;

  const account = await prisma.account.findUnique({
    where: { id },
    select: { id: true, roles: true, isOwner: true },
  });
  if (!account) {
    cache.delete(id);
    return null;
  }

  cache.set(id, { account, expiresAt: Date.now() + TTL_MS });
  return account;
}

export function invalidateAuthAccount(id: string): void {
  cache.delete(id);
}

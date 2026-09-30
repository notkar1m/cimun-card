import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD must be set");
  }

  const existing = await prisma.account.findUnique({ where: { email } });
  if (existing) {
    console.log(`Superadmin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.account.create({
    data: {
      email,
      name: "Admin",
      passwordHash,
      roles: ["SUPERADMIN"],
      isOwner: true,
    },
  });

  console.log(`Created superadmin account: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

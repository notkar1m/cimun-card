import { prisma } from "../../lib/prisma";
import { sendBroadcastEmail } from "../../lib/mailer";

export async function getDelegateCount(): Promise<number> {
  return prisma.account.count({ where: { roles: { has: "USER" } } });
}

export async function broadcastToDelegates(subject: string, message: string): Promise<number> {
  const users = await prisma.account.findMany({
    where: { roles: { has: "USER" } },
    select: { email: true },
  });

  const recipients = users.map((u) => u.email);

  // Fire-and-forget: a few thousand delegates in batched BCC sends can take
  // a while, and there's no reason to hold the HTTP request open for it.
  void sendBroadcastEmail(recipients, subject, message).then(({ sent, failedBatches }) => {
    console.log(
      `Broadcast email: ${sent}/${recipients.length} delegates reached, ${failedBatches} batch(es) failed.`
    );
  });

  return recipients.length;
}

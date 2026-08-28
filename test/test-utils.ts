import { PrismaService } from '../src/prisma/prisma.service';

export async function cleanupTestUsers(
  prisma: PrismaService,
  emails: string[],
) {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    include: { wallet: true },
  });

  const walletIds = users
    .map((u) => u.wallet?.id)
    .filter(Boolean) as string[];

  if (walletIds.length > 0) {
    await prisma.transfer.deleteMany({
      where: {
        OR: [
          { senderWalletId: { in: walletIds } },
          { receiverWalletId: { in: walletIds } },
        ],
      },
    });

    await prisma.transaction.deleteMany({
      where: { walletId: { in: walletIds } },
    });
  }

  await prisma.user.deleteMany({
    where: { email: { in: emails } },
  });
}

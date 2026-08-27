import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DepositDto } from './dto';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  async getWallet(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada para este usuario');
    }

    return wallet;
  }

  async deposit(userId: string, depositDto: DepositDto) {
    const { amount } = depositDto;

    const wallet = await this.getWallet(userId);

    // Transacción atómica: incrementar saldo y registrar movimiento de depósito
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      const transactionRecord = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.DEPOSIT,
          amount,
        },
      });

      return {
        wallet: updatedWallet,
        transaction: transactionRecord,
      };
    });

    return result;
  }

  async getTransactions(userId: string) {
    const wallet = await this.getWallet(userId);

    const transactions = await this.prisma.transaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: 'desc' },
    });

    return transactions;
  }
}

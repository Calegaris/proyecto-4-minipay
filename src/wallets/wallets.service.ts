import { Injectable, NotFoundException } from '@nestjs/common';
import { TransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DepositDto, TransactionQueryDto } from './dto';

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

  async getTransactions(userId: string, query: TransactionQueryDto = new TransactionQueryDto()) {
    const wallet = await this.getWallet(userId);
    const { page = 1, limit = 10, type } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {
      walletId: wallet.id,
      ...(type ? { type } : {}),
    };

    const [transactions, total] = await this.prisma.$transaction([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: transactions,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }
}

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

  async getTransactions(
    userId: string,
    query: TransactionQueryDto = new TransactionQueryDto(),
  ) {
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

  /**
   * Obtiene métricas financieras y estadísticas agregadas en tiempo real
   * para el mes actual e histórico utilizando el Ledger contable (Transaction).
   */
  async getWalletStats(userId: string) {
    const wallet = await this.getWallet(userId);

    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const monthString = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    // Ejecutar en paralelo solo 2 consultas agregadas sobre el Ledger
    const [monthlyGroups, allTimeGroups] = await Promise.all([
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          walletId: wallet.id,
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.transaction.groupBy({
        by: ['type'],
        where: {
          walletId: wallet.id,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    const extractStats = (groups: typeof monthlyGroups) => {
      let deposited = new Prisma.Decimal(0);
      let sent = new Prisma.Decimal(0);
      let received = new Prisma.Decimal(0);
      let transactionCount = 0;

      for (const group of groups) {
        const sumAmount = group._sum.amount ?? new Prisma.Decimal(0);
        transactionCount += group._count.id;

        if (group.type === TransactionType.DEPOSIT) {
          deposited = sumAmount;
        } else if (group.type === TransactionType.TRANSFER_SENT) {
          sent = sumAmount;
        } else if (group.type === TransactionType.TRANSFER_RECEIVED) {
          received = sumAmount;
        }
      }

      // Flujo Neto de Caja = (Depósitos + Recibidos) - Transferidos
      const netCashFlow = Prisma.Decimal.add(deposited, received).sub(sent);

      return {
        totalDeposited: Number(deposited.toFixed(2)),
        totalTransferred: Number(sent.toFixed(2)),
        totalReceived: Number(received.toFixed(2)),
        netCashFlow: Number(netCashFlow.toFixed(2)),
        transactionCount,
      };
    };

    const monthlyStats = extractStats(monthlyGroups);
    const allTimeStats = extractStats(allTimeGroups);

    return {
      currentBalance: Number(wallet.balance),
      currency: wallet.currency,
      monthlySummary: {
        month: monthString,
        ...monthlyStats,
      },
      allTimeSummary: {
        totalDeposited: allTimeStats.totalDeposited,
        totalTransferred: allTimeStats.totalTransferred,
        totalReceived: allTimeStats.totalReceived,
        netCashFlow: allTimeStats.netCashFlow,
        totalOperationsCount: allTimeStats.transactionCount,
      },
    };
  }
}

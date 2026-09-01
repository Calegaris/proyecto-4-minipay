import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Prisma, TransactionType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class YieldsService {
  private readonly logger = new Logger(YieldsService.name);
  private readonly DEFAULT_TNA = 0.35; // 35.00% TNA
  private readonly DAYS_PER_YEAR = 365;
  private readonly MINIMUM_YIELD_AMOUNT = new Prisma.Decimal('0.01');

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtiene la Tasa Nominal Anual (TNA) configurada o por defecto (35%).
   */
  getTna(): number {
    return (
      this.configService.get<number>('ANNUAL_YIELD_RATE') ?? this.DEFAULT_TNA
    );
  }

  /**
   * Retorna la ventana de tiempo del día actual en UTC (00:00:00 a 23:59:59.999).
   */
  getTodayUtcWindow(): { startOfDay: Date; endOfDay: Date } {
    const now = new Date();
    const startOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const endOfDay = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );
    return { startOfDay, endOfDay };
  }

  /**
   * Calcula el rendimiento diario exacto con redondeo seguro a 2 decimales (ROUND_HALF_UP).
   */
  calculateDailyYield(balance: Prisma.Decimal): Prisma.Decimal {
    const tnaDecimal = new Prisma.Decimal(this.getTna());
    const dailyRate = tnaDecimal.div(this.DAYS_PER_YEAR);
    const rawYield = balance.mul(dailyRate);
    return rawYield.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  }

  /**
   * Retorna el resumen de rendimientos, proyecciones y acumulado histórico.
   */
  async getYieldSummary(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada para este usuario');
    }

    const tna = this.getTna();
    const tnaDecimal = new Prisma.Decimal(tna);
    const balance = wallet.balance;

    // Calcular rendimientos acumulados históricos en el Ledger
    const totalYieldAggregate = await this.prisma.transaction.aggregate({
      where: {
        walletId: wallet.id,
        type: TransactionType.YIELD,
      },
      _sum: { amount: true },
      _count: { id: true },
    });

    const totalYieldsEarned =
      totalYieldAggregate._sum.amount ?? new Prisma.Decimal(0);
    const estimatedDaily = this.calculateDailyYield(balance);
    const estimatedMonthly = balance
      .mul(tnaDecimal.div(12))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    const estimatedAnnual = balance
      .mul(tnaDecimal)
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

    const dailyRatePercentage = ((tna / this.DAYS_PER_YEAR) * 100).toFixed(5);

    return {
      currentBalance: Number(balance),
      currency: wallet.currency,
      tna: `${(tna * 100).toFixed(2)}%`,
      dailyRatePercentage: `${dailyRatePercentage}%`,
      totalYieldsEarnedAllTime: Number(totalYieldsEarned),
      totalYieldOperationsCount: totalYieldAggregate._count.id,
      estimatedDailyYield: Number(estimatedDaily),
      estimatedMonthlyYield: Number(estimatedMonthly),
      estimatedAnnualYield: Number(estimatedAnnual),
    };
  }

  /**
   * Simula y acredita manualmente 1 día de rendimiento sobre la billetera del usuario.
   * Aplica validación estricta de idempotencia diaria y monto mínimo de $0.01.
   */
  async simulateYield(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada para este usuario');
    }

    // 1. Verificación de Idempotencia Diaria (Ventana UTC)
    const { startOfDay, endOfDay } = this.getTodayUtcWindow();
    const existingYield = await this.prisma.transaction.findFirst({
      where: {
        walletId: wallet.id,
        type: TransactionType.YIELD,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    if (existingYield) {
      throw new ConflictException(
        'El rendimiento diario para la fecha de hoy ya ha sido acreditado',
      );
    }

    // 2. Validación de Monto Mínimo Acreditable
    const yieldAmount = this.calculateDailyYield(wallet.balance);
    if (yieldAmount.lessThan(this.MINIMUM_YIELD_AMOUNT)) {
      throw new BadRequestException(
        'El saldo actual no genera el rendimiento mínimo acreditable ($0.01 ARS)',
      );
    }

    // 3. Transacción Atómica: Incrementar saldo y registrar en el Ledger
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: {
            increment: yieldAmount,
          },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          walletId: wallet.id,
          type: TransactionType.YIELD,
          amount: yieldAmount,
        },
      });

      return {
        message: 'Rendimiento diario acreditado exitosamente',
        creditedAmount: Number(yieldAmount),
        newBalance: Number(updatedWallet.balance),
        currency: updatedWallet.currency,
        transaction,
      };
    });

    return result;
  }

  /**
   * Tarea programada en background que acredita rendimientos a todas las billeteras
   * activas todos los días a medianoche (00:00 UTC).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async processDailyYields() {
    this.logger.log('Iniciando proceso batch de rendimientos diarios...');
    const { startOfDay, endOfDay } = this.getTodayUtcWindow();

    const eligibleWallets = await this.prisma.wallet.findMany({
      where: {
        balance: { gte: new Prisma.Decimal('1.00') },
      },
    });

    let processedCount = 0;
    let totalCredited = new Prisma.Decimal(0);

    for (const wallet of eligibleWallets) {
      const alreadyProcessed = await this.prisma.transaction.findFirst({
        where: {
          walletId: wallet.id,
          type: TransactionType.YIELD,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
      });

      if (alreadyProcessed) {
        continue;
      }

      const yieldAmount = this.calculateDailyYield(wallet.balance);
      if (yieldAmount.lessThan(this.MINIMUM_YIELD_AMOUNT)) {
        continue;
      }

      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: yieldAmount } },
          });

          await tx.transaction.create({
            data: {
              walletId: wallet.id,
              type: TransactionType.YIELD,
              amount: yieldAmount,
            },
          });
        });

        processedCount++;
        totalCredited = totalCredited.add(yieldAmount);
      } catch (error: any) {
        this.logger.error(
          `Error acreditando rendimiento a billetera ${wallet.id}: ${error.message}`,
        );
      }
    }

    this.logger.log(
      `Proceso batch finalizado: ${processedCount} billeteras acreditadas. Total: $${totalCredited.toFixed(2)} ARS.`,
    );
  }
}

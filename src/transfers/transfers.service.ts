import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { TransferStatus, TransactionType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReceiptsService } from './services/receipts.service';
import { CreateTransferDto, TransferQueryDto } from './dto';

@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private receiptsService: ReceiptsService,
  ) {}

  async createTransfer(
    senderUserId: string,
    createTransferDto: CreateTransferDto,
    idempotencyKey?: string,
  ) {
    const {
      recipientEmail,
      recipientAlias,
      recipientCvu,
      recipientId,
      amount,
    } = createTransferDto;

    if (!recipientEmail && !recipientAlias && !recipientCvu && !recipientId) {
      throw new BadRequestException(
        'Debes especificar el email, alias, CVU o ID del destinatario',
      );
    }

    // 1. Manejo de Idempotencia: Verificar si ya existe una transferencia con esa clave
    if (idempotencyKey) {
      const existingTransfer = await this.prisma.transfer.findUnique({
        where: { idempotencyKey },
        include: {
          senderWallet: { include: { user: true } },
          receiverWallet: { include: { user: true } },
        },
      });

      if (existingTransfer) {
        // Verificar que coincida el remitente y monto para devolver el resultado previo
        const isSameSender =
          existingTransfer.senderWallet.userId === senderUserId;
        const isSameAmount = Number(existingTransfer.amount) === amount;

        if (isSameSender && isSameAmount) {
          return existingTransfer;
        }

        // Si la clave ya fue usada con otros parámetros, rechazar
        throw new BadRequestException(
          'Idempotency-Key reutilizada con datos diferentes',
        );
      }
    }

    // 2. Buscar y validar usuario/billetera destinatario
    let receiverWallet: any = null;

    if (recipientCvu) {
      receiverWallet = await this.prisma.wallet.findUnique({
        where: { cvu: recipientCvu },
        include: { user: true },
      });
    } else if (recipientAlias) {
      receiverWallet = await this.prisma.wallet.findUnique({
        where: { alias: recipientAlias },
        include: { user: true },
      });
    } else if (recipientEmail) {
      const recipientUser = await this.prisma.user.findUnique({
        where: { email: recipientEmail },
        include: { wallet: true },
      });
      if (recipientUser && recipientUser.wallet) {
        receiverWallet = {
          ...recipientUser.wallet,
          user: recipientUser,
        };
      }
    } else if (recipientId) {
      receiverWallet = await this.prisma.wallet.findUnique({
        where: { userId: recipientId },
        include: { user: true },
      });
    }

    if (!receiverWallet) {
      throw new NotFoundException(
        'El destinatario no existe o no tiene una billetera activa',
      );
    }

    // 3. Regla de negocio: El remitente no puede transferirse a sí mismo
    if (receiverWallet.userId === senderUserId) {
      throw new BadRequestException('No puedes transferirte dinero a ti mismo');
    }

    // 4. Buscar billetera del remitente y verificar saldo disponible
    const senderWallet = await this.prisma.wallet.findUnique({
      where: { userId: senderUserId },
    });

    if (!senderWallet) {
      throw new NotFoundException('Billetera de origen no encontrada');
    }

    if (Number(senderWallet.balance) < amount) {
      throw new ConflictException(
        'Saldo insuficiente para realizar la transferencia',
      );
    }

    // 5. Transacción atómica: Control de Riesgo Diario, Débito, Crédito, Creación de Transferencia y Movimientos
    const transfer = await this.prisma.$transaction(async (tx) => {
      // 5.1. Control de Riesgo: Calcular acumulación diaria de transferencias en UTC
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const dailyAggregate = await tx.transfer.aggregate({
        where: {
          senderWalletId: senderWallet.id,
          status: TransferStatus.COMPLETED,
          createdAt: { gte: startOfDay },
        },
        _sum: { amount: true },
      });

      const totalSentToday =
        dailyAggregate._sum.amount ?? new Prisma.Decimal(0);
      const amountDecimal = new Prisma.Decimal(amount);
      const remainingLimit = Prisma.Decimal.sub(
        senderWallet.dailyTransferLimit,
        totalSentToday,
      );

      if (amountDecimal.greaterThan(remainingLimit)) {
        throw new UnprocessableEntityException(
          `Límite operativo diario excedido. Cupo disponible restante: $${remainingLimit.toFixed(2)} ARS`,
        );
      }

      // 5.2. Descontar saldo del remitente
      await tx.wallet.update({
        where: { id: senderWallet.id },
        data: {
          balance: {
            decrement: amount,
          },
        },
      });

      // 5.3. Acreditar saldo al destinatario
      await tx.wallet.update({
        where: { id: receiverWallet.id },
        data: {
          balance: {
            increment: amount,
          },
        },
      });

      // Crear registro principal de Transferencia
      const newTransfer = await tx.transfer.create({
        data: {
          senderWalletId: senderWallet.id,
          receiverWalletId: receiverWallet.id,
          amount,
          status: TransferStatus.COMPLETED,
          idempotencyKey: idempotencyKey ?? null,
          completedAt: new Date(),
        },
      });

      // Registrar movimiento de salida para el remitente
      await tx.transaction.create({
        data: {
          walletId: senderWallet.id,
          transferId: newTransfer.id,
          type: TransactionType.TRANSFER_SENT,
          amount,
        },
      });

      // Registrar movimiento de entrada para el destinatario
      await tx.transaction.create({
        data: {
          walletId: receiverWallet.id,
          transferId: newTransfer.id,
          type: TransactionType.TRANSFER_RECEIVED,
          amount,
        },
      });

      return newTransfer;
    });

    return transfer;
  }

  async getTransferById(userId: string, transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        senderWallet: { select: { id: true, userId: true } },
        receiverWallet: { select: { id: true, userId: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    // Regla de autorización: Solo el remitente o el destinatario pueden consultar la transferencia
    const isParticipant =
      transfer.senderWallet.userId === userId ||
      transfer.receiverWallet.userId === userId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'No tienes permisos para consultar esta transferencia',
      );
    }

    return transfer;
  }

  async getTransferReceipt(userId: string, transferId: string) {
    const transfer = await this.prisma.transfer.findUnique({
      where: { id: transferId },
      include: {
        senderWallet: { include: { user: true } },
        receiverWallet: { include: { user: true } },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transferencia no encontrada');
    }

    // Regla de autorización: Solo el remitente o el destinatario pueden descargar el comprobante
    const isParticipant =
      transfer.senderWallet.userId === userId ||
      transfer.receiverWallet.userId === userId;

    if (!isParticipant) {
      throw new ForbiddenException(
        'No tienes permisos para descargar el comprobante de esta transferencia',
      );
    }

    const buffer =
      await this.receiptsService.generateTransferReceiptPdf(transfer);
    const filename = `comprobante-transferencia-${transfer.id}.pdf`;

    return { buffer, filename };
  }

  async getTransfers(
    userId: string,
    query: TransferQueryDto = new TransferQueryDto(),
  ) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada');
    }

    const { page = 1, limit = 10, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransferWhereInput = {
      OR: [{ senderWalletId: wallet.id }, { receiverWalletId: wallet.id }],
      ...(status ? { status } : {}),
    };

    const [transfers, total] = await this.prisma.$transaction([
      this.prisma.transfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          senderWallet: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          receiverWallet: {
            select: {
              id: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      this.prisma.transfer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: transfers,
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

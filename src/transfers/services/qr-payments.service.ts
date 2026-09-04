import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TransactionCategory } from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { GenerateQrDto } from '../dto';

export interface QrPayload {
  qrId: string;
  recipientWalletId: string;
  recipientCvu: string;
  recipientAlias: string;
  recipientName: string;
  amount: number;
  concept?: string;
  category: TransactionCategory;
  expiresAt: string; // Formato ISO 8601
}

export interface SignedQrData extends QrPayload {
  signature: string;
}

@Injectable()
export class QrPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtiene la clave secreta para la firma criptográfica HMAC-SHA256.
   */
  private getSecretKey(): string {
    return (
      this.configService.get<string>('QR_SIGNING_SECRET') ??
      this.configService.get<string>('JWT_SECRET') ??
      'minipay-qr-super-secret-key-2026'
    );
  }

  /**
   * Genera una firma HMAC-SHA256 a partir de una cadena de texto.
   */
  signPayload(payloadString: string): string {
    return crypto
      .createHmac('sha256', this.getSecretKey())
      .update(payloadString)
      .digest('hex');
  }

  /**
   * Verifica la validez de la firma HMAC en tiempo constante con crypto.timingSafeEqual,
   * validando previamente la longitud de los buffers para evitar RangeError / 500 no controlados.
   */
  verifyQrSignature(payloadString: string, signature: string): boolean {
    if (!signature || typeof signature !== 'string') {
      return false;
    }

    const expectedSignature = this.signPayload(payloadString);
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    // Salvaguarda obligatoria contra RangeError en timingSafeEqual
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
  }

  /**
   * Genera un código QR dinámico firmado en Base64 con tiempo de expiración (TTL).
   */
  async generateQr(userId: string, generateQrDto: GenerateQrDto) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!wallet) {
      throw new NotFoundException('Billetera no encontrada para este usuario');
    }

    const ttlMinutes = generateQrDto.expiresInMinutes ?? 15;
    const expiresAt = new Date(
      Date.now() + ttlMinutes * 60 * 1000,
    ).toISOString();
    const qrId = crypto.randomUUID();

    const rawPayload: QrPayload = {
      qrId,
      recipientWalletId: wallet.id,
      recipientCvu: wallet.cvu,
      recipientAlias: wallet.alias,
      recipientName: wallet.user.name,
      amount: generateQrDto.amount,
      concept: generateQrDto.concept,
      category: generateQrDto.category ?? TransactionCategory.GENERAL_TRANSFER,
      expiresAt,
    };

    const payloadString = JSON.stringify(rawPayload);
    const signature = this.signPayload(payloadString);

    const signedData: SignedQrData = {
      ...rawPayload,
      signature,
    };

    const qrCode = Buffer.from(JSON.stringify(signedData)).toString('base64');

    return {
      qrCode,
      qrData: rawPayload,
      expiresAt: new Date(expiresAt),
    };
  }

  /**
   * Decodifica y valida un código QR escaneado, verificando su firma HMAC,
   * vigencia temporal y estado de liquidación previo en la base de datos.
   */
  async decodeQr(qrCode: string) {
    let signedData: SignedQrData;

    try {
      const decodedString = Buffer.from(qrCode, 'base64').toString('utf-8');
      signedData = JSON.parse(decodedString);
    } catch {
      throw new BadRequestException('Formato de código QR inválido o corrupto');
    }

    if (!signedData || typeof signedData !== 'object') {
      throw new BadRequestException('Payload de código QR malformado');
    }

    const { signature, ...rawPayload } = signedData;

    if (!signature || !rawPayload.qrId || !rawPayload.recipientCvu) {
      throw new BadRequestException('Datos esenciales del código QR ausentes');
    }

    const payloadString = JSON.stringify(rawPayload);
    const isSignatureValid = this.verifyQrSignature(payloadString, signature);

    if (!isSignatureValid) {
      throw new BadRequestException('Código QR inválido o alterado');
    }

    const expiresAtDate = new Date(rawPayload.expiresAt);
    const isExpired = Date.now() > expiresAtDate.getTime();

    // Verificación de Replay Attack / Cobro Previo
    const existingTransfer = await this.prisma.transfer.findUnique({
      where: { idempotencyKey: `qr-${rawPayload.qrId}` },
    });

    const isAlreadyPaid = Boolean(existingTransfer);

    return {
      valid: !isExpired && !isAlreadyPaid,
      expired: isExpired,
      alreadyPaid: isAlreadyPaid,
      qrId: rawPayload.qrId,
      recipient: {
        name: rawPayload.recipientName,
        alias: rawPayload.recipientAlias,
        cvu: rawPayload.recipientCvu,
      },
      amount: rawPayload.amount,
      concept: rawPayload.concept,
      category: rawPayload.category,
      expiresAt: expiresAtDate,
    };
  }
}

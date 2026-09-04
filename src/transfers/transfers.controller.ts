import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  StreamableFile,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { QrPaymentsService } from './services/qr-payments.service';
import {
  CreateTransferDto,
  TransferQueryDto,
  GenerateQrDto,
  DecodeQrDto,
  PayQrDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Transfers')
@ApiBearerAuth('JWT-auth')
@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly qrPaymentsService: QrPaymentsService,
  ) {}

  @Post('qr/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar orden de cobro con Código QR Dinámico',
    description:
      'Crea un payload QR firmado criptográficamente con HMAC-SHA256, monto, concepto y tiempo de expiración (TTL).',
  })
  @ApiResponse({
    status: 200,
    description: 'Código QR generado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Parámetros de cobro inválidos',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async generateQr(
    @CurrentUser('id') userId: string,
    @Body() generateQrDto: GenerateQrDto,
  ) {
    return this.qrPaymentsService.generateQr(userId, generateQrDto);
  }

  @Post('qr/decode')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Decodificar y previsualizar un Código QR escaneado',
    description:
      'Valida la firma criptográfica HMAC y vigencia temporal (TTL) del código QR antes de confirmar el pago.',
  })
  @ApiResponse({
    status: 200,
    description: 'Código QR decodificado y verificado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Código QR inválido, alterado o corrupto',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async decodeQr(@Body() decodeQrDto: DecodeQrDto) {
    return this.qrPaymentsService.decodeQr(decodeQrDto.qrCode);
  }

  @Post('qr/pay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Pagar orden mediante Código QR Dinámico',
    description:
      'Verifica la firma, vigencia temporal, bloquea auto-pago y ejecuta la transferencia atómicamente con protección contra Replay Attacks.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pago de código QR procesado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Código QR inválido, expirado o intento de auto-pago',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 409,
    description: 'Saldo insuficiente o código QR ya cobrado (Replay Attack)',
  })
  async payQr(@CurrentUser('id') userId: string, @Body() payQrDto: PayQrDto) {
    return this.transfersService.payQr(userId, payQrDto);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Transferir dinero a otro usuario',
    description:
      'Transfiere saldo hacia otro usuario dentro de una transacción atómica. Soporta el header Idempotency-Key para prevenir duplicación ante reintentos de red.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description:
      'Clave única generada por el cliente para garantizar idempotencia en la transferencia',
    schema: {
      type: 'string',
      example: 'transfer-req-948123-abc',
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transferencia procesada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Datos inválidos, auto-transferencia o Idempotency-Key reutilizada con datos diferentes',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  @ApiResponse({
    status: 404,
    description: 'Destinatario o billetera no encontrada',
  })
  @ApiResponse({
    status: 409,
    description: 'Saldo insuficiente para completar la transferencia',
  })
  @ApiResponse({
    status: 422,
    description: 'Límite operativo diario de transferencias excedido',
  })
  async createTransfer(
    @CurrentUser('id') userId: string,
    @Body() createTransferDto: CreateTransferDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.transfersService.createTransfer(
      userId,
      createTransferDto,
      idempotencyKey,
    );
  }

  @Get(':id/receipt')
  @ApiOperation({
    summary: 'Descargar comprobante bancario en PDF',
    description:
      'Genera y descarga en tiempo real el comprobante oficial de la transferencia en formato PDF. Solo accesible para el emisor o receptor.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la transferencia (UUID)',
    example: 'd9b1c782-5813-435b-a63e-63f58e1c60f2',
  })
  @ApiResponse({
    status: 200,
    description:
      'Comprobante bancario en PDF generado y descargado exitosamente',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado (el usuario no participó en la transferencia)',
  })
  @ApiResponse({
    status: 404,
    description: 'Transferencia no encontrada',
  })
  async downloadReceipt(
    @CurrentUser('id') userId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, filename } = await this.transfersService.getTransferReceipt(
      userId,
      id,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length.toString(),
    });

    return new StreamableFile(buffer);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Consultar detalle de una transferencia',
    description:
      'Obtiene la información de una transferencia específica. Solo accesible para el remitente o el destinatario.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID de la transferencia',
    example: 'd9b1c782-5813-435b-a63e-63f58e1c60f2',
  })
  @ApiResponse({
    status: 200,
    description: 'Transferencia obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  @ApiResponse({
    status: 403,
    description:
      'Acceso denegado (el usuario no participó en la transferencia)',
  })
  @ApiResponse({
    status: 404,
    description: 'Transferencia no encontrada',
  })
  async getTransferById(
    @CurrentUser('id') userId: string,
    @Param('id') transferId: string,
  ) {
    return this.transfersService.getTransferById(userId, transferId);
  }

  @Get()
  @ApiOperation({
    summary: 'Consultar historial de transferencias',
    description:
      'Lista las transferencias enviadas y recibidas por el usuario autenticado, con soporte para paginación (page, limit) y filtros por estado (PENDING, COMPLETED, FAILED).',
  })
  @ApiResponse({
    status: 200,
    description: 'Historial paginado de transferencias obtenido exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async getTransfers(
    @CurrentUser('id') userId: string,
    @Query() query: TransferQueryDto,
  ) {
    return this.transfersService.getTransfers(userId, query);
  }
}

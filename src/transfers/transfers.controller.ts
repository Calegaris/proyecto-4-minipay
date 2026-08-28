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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { TransfersService } from './transfers.service';
import { CreateTransferDto, TransferQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';


@ApiTags('Transfers')
@ApiBearerAuth('JWT-auth')
@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

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
    description: 'Acceso denegado (el usuario no participó en la transferencia)',
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



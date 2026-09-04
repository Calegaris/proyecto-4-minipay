import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { YieldsService } from './services/yields.service';
import { DepositDto, TransactionQueryDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly yieldsService: YieldsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar saldo y datos de la billetera',
    description:
      'Retorna el saldo actual, moneda y datos de la billetera del usuario autenticado.',
  })
  @ApiResponse({
    status: 200,
    description: 'Billetera recuperada exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  async getWallet(@CurrentUser('id') userId: string) {
    return this.walletsService.getWallet(userId);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Depositar dinero ficticio en la billetera',
    description:
      'Incrementa el saldo de la billetera y registra la transacción con tipo DEPOSIT dentro de una transacción atómica.',
  })
  @ApiResponse({
    status: 200,
    description: 'Depósito procesado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Monto inválido (menor a 1 o con formato incorrecto)',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async deposit(
    @CurrentUser('id') userId: string,
    @Body() depositDto: DepositDto,
  ) {
    return this.walletsService.deposit(userId, depositDto);
  }

  @Get('transactions')
  @ApiOperation({
    summary: 'Consultar historial de movimientos',
    description:
      'Obtiene las transacciones de la billetera con soporte para paginación (page, limit) y filtros por tipo (DEPOSIT, TRANSFER_SENT, TRANSFER_RECEIVED).',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de transacciones obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async getTransactions(
    @CurrentUser('id') userId: string,
    @Query() query: TransactionQueryDto,
  ) {
    return this.walletsService.getTransactions(userId, query);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Consultar métricas y estadísticas financieras',
    description:
      'Retorna el resumen financiero mensual e histórico: total depositado, enviado, recibido, cantidad de operaciones y flujo neto de caja (Net Cash Flow).',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas financieras calculadas exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  async getWalletStats(@CurrentUser('id') userId: string) {
    return this.walletsService.getWalletStats(userId);
  }

  @Get('yields')
  @ApiOperation({
    summary:
      'Consultar métricas y proyecciones de rendimientos (Cuenta Remunerada)',
    description:
      'Retorna la Tasa Nominal Anual (TNA), tasa diaria, rendimientos ganados históricos y proyecciones estimadas (diaria, mensual y anual).',
  })
  @ApiResponse({
    status: 200,
    description:
      'Resumen y proyecciones de rendimientos obtenidos exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado / Token ausente o inválido',
  })
  async getYieldSummary(@CurrentUser('id') userId: string) {
    return this.yieldsService.getYieldSummary(userId);
  }

  @Post('simulate-yield')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Simular y acreditar 1 día de rendimiento en la billetera',
    description:
      'Acredita inmediatamente el rendimiento diario calculado en base a la TNA (35%) sobre el saldo actual, aplicando validación de idempotencia diaria.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rendimiento diario acreditado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'El saldo actual no genera el rendimiento mínimo acreditable ($0.01 ARS)',
  })
  @ApiResponse({
    status: 409,
    description:
      'El rendimiento diario para la fecha de hoy ya ha sido acreditado previamente',
  })
  async simulateYield(@CurrentUser('id') userId: string) {
    return this.yieldsService.simulateYield(userId);
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
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
import { DepositDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Wallet')
@ApiBearerAuth('JWT-auth')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @ApiOperation({
    summary: 'Consultar saldo y datos de la billetera',
    description: 'Retorna el saldo actual, moneda y datos de la billetera del usuario autenticado.',
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
    description: 'Obtiene todos los registros y transacciones de la billetera ordenados por fecha descendente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de transacciones obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async getTransactions(@CurrentUser('id') userId: string) {
    return this.walletsService.getTransactions(userId);
  }
}


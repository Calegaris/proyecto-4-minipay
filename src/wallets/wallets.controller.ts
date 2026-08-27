import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { DepositDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  async getWallet(@CurrentUser('id') userId: string) {
    return this.walletsService.getWallet(userId);
  }

  @Post('deposit')
  @HttpCode(HttpStatus.OK)
  async deposit(
    @CurrentUser('id') userId: string,
    @Body() depositDto: DepositDto,
  ) {
    return this.walletsService.deposit(userId, depositDto);
  }

  @Get('transactions')
  async getTransactions(@CurrentUser('id') userId: string) {
    return this.walletsService.getTransactions(userId);
  }
}

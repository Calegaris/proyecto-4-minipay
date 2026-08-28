import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
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
  async getTransferById(
    @CurrentUser('id') userId: string,
    @Param('id') transferId: string,
  ) {
    return this.transfersService.getTransferById(userId, transferId);
  }

  @Get()
  async getTransfers(@CurrentUser('id') userId: string) {
    return this.transfersService.getTransfers(userId);
  }
}

import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { ReceiptsService } from './services/receipts.service';
import { QrPaymentsService } from './services/qr-payments.service';

@Module({
  controllers: [TransfersController],
  providers: [TransfersService, ReceiptsService, QrPaymentsService],
  exports: [TransfersService, ReceiptsService, QrPaymentsService],
})
export class TransfersModule {}

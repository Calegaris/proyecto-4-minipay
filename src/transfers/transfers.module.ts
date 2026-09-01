import { Module } from '@nestjs/common';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';
import { ReceiptsService } from './services/receipts.service';

@Module({
  controllers: [TransfersController],
  providers: [TransfersService, ReceiptsService],
  exports: [TransfersService, ReceiptsService],
})
export class TransfersModule {}

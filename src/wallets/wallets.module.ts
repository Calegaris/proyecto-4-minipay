import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WalletFactory } from './factories';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, WalletFactory],
  exports: [WalletsService, WalletFactory],
})
export class WalletsModule {}


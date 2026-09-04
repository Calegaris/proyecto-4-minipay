import { Module } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { WalletsController } from './wallets.controller';
import { WalletFactory } from './factories';
import { YieldsService } from './services/yields.service';

@Module({
  controllers: [WalletsController],
  providers: [WalletsService, WalletFactory, YieldsService],
  exports: [WalletsService, WalletFactory, YieldsService],
})
export class WalletsModule {}

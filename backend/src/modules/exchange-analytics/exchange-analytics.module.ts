import { Module } from '@nestjs/common';
import { ExchangeAnalyticsController } from './exchange-analytics.controller';
import { ExchangeAnalyticsService } from './exchange-analytics.service';
import { MiscModule } from '../misc/misc.module';
import { MoralisService } from '../../common/services/moralis.service';
import { BlockchainDataService } from './blockchain-data.service';

@Module({
    imports: [MiscModule],
    controllers: [ExchangeAnalyticsController],
    providers: [ExchangeAnalyticsService, MoralisService, BlockchainDataService],
    exports: [ExchangeAnalyticsService],
})
export class ExchangeAnalyticsModule { }

import { Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ExchangeAnalyticsService } from './exchange-analytics.service';
import { AuditLogService } from '../misc/audit-log.service';

@ApiTags('Exchange Analytics')
@Controller('api/v1/exchange-analytics')
export class ExchangeAnalyticsController {
    constructor(
        private readonly service: ExchangeAnalyticsService,
        private readonly auditLogService: AuditLogService,
    ) { }

    @Get('exchanges')
    @ApiOperation({ summary: 'List all supported exchanges' })
    getExchanges() {
        return this.service.getExchanges();
    }

    @Get(':exchangeName/filter-ethiopians')
    @ApiOperation({ summary: 'Scan bulk exchange users and filter Ethiopians using multi-signal detection' })
    @ApiQuery({ name: 'count', required: false, description: 'Number of users to scan (default 200, max 500)' })
    async filterEthiopians(
        @Param('exchangeName') exchangeName: string,
        @Query('count') count?: string,
        @Req() req?: any,
    ) {
        const scanCount = Math.min(parseInt(count ?? '200', 10) || 200, 500);
        const result = this.service.filterEthiopians(exchangeName, scanCount);

        await this.auditLogService.log({
            actor: req?.user?.email ?? req?.user?.sub ?? 'analyst',
            action: 'exchange.filter_ethiopians',
            resource: `/api/v1/exchange-analytics/${exchangeName}/filter-ethiopians`,
            meta: {
                exchange: exchangeName,
                totalScanned: result.totalScanned,
                ethiopiansFound: result.ethiopiansFound,
                detectionRate: result.detectionRate,
            },
        }).catch(() => { });

        return result;
    }

    @Get(':exchangeName')
    @ApiOperation({ summary: 'Get full audit data for a user on a specific exchange' })
    @ApiQuery({ name: 'userId', required: false, description: 'Email, wallet address, or user ID to audit' })
    async getExchangeAnalysis(
        @Param('exchangeName') exchangeName: string,
        @Query('userId') userId?: string,
        @Req() req?: any,
    ) {
        const result = await this.service.getExchangeAnalysis(exchangeName, userId ?? 'anonymous');

        await this.auditLogService.log({
            actor: req?.user?.email ?? req?.user?.sub ?? 'analyst',
            action: 'exchange.audit',
            resource: `/api/v1/exchange-analytics/${exchangeName}`,
            meta: {
                exchange: exchangeName,
                userId: userId ?? 'anonymous',
                fieldsCount: result.fields.length,
                verifiedCount: result.fields.filter(f => f.verification_status === 'verified').length,
            },
        }).catch(() => { });

        return result;
    }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MoralisService } from '../../common/services/moralis.service';
import { Chain } from '../../shared/enums/chain.enum';

export interface WalletOnChainData {
    // Source flags
    source: 'moralis' | 'etherscan' | 'mock';

    // Balance
    balanceEth: number | null;
    balanceUsd: number | null;

    // Transactions
    transactions: Array<{
        hash: string;
        from: string;
        to: string;
        amount: number;
        timestamp: string;
        direction: 'inbound' | 'outbound';
    }>;

    // Counts
    depositCount: number;
    withdrawalCount: number;

    // Latest tx
    latestTxHash: string | null;
    latestTxDate: string | null;
    latestTxAmount: number | null;
    latestTxToken: string;

    // Fiat price
    ethPriceUsd: number;
}

// ─── CoinGecko free tier — no key needed ─────────────────────────────────────
const COINGECKO_PRICE_URL =
    'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,tether,binancecoin,usd-coin,ripple,solana,cardano&vs_currencies=usd';

// ─── Etherscan V2 free tier ───────────────────────────────────────────────────
const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';

@Injectable()
export class BlockchainDataService {
    private readonly logger = new Logger(BlockchainDataService.name);
    private readonly explorerKey: string;

    // Simple in-memory price cache — refreshes every 5 minutes
    private priceCache: Record<string, number> = {};
    private priceCacheAt = 0;

    constructor(
        private readonly moralis: MoralisService,
        private readonly config: ConfigService,
    ) {
        this.explorerKey = this.config.get<string>('EXPLORER_API_KEY') ?? '';
    }

    /** Returns true if the string looks like an EVM wallet address */
    isEvmAddress(value: string): boolean {
        return /^0x[a-fA-F0-9]{40}$/.test((value ?? '').trim());
    }

    /** Fetch live prices from CoinGecko (free, no key) */
    async getPrices(): Promise<Record<string, number>> {
        const now = Date.now();
        if (now - this.priceCacheAt < 5 * 60 * 1000 && Object.keys(this.priceCache).length > 0) {
            return this.priceCache;
        }
        try {
            const res = await axios.get<Record<string, { usd: number }>>(COINGECKO_PRICE_URL, {
                timeout: 5000,
            });
            const data = res.data ?? {};
            this.priceCache = {
                ETH: data['ethereum']?.usd ?? 3200,
                BTC: data['bitcoin']?.usd ?? 65000,
                USDT: data['tether']?.usd ?? 1,
                BNB: data['binancecoin']?.usd ?? 600,
                USDC: data['usd-coin']?.usd ?? 1,
                XRP: data['ripple']?.usd ?? 0.5,
                SOL: data['solana']?.usd ?? 150,
                ADA: data['cardano']?.usd ?? 0.45,
            };
            this.priceCacheAt = now;
            this.logger.log(`CoinGecko prices refreshed: ETH=$${this.priceCache['ETH']}`);
        } catch (err) {
            this.logger.warn(`CoinGecko price fetch failed, using fallback: ${(err as Error).message}`);
            // Fallback hardcoded prices if CoinGecko is down
            if (Object.keys(this.priceCache).length === 0) {
                this.priceCache = { ETH: 3200, BTC: 65000, USDT: 1, BNB: 600, USDC: 1, XRP: 0.5, SOL: 150, ADA: 0.45 };
            }
        }
        return this.priceCache;
    }

    /** Fetch real on-chain data for a wallet address using Moralis + Etherscan */
    async getWalletData(address: string, chain: Chain = Chain.ETHEREUM): Promise<WalletOnChainData> {
        const prices = await this.getPrices();
        const ethPrice = prices['ETH'] ?? 3200;

        // ── Try Moralis first ─────────────────────────────────────────────────
        if (this.moralis.isConfigured()) {
            try {
                const [balanceEth, txs] = await Promise.all([
                    this.moralis.getNativeBalance(address, chain),
                    this.moralis.getWalletTransactions(address, chain, 100),
                ]);

                const deposits = txs.filter(t => t.to?.toLowerCase() === address.toLowerCase());
                const withdrawals = txs.filter(t => t.from?.toLowerCase() === address.toLowerCase());
                const latest = txs[0] ?? null;

                const balanceUsd = balanceEth !== null ? parseFloat((balanceEth * ethPrice).toFixed(2)) : null;

                this.logger.log(`Moralis: ${address} — balance=${balanceEth} ETH, txs=${txs.length}`);

                return {
                    source: 'moralis',
                    balanceEth,
                    balanceUsd,
                    transactions: txs.map(t => ({
                        ...t,
                        direction: t.to?.toLowerCase() === address.toLowerCase() ? 'inbound' : 'outbound',
                    })),
                    depositCount: deposits.length,
                    withdrawalCount: withdrawals.length,
                    latestTxHash: latest?.hash ?? null,
                    latestTxDate: latest?.timestamp ?? null,
                    latestTxAmount: latest?.amount ?? null,
                    latestTxToken: 'ETH',
                    ethPriceUsd: ethPrice,
                };
            } catch (err) {
                this.logger.warn(`Moralis failed for ${address}: ${(err as Error).message} — falling back to Etherscan`);
            }
        }

        // ── Fallback: Etherscan V2 free tier ──────────────────────────────────
        if (this.explorerKey) {
            try {
                const chainId = chain === Chain.ETHEREUM ? 1
                    : chain === Chain.BSC ? 56
                        : chain === Chain.POLYGON ? 137
                            : chain === Chain.ARBITRUM ? 42161
                                : chain === Chain.OPTIMISM ? 10
                                    : chain === Chain.BASE ? 8453
                                        : 1;

                const [balRes, txRes] = await Promise.all([
                    axios.get(ETHERSCAN_BASE, {
                        params: {
                            chainid: chainId,
                            module: 'account',
                            action: 'balance',
                            address,
                            tag: 'latest',
                            apikey: this.explorerKey,
                        },
                        timeout: 8000,
                    }),
                    axios.get(ETHERSCAN_BASE, {
                        params: {
                            chainid: chainId,
                            module: 'account',
                            action: 'txlist',
                            address,
                            startblock: 0,
                            endblock: 99999999,
                            page: 1,
                            offset: 100,
                            sort: 'desc',
                            apikey: this.explorerKey,
                        },
                        timeout: 8000,
                    }),
                ]);

                const balWei = Number(balRes.data?.result ?? 0);
                const balanceEth = balWei / 1e18;
                const balanceUsd = parseFloat((balanceEth * ethPrice).toFixed(2));

                const rawTxs: any[] = Array.isArray(txRes.data?.result) ? txRes.data.result : [];
                const txs = rawTxs.map(t => ({
                    hash: t.hash ?? '',
                    from: t.from ?? '',
                    to: t.to ?? '',
                    amount: Number(t.value ?? 0) / 1e18,
                    timestamp: t.timeStamp
                        ? new Date(Number(t.timeStamp) * 1000).toISOString()
                        : new Date().toISOString(),
                    direction: (t.to ?? '').toLowerCase() === address.toLowerCase()
                        ? 'inbound' as const
                        : 'outbound' as const,
                }));

                const deposits = txs.filter(t => t.direction === 'inbound');
                const withdrawals = txs.filter(t => t.direction === 'outbound');
                const latest = txs[0] ?? null;

                this.logger.log(`Etherscan: ${address} — balance=${balanceEth.toFixed(6)} ETH, txs=${txs.length}`);

                return {
                    source: 'etherscan',
                    balanceEth,
                    balanceUsd,
                    transactions: txs,
                    depositCount: deposits.length,
                    withdrawalCount: withdrawals.length,
                    latestTxHash: latest?.hash ?? null,
                    latestTxDate: latest?.timestamp ?? null,
                    latestTxAmount: latest?.amount ?? null,
                    latestTxToken: 'ETH',
                    ethPriceUsd: ethPrice,
                };
            } catch (err) {
                this.logger.warn(`Etherscan failed for ${address}: ${(err as Error).message}`);
            }
        }

        // ── Both APIs failed — return null data so caller can fall back to mock ─
        return {
            source: 'mock',
            balanceEth: null,
            balanceUsd: null,
            transactions: [],
            depositCount: 0,
            withdrawalCount: 0,
            latestTxHash: null,
            latestTxDate: null,
            latestTxAmount: null,
            latestTxToken: 'ETH',
            ethPriceUsd: ethPrice,
        };
    }
}

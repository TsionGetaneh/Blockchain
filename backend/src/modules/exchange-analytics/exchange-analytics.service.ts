import { Injectable, Logger } from '@nestjs/common';
import { EthiopianDetector } from './ethiopian-detector';
import { BlockchainDataService } from './blockchain-data.service';
import { Chain } from '../../shared/enums/chain.enum';

export type VerificationStatus = 'verified' | 'pending' | 'failed' | 'not_available';

export interface AuditField {
    field: string;
    value: string;
    verification_status: VerificationStatus;
    evidence_source: string;
    notes?: string;
}

export interface ExchangeAnalysisResult {
    exchange: string;
    userId: string;
    generatedAt: string;
    dataSource: 'live' | 'mock';
    fields: AuditField[];
}

const EXCHANGES = [
    { id: 'binance', name: 'Binance', country: 'Cayman Islands', founded: 2017, website: 'binance.com' },
    { id: 'coinbase', name: 'Coinbase', country: 'United States', founded: 2012, website: 'coinbase.com' },
    { id: 'kraken', name: 'Kraken', country: 'United States', founded: 2011, website: 'kraken.com' },
    { id: 'okx', name: 'OKX', country: 'Seychelles', founded: 2017, website: 'okx.com' },
    { id: 'bybit', name: 'Bybit', country: 'Dubai', founded: 2018, website: 'bybit.com' },
    { id: 'kucoin', name: 'KuCoin', country: 'Seychelles', founded: 2017, website: 'kucoin.com' },
    { id: 'bitget', name: 'Bitget', country: 'Seychelles', founded: 2018, website: 'bitget.com' },
    { id: 'gateio', name: 'Gate.io', country: 'Cayman Islands', founded: 2013, website: 'gate.io' },
    { id: 'htx', name: 'HTX', country: 'Seychelles', founded: 2013, website: 'htx.com' },
    { id: 'mexc', name: 'MEXC', country: 'Seychelles', founded: 2018, website: 'mexc.com' },
    { id: 'cryptocom', name: 'Crypto.com', country: 'Singapore', founded: 2016, website: 'crypto.com' },
    { id: 'gemini', name: 'Gemini', country: 'United States', founded: 2014, website: 'gemini.com' },
    { id: 'bitfinex', name: 'Bitfinex', country: 'British Virgin Islands', founded: 2012, website: 'bitfinex.com' },
    { id: 'bitstamp', name: 'Bitstamp', country: 'Luxembourg', founded: 2011, website: 'bitstamp.net' },
    { id: 'bingx', name: 'BingX', country: 'Singapore', founded: 2018, website: 'bingx.com' },
];

// ─── Seeded mock helpers (used for KYC fields that need legal process) ────────

function seededRandom(seed: string, index: number): number {
    let h = 0;
    const str = seed + index.toString();
    for (let i = 0; i < str.length; i++) {
        h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h) / 2147483647;
}

function pickStatus(seed: string, index: number, weights: VerificationStatus[]): VerificationStatus {
    const r = seededRandom(seed, index);
    return weights[Math.floor(r * weights.length)];
}

function fakeDate(seed: string, index: number, yearRange: [number, number]): string {
    const r = seededRandom(seed, index);
    const year = yearRange[0] + Math.floor(r * (yearRange[1] - yearRange[0]));
    const month = String(Math.floor(seededRandom(seed, index + 1) * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(seededRandom(seed, index + 2) * 28) + 1).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function fakeAmount(seed: string, index: number, min: number, max: number): string {
    return (min + seededRandom(seed, index) * (max - min)).toFixed(4);
}

function fakeIP(seed: string): string {
    return [1, 2, 3, 4].map(i => Math.floor(seededRandom(seed, i) * 254) + 1).join('.');
}

function fakeEthAddress(seed: string, offset: number): string {
    let h = '0x';
    for (let i = 0; i < 40; i++) h += Math.floor(seededRandom(seed + offset, i) * 16).toString(16);
    return h;
}

function fakeTxHash(seed: string, offset: number): string {
    let h = '0x';
    for (let i = 0; i < 64; i++) h += Math.floor(seededRandom(seed + offset, i + 100) * 16).toString(16);
    return h;
}

const FIRST_NAMES = ['Abebe', 'Tigist', 'Dawit', 'Hana', 'Yonas', 'Meron', 'Biruk', 'Selam', 'Tesfaye', 'Almaz'];
const LAST_NAMES = ['Tadesse', 'Bekele', 'Haile', 'Girma', 'Worku', 'Alemu', 'Kebede', 'Tesfaye', 'Mulugeta', 'Desta'];
const CITIES = ['Addis Ababa', 'Dire Dawa', 'Mekelle', 'Gondar', 'Hawassa', 'Bahir Dar', 'Adama', 'Jimma'];
const CRYPTOS = ['BTC', 'ETH', 'USDT', 'BNB', 'USDC', 'XRP', 'SOL', 'ADA'];

@Injectable()
export class ExchangeAnalyticsService {
    private readonly logger = new Logger(ExchangeAnalyticsService.name);

    constructor(private readonly blockchainData: BlockchainDataService) { }

    getExchanges() {
        return EXCHANGES;
    }

    // ─── Main audit method — async now to support live API calls ─────────────
    async getExchangeAnalysis(exchangeName: string, userId: string): Promise<ExchangeAnalysisResult> {
        const seed = `${exchangeName.toLowerCase()}-${userId}`;
        const exchange = EXCHANGES.find(e =>
            e.id === exchangeName.toLowerCase() ||
            e.name.toLowerCase() === exchangeName.toLowerCase()
        ) ?? { name: exchangeName, country: 'Unknown', founded: 2020, website: '' };

        const HIGH: VerificationStatus[] = ['verified', 'verified', 'verified', 'pending'];
        const MED: VerificationStatus[] = ['verified', 'pending', 'pending', 'failed'];
        const LOW: VerificationStatus[] = ['pending', 'failed', 'not_available', 'not_available'];
        const S = (i: number, w: VerificationStatus[]) => pickStatus(seed, i, w);

        // ── Mock KYC fields (require legal process — Fayda, ISP, exchange) ────
        const firstName = FIRST_NAMES[Math.floor(seededRandom(seed, 0) * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(seededRandom(seed, 1) * LAST_NAMES.length)];
        const fullName = `${firstName} ${lastName}`;
        const dob = fakeDate(seed, 10, [1975, 2000]);
        const city = CITIES[Math.floor(seededRandom(seed, 2) * CITIES.length)];
        const nationalId = `ETH${Math.floor(seededRandom(seed, 3) * 9000000 + 1000000)}`;
        const taxId = `TIN-${Math.floor(seededRandom(seed, 4) * 900000 + 100000)}`;
        const ip = fakeIP(seed);
        const regDate = fakeDate(seed, 13, [2020, 2024]);

        // ── Blockchain fields — real if userId is a wallet address ────────────
        const isWallet = this.blockchainData.isEvmAddress(userId);
        let liveData = null;
        let dataSource: 'live' | 'mock' = 'mock';

        if (isWallet) {
            try {
                liveData = await this.blockchainData.getWalletData(userId, Chain.ETHEREUM);
                if (liveData.source !== 'mock') {
                    dataSource = 'live';
                    this.logger.log(`Live blockchain data fetched for ${userId} via ${liveData.source}`);
                }
            } catch (err) {
                this.logger.warn(`Live data fetch failed for ${userId}: ${(err as Error).message}`);
            }
        }

        // ── Resolve blockchain field values ───────────────────────────────────
        const prices = await this.blockchainData.getPrices();

        // Wallet addresses
        const depositAddr = isWallet ? userId : fakeEthAddress(seed, 10);
        const withdrawAddr = liveData?.transactions?.find(t => t.direction === 'outbound')?.to
            ?? fakeEthAddress(seed, 20);

        // Latest transaction
        const latestTx = liveData?.transactions?.[0] ?? null;
        const txHash = latestTx?.hash ?? fakeTxHash(seed, 1);
        const txDate = latestTx?.timestamp
            ? new Date(latestTx.timestamp).toISOString().slice(0, 10)
            : fakeDate(seed, 11, [2022, 2025]);
        const txTime = latestTx?.timestamp
            ? new Date(latestTx.timestamp).toISOString().slice(11, 19) + ' UTC'
            : '14:32:07 UTC';
        const txAmountEth = latestTx?.amount ?? parseFloat(fakeAmount(seed, 7, 0.01, 5.0));
        const txToken = liveData?.latestTxToken ?? CRYPTOS[Math.floor(seededRandom(seed, 5) * CRYPTOS.length)];
        const tokenPrice = prices[txToken] ?? 1;
        const txFiatVal = (txAmountEth * tokenPrice).toFixed(2);

        // Balance
        const balanceUsd = liveData?.balanceUsd !== null && liveData?.balanceUsd !== undefined
            ? `USD ${liveData.balanceUsd.toFixed(2)}`
            : `USD ${fakeAmount(seed, 9, 500, 50000)}`;

        // Tx counts
        const depositCount = liveData?.depositCount ?? Math.floor(seededRandom(seed, 16) * 50 + 5);
        const withdrawalCount = liveData?.withdrawalCount ?? Math.floor(seededRandom(seed, 17) * 30 + 2);

        // Source label for blockchain fields
        const blockchainSource = dataSource === 'live'
            ? `Moralis API + Etherscan (live — ${liveData?.source})`
            : 'Blockchain Analytics (mock — wallet address required for live data)';

        const blockchainStatus: VerificationStatus = dataSource === 'live' ? 'verified' : S(9, HIGH);

        const fields: AuditField[] = [
            // ── KYC fields — mock until Fayda/exchange legal access ──────────
            {
                field: 'Full Legal Name',
                value: fullName,
                verification_status: S(1, HIGH),
                evidence_source: 'Fayda National ID Registry',
                notes: 'Requires inter-agency agreement with NIDA — mock data shown',
            },
            {
                field: 'Date of Birth',
                value: dob,
                verification_status: S(2, HIGH),
                evidence_source: 'Fayda Profile',
                notes: 'Requires Fayda API access — mock data shown',
            },
            {
                field: 'Residential Address',
                value: `${city}, Ethiopia`,
                verification_status: S(3, MED),
                evidence_source: 'Fayda / Bank KYC / Telecom Registration',
                notes: 'Requires utility bill cross-check — mock data shown',
            },
            {
                field: 'KYC Selfie / ID Photo',
                value: 'Photo on file at exchange',
                verification_status: S(4, MED),
                evidence_source: 'Fayda Biometric Database (Facial Recognition)',
                notes: 'Requires exchange law enforcement request — mock data shown',
            },
            {
                field: 'National ID Number',
                value: nationalId,
                verification_status: S(5, HIGH),
                evidence_source: 'Fayda / Government ID Database',
                notes: 'Requires NIDA registry query — mock data shown',
            },
            {
                field: 'Tax ID (TIN)',
                value: taxId,
                verification_status: S(6, MED),
                evidence_source: 'Ethiopian Revenue and Customs Authority (ERCA)',
                notes: 'Requires ERCA inter-agency API — mock data shown',
            },
            {
                field: 'IP Address Logs',
                value: `${ip} (Last login)`,
                verification_status: S(7, MED),
                evidence_source: 'ISP Records / Ethio Telecom',
                notes: 'Requires ISP subscriber record request — mock data shown',
            },
            {
                field: 'Device / MFA Logs',
                value: `Phone: +251-9${Math.floor(seededRandom(seed, 14) * 90000000 + 10000000)}`,
                verification_status: S(8, MED),
                evidence_source: 'Telecom Provider / IMEI Registry',
                notes: 'Requires telecom provider request — mock data shown',
            },

            // ── Blockchain fields — LIVE when wallet address is provided ──────
            {
                field: 'Wallet Deposit Address',
                value: depositAddr,
                verification_status: blockchainStatus,
                evidence_source: blockchainSource,
                notes: isWallet
                    ? `Live address provided — queried via ${liveData?.source ?? 'API'}`
                    : 'Enter a 0x wallet address as the subject to get live data',
            },
            {
                field: 'Wallet Withdrawal Address',
                value: withdrawAddr,
                verification_status: dataSource === 'live' ? 'verified' : S(10, MED),
                evidence_source: blockchainSource,
                notes: dataSource === 'live'
                    ? 'Most recent outbound transaction destination — live from blockchain'
                    : 'Enter a 0x wallet address as the subject to get live data',
            },
            {
                field: 'Transaction Hash (TXID)',
                value: dataSource === 'live' ? txHash : `${txHash.slice(0, 20)}...`,
                verification_status: dataSource === 'live' ? 'verified' : S(11, HIGH),
                evidence_source: dataSource === 'live'
                    ? `Etherscan / Moralis — live (${liveData?.source})`
                    : 'Blockchain Explorer (mock)',
                notes: dataSource === 'live'
                    ? `Latest transaction — full hash: ${txHash}`
                    : `Full hash: ${txHash}`,
            },
            {
                field: 'Transaction Date & Time',
                value: `${txDate} ${txTime}`,
                verification_status: dataSource === 'live' ? 'verified' : S(12, HIGH),
                evidence_source: dataSource === 'live'
                    ? 'Blockchain Timestamp — live'
                    : 'Blockchain Timestamp (mock)',
                notes: dataSource === 'live'
                    ? 'Timestamp from block confirmation — live data'
                    : 'Mock timestamp — provide wallet address for live data',
            },
            {
                field: 'Cryptocurrency Type & Amount',
                value: `${txAmountEth.toFixed(6)} ${txToken}`,
                verification_status: dataSource === 'live' ? 'verified' : S(13, HIGH),
                evidence_source: dataSource === 'live'
                    ? `On-chain Records — live (${liveData?.source})`
                    : 'On-chain Blockchain Records (mock)',
                notes: dataSource === 'live'
                    ? 'Amount from latest transaction — live blockchain data'
                    : 'Mock amount — provide wallet address for live data',
            },
            {
                field: 'Fiat Value at Transaction Time',
                value: `USD ${txFiatVal}`,
                verification_status: 'verified',
                evidence_source: 'CoinGecko API (live — free tier, no key required)',
                notes: `Live price: 1 ${txToken} = USD ${tokenPrice.toFixed(2)} — fetched from CoinGecko`,
            },
            {
                field: 'Account Balance',
                value: balanceUsd,
                verification_status: dataSource === 'live' ? 'verified' : S(15, MED),
                evidence_source: dataSource === 'live'
                    ? `Moralis / Etherscan — live balance (${liveData?.source})`
                    : 'Exchange Ledger / Blockchain Reserves (mock)',
                notes: dataSource === 'live'
                    ? `Live ETH balance: ${liveData?.balanceEth?.toFixed(6)} ETH at $${liveData?.ethPriceUsd}/ETH`
                    : 'Mock balance — provide wallet address for live data',
            },
            {
                field: 'Full Deposit History',
                value: `${depositCount} inbound transactions recorded`,
                verification_status: dataSource === 'live' ? 'verified' : S(16, MED),
                evidence_source: dataSource === 'live'
                    ? `Blockchain Inflows — live (${liveData?.source}, last 100 txs)`
                    : 'Blockchain Inflows (mock)',
                notes: dataSource === 'live'
                    ? `Counted from last 100 transactions via ${liveData?.source}`
                    : 'Mock count — provide wallet address for live data',
            },
            {
                field: 'Full Withdrawal History',
                value: `${withdrawalCount} outbound transactions recorded`,
                verification_status: dataSource === 'live' ? 'verified' : S(17, MED),
                evidence_source: dataSource === 'live'
                    ? `Blockchain Outflows — live (${liveData?.source}, last 100 txs)`
                    : 'Blockchain Outflows (mock)',
                notes: dataSource === 'live'
                    ? `Counted from last 100 transactions via ${liveData?.source}`
                    : 'Mock count — provide wallet address for live data',
            },

            // ── Exchange-internal fields — always need legal request ───────────
            {
                field: 'Trade / Swap History',
                value: `${Math.floor(seededRandom(seed, 18) * 200 + 10)} trades on record`,
                verification_status: S(18, LOW),
                evidence_source: 'Exchange Order Books / Internal Logs',
                notes: 'Requires formal legal request to exchange law enforcement portal',
            },
            {
                field: 'Support Ticket Communications',
                value: `${Math.floor(seededRandom(seed, 19) * 10 + 1)} tickets found`,
                verification_status: S(19, LOW),
                evidence_source: 'Exchange Support System / Email Metadata',
                notes: 'Requires formal legal request to exchange',
            },
            {
                field: 'Onboarding Verification Report',
                value: `KYC completed ${regDate}`,
                verification_status: S(20, HIGH),
                evidence_source: 'KYC Vendor (Jumio / Onfido)',
                notes: 'Requires exchange law enforcement request — mock date shown',
            },
            {
                field: 'Incorporation Documents',
                value: seededRandom(seed, 21) > 0.7 ? 'Corporate account — docs on file' : 'Individual account — N/A',
                verification_status: seededRandom(seed, 21) > 0.7 ? S(21, MED) : 'not_available',
                evidence_source: 'Business Registration Authority',
                notes: 'Requires Ethiopian Investment Commission validation',
            },
            {
                field: 'Beneficial Ownership Information',
                value: seededRandom(seed, 22) > 0.7 ? `Ultimate beneficial owner: ${fullName}` : 'Individual account',
                verification_status: seededRandom(seed, 22) > 0.7 ? S(22, MED) : 'not_available',
                evidence_source: 'Company Registry / Shareholder Database',
                notes: 'Requires national company registry cross-reference',
            },
        ];

        return {
            exchange: exchange.name,
            userId,
            generatedAt: new Date().toISOString(),
            dataSource,
            fields,
        };
    }

    // ─── Bulk mock user generation ────────────────────────────────────────────
    generateBulkMockUsers(exchangeName: string, count = 200): Record<string, string>[] {
        const seed = `bulk-${exchangeName}`;
        const ETH_IPS = ['196.188.', '196.189.', '41.66.', '41.67.'];
        const GLOBAL_COUNTRIES = ['US', 'GB', 'DE', 'NG', 'KE', 'ZA', 'IN', 'BR', 'TR', 'PH', 'VN', 'ID', 'MX', 'AR'];
        const GLOBAL_CITIES = ['New York', 'London', 'Berlin', 'Lagos', 'Nairobi', 'Mumbai', 'São Paulo', 'Istanbul'];
        const GLOBAL_NAMES = [
            ['John', 'Smith'], ['Maria', 'Garcia'], ['Wei', 'Zhang'], ['Amara', 'Osei'],
            ['Fatima', 'Al-Hassan'], ['Raj', 'Patel'], ['Ana', 'Silva'], ['Kenji', 'Tanaka'],
            ['Olga', 'Petrov'], ['Carlos', 'Lopez'], ['Aisha', 'Mwangi'], ['Ivan', 'Novak'],
        ];

        const users: Record<string, string>[] = [];

        for (let i = 0; i < count; i++) {
            const r = seededRandom(seed, i * 7);
            const isEthiopian = r < 0.30;

            if (isEthiopian) {
                const fn = FIRST_NAMES[Math.floor(seededRandom(seed, i * 7 + 1) * FIRST_NAMES.length)];
                const ln = LAST_NAMES[Math.floor(seededRandom(seed, i * 7 + 2) * LAST_NAMES.length)];
                const city = CITIES[Math.floor(seededRandom(seed, i * 7 + 3) * CITIES.length)];
                const ipPrefix = ETH_IPS[Math.floor(seededRandom(seed, i * 7 + 4) * ETH_IPS.length)];
                const ipSuffix = `${Math.floor(seededRandom(seed, i * 7 + 5) * 254) + 1}.${Math.floor(seededRandom(seed, i * 7 + 6) * 254) + 1}`;
                const phone = `+2519${Math.floor(seededRandom(seed, i * 7 + 7) * 90000000 + 10000000)}`;
                const nid = `ETH${Math.floor(seededRandom(seed, i * 7 + 8) * 9000000 + 1000000)}`;
                const tin = `TIN-${Math.floor(seededRandom(seed, i * 7 + 9) * 900000 + 100000)}`;

                users.push({
                    user_id: `USR-${exchangeName.toUpperCase().slice(0, 3)}-${String(i).padStart(5, '0')}`,
                    full_name: `${fn} ${ln}`,
                    first_name: fn,
                    last_name: ln,
                    email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@gmail.com`,
                    phone,
                    country: 'ET',
                    nationality: 'Ethiopian',
                    kyc_country: 'ET',
                    address: `${city}, Ethiopia`,
                    city,
                    national_id: nid,
                    tax_id: tin,
                    ip_address: `${ipPrefix}${ipSuffix}`,
                    ip_country: 'ET',
                    timezone: 'Africa/Addis_Ababa',
                    locale: 'am',
                    fiat_currency: 'ETB',
                    registration_date: fakeDate(seed, i * 7 + 10, [2020, 2025]),
                    kyc_status: seededRandom(seed, i * 7 + 11) > 0.2 ? 'verified' : 'pending',
                    account_balance_usd: fakeAmount(seed, i * 7 + 12, 50, 25000),
                });
            } else {
                const namePair = GLOBAL_NAMES[Math.floor(seededRandom(seed, i * 7 + 1) * GLOBAL_NAMES.length)];
                const country = GLOBAL_COUNTRIES[Math.floor(seededRandom(seed, i * 7 + 2) * GLOBAL_COUNTRIES.length)];
                const city = GLOBAL_CITIES[Math.floor(seededRandom(seed, i * 7 + 3) * GLOBAL_CITIES.length)];
                const ipA = Math.floor(seededRandom(seed, i * 7 + 4) * 200) + 50;
                const ipB = Math.floor(seededRandom(seed, i * 7 + 5) * 254) + 1;
                const ipC = Math.floor(seededRandom(seed, i * 7 + 6) * 254) + 1;
                const ipD = Math.floor(seededRandom(seed, i * 7 + 7) * 254) + 1;

                users.push({
                    user_id: `USR-${exchangeName.toUpperCase().slice(0, 3)}-${String(i).padStart(5, '0')}`,
                    full_name: `${namePair[0]} ${namePair[1]}`,
                    first_name: namePair[0],
                    last_name: namePair[1],
                    email: `${namePair[0].toLowerCase()}${i}@email.com`,
                    phone: `+1${Math.floor(seededRandom(seed, i * 7 + 8) * 9000000000 + 1000000000)}`,
                    country,
                    nationality: country,
                    kyc_country: country,
                    address: city,
                    city,
                    national_id: `ID-${Math.floor(seededRandom(seed, i * 7 + 9) * 9000000 + 1000000)}`,
                    tax_id: `TAX-${Math.floor(seededRandom(seed, i * 7 + 10) * 900000 + 100000)}`,
                    ip_address: `${ipA}.${ipB}.${ipC}.${ipD}`,
                    ip_country: country,
                    timezone: 'UTC',
                    locale: 'en',
                    fiat_currency: 'USD',
                    registration_date: fakeDate(seed, i * 7 + 11, [2019, 2025]),
                    kyc_status: 'verified',
                    account_balance_usd: fakeAmount(seed, i * 7 + 12, 100, 100000),
                });
            }
        }

        return users;
    }

    // ─── Ethiopian filter ─────────────────────────────────────────────────────
    filterEthiopians(exchangeName: string, count = 200): {
        totalScanned: number;
        ethiopiansFound: number;
        detectionRate: string;
        users: Array<{
            user: Record<string, string>;
            confidenceScore: number;
            recommendation: string;
            matchedSignals: string[];
            auditRecord: ExchangeAnalysisResult;
        }>;
    } {
        const detector = new EthiopianDetector();
        const allUsers = this.generateBulkMockUsers(exchangeName, count);
        const ethiopians = detector.filterEthiopians(allUsers);

        const users = ethiopians.map(({ record, detection }: any) => ({
            user: record,
            confidenceScore: detection.confidenceScore,
            recommendation: detection.recommendation,
            matchedSignals: detection.matchedSignals,
            auditRecord: this._mockAuditRecord(exchangeName, record.user_id ?? record.email ?? 'unknown'),
        }));

        return {
            totalScanned: allUsers.length,
            ethiopiansFound: users.length,
            detectionRate: `${((users.length / allUsers.length) * 100).toFixed(1)}%`,
            users,
        };
    }

    // ─── Synchronous mock audit record (used by filterEthiopians) ────────────
    private _mockAuditRecord(exchangeName: string, userId: string): ExchangeAnalysisResult {
        const seed = `${exchangeName.toLowerCase()}-${userId}`;
        const exchange = EXCHANGES.find(e =>
            e.id === exchangeName.toLowerCase() ||
            e.name.toLowerCase() === exchangeName.toLowerCase()
        ) ?? { name: exchangeName };

        const HIGH: VerificationStatus[] = ['verified', 'verified', 'verified', 'pending'];
        const MED: VerificationStatus[] = ['verified', 'pending', 'pending', 'failed'];
        const S = (i: number, w: VerificationStatus[]) => pickStatus(seed, i, w);

        const firstName = FIRST_NAMES[Math.floor(seededRandom(seed, 0) * FIRST_NAMES.length)];
        const lastName = LAST_NAMES[Math.floor(seededRandom(seed, 1) * LAST_NAMES.length)];
        const fullName = `${firstName} ${lastName}`;
        const dob = fakeDate(seed, 10, [1975, 2000]);
        const city = CITIES[Math.floor(seededRandom(seed, 2) * CITIES.length)];
        const nationalId = `ETH${Math.floor(seededRandom(seed, 3) * 9000000 + 1000000)}`;
        const taxId = `TIN-${Math.floor(seededRandom(seed, 4) * 900000 + 100000)}`;
        const depositAddr = fakeEthAddress(seed, 10);
        const withdrawAddr = fakeEthAddress(seed, 20);
        const txHash = fakeTxHash(seed, 1);
        const crypto1 = CRYPTOS[Math.floor(seededRandom(seed, 5) * CRYPTOS.length)];
        const amount1 = parseFloat(fakeAmount(seed, 7, 0.01, 5.0));
        const fiatVal = (amount1 * (crypto1 === 'BTC' ? 65000 : crypto1 === 'ETH' ? 3200 : 1)).toFixed(2);
        const balance = fakeAmount(seed, 9, 500, 50000);
        const ip = fakeIP(seed);
        const txDate = fakeDate(seed, 11, [2022, 2025]);
        const regDate = fakeDate(seed, 13, [2020, 2024]);

        return {
            exchange: exchange.name,
            userId,
            generatedAt: new Date().toISOString(),
            dataSource: 'mock',
            fields: [
                { field: 'Full Legal Name', value: fullName, verification_status: S(1, HIGH), evidence_source: 'Fayda National ID Registry', notes: 'Mock data' },
                { field: 'Date of Birth', value: dob, verification_status: S(2, HIGH), evidence_source: 'Fayda Profile', notes: 'Mock data' },
                { field: 'Residential Address', value: `${city}, Ethiopia`, verification_status: S(3, MED), evidence_source: 'Fayda / Bank KYC', notes: 'Mock data' },
                { field: 'National ID Number', value: nationalId, verification_status: S(5, HIGH), evidence_source: 'Fayda / Government ID Database', notes: 'Mock data' },
                { field: 'Tax ID (TIN)', value: taxId, verification_status: S(6, MED), evidence_source: 'ERCA', notes: 'Mock data' },
                { field: 'IP Address Logs', value: `${ip} (Last login)`, verification_status: S(7, MED), evidence_source: 'ISP Records / Ethio Telecom', notes: 'Mock data' },
                { field: 'Wallet Deposit Address', value: depositAddr, verification_status: S(9, HIGH), evidence_source: 'Blockchain Analytics (mock)', notes: 'Mock data' },
                { field: 'Wallet Withdrawal Address', value: withdrawAddr, verification_status: S(10, MED), evidence_source: 'Blockchain Analytics (mock)', notes: 'Mock data' },
                { field: 'Transaction Hash (TXID)', value: `${txHash.slice(0, 20)}...`, verification_status: S(11, HIGH), evidence_source: 'Blockchain Explorer (mock)', notes: `Full: ${txHash}` },
                { field: 'Transaction Date & Time', value: `${txDate} 14:32:07 UTC`, verification_status: S(12, HIGH), evidence_source: 'Blockchain Timestamp (mock)', notes: 'Mock data' },
                { field: 'Cryptocurrency Type & Amount', value: `${amount1.toFixed(6)} ${crypto1}`, verification_status: S(13, HIGH), evidence_source: 'On-chain Records (mock)', notes: 'Mock data' },
                { field: 'Fiat Value at Transaction Time', value: `USD ${fiatVal}`, verification_status: 'verified', evidence_source: 'CoinGecko (hardcoded fallback)', notes: 'Mock data' },
                { field: 'Account Balance', value: `USD ${balance}`, verification_status: S(15, MED), evidence_source: 'Exchange Ledger (mock)', notes: 'Mock data' },
                { field: 'Onboarding Verification Report', value: `KYC completed ${regDate}`, verification_status: S(20, HIGH), evidence_source: 'KYC Vendor (Jumio / Onfido)', notes: 'Mock data' },
            ],
        };
    }
}

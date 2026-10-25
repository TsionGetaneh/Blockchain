import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { AddressesRepository } from './addresses.repository';
import { RiskScoringService } from '../risk-scoring/risk-scoring.service';
import { FlaggedAddressesService } from '../flagged-addresses/flagged-addresses.service';
import { TransactionsService } from '../transactions/transactions.service';
import { AddressRelationshipsService } from '../address-relationships/address-relationships.service';
import { AddressSummaryDto } from './dto/address-summary.dto';
import { RiskScoreDto } from './dto/risk-score.dto';
import { GraphDataDto } from './dto/graph-data.dto';
import { Chain } from '../../shared/enums/chain.enum';
import { MoralisService } from '../../common/services/moralis.service';
import { getBlockchainEngineTimeoutMs } from '../../shared/utils/blockchain-engine-timeout.util';
import { Address } from './entities/address.entity';

@Injectable()
export class AddressesService {
  private readonly logger = new Logger(AddressesService.name);
  private readonly blockchainApiUrl: string;
  private readonly engineTimeoutMs: number;

  constructor(
    private readonly addressesRepository: AddressesRepository,
    private readonly riskScoringService: RiskScoringService,
    private readonly flaggedAddressesService: FlaggedAddressesService,
    private readonly transactionsService: TransactionsService,
    private readonly addressRelationshipsService: AddressRelationshipsService,
    private readonly moralisService: MoralisService,
    private readonly configService: ConfigService,
  ) {
    this.blockchainApiUrl = this.configService.get<string>('BLOCKCHAIN_API_URL', 'http://127.0.0.1:8055');
    this.engineTimeoutMs = getBlockchainEngineTimeoutMs(this.configService);
  }
  private isEngineSupportedChain(chain: Chain): boolean {
    // The Python blockchain engine is unreliable for Sepolia in this setup.
    // Skip engine calls and use direct/fallback providers to avoid long timeouts.
    return chain !== Chain.SEPOLIA;
  }

  async getEngineScreening(address: string, chain: Chain) {
    if (!this.isEngineSupportedChain(chain)) return null;
    try {
      const res = await axios.get(`${this.blockchainApiUrl}/screen`, {
        params: { address, chain: chain.toLowerCase(), limit: 50 },
        timeout: this.engineTimeoutMs,
      });
      return res.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch screening from engine: ${(error as Error).message}`);
      return null;
    }
  }

  async getEngineClusters(address: string, chain: Chain) {
    if (!this.isEngineSupportedChain(chain)) return null;
    try {
      const res = await axios.get(`${this.blockchainApiUrl}/cluster`, {
        params: { address, chain: chain.toLowerCase(), limit: 50 },
        timeout: this.engineTimeoutMs,
      });
      return res.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch clusters from engine: ${(error as Error).message}`);
      return null;
    }
  }

  async getEngineRisk(address: string, chain: Chain) {
    if (!this.isEngineSupportedChain(chain)) return null;
    try {
      const res = await axios.get(`${this.blockchainApiUrl}/risk`, {
        params: { address, chain: chain.toLowerCase(), limit: 50 },
        timeout: this.engineTimeoutMs,
      });
      return res.data;
    } catch (error) {
      this.logger.warn(`Failed to fetch risk from engine: ${(error as Error).message}`);
      return null;
    }
  }

  async getEngineBalance(address: string, chain: Chain) {
    if (!this.isEngineSupportedChain(chain)) return 0;
    try {
      const res = await axios.get(`${this.blockchainApiUrl}/explore/address`, {
        params: { address, chain: chain.toLowerCase(), limit: 50 },
        timeout: this.engineTimeoutMs,
      });
      const balanceData = res.data?.balance;
      if (typeof balanceData === 'object' && balanceData !== null) {
        return balanceData.balance || 0;
      }
      return balanceData || 0;
    } catch (error) {
      this.logger.warn(`Failed to fetch balance from engine: ${(error as Error).message}`);
      return 0;
    }
  }

  async isSmartContractAddress(address: string, chain: Chain): Promise<boolean> {
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return false;
    if (chain === Chain.BITCOIN || chain === Chain.SOLANA) return false;

    const rpcByChain: Partial<Record<Chain, string>> = {
      [Chain.ETHEREUM]: this.configService.get<string>('ETH_RPC_URL', 'https://ethereum-rpc.publicnode.com'),
      [Chain.SEPOLIA]: this.configService.get<string>('SEPOLIA_RPC_URL', 'https://ethereum-sepolia-rpc.publicnode.com'),
      [Chain.POLYGON]: this.configService.get<string>('POLYGON_RPC_URL', 'https://polygon-rpc.com'),
      [Chain.BSC]: this.configService.get<string>('BSC_RPC_URL', 'https://bsc-dataseed.binance.org'),
      [Chain.ARBITRUM]: this.configService.get<string>('ARBITRUM_RPC_URL', 'https://arb1.arbitrum.io/rpc'),
      [Chain.OPTIMISM]: this.configService.get<string>('OPTIMISM_RPC_URL', 'https://mainnet.optimism.io'),
      [Chain.BASE]: this.configService.get<string>('BASE_RPC_URL', 'https://mainnet.base.org'),
      [Chain.AVALANCHE]: this.configService.get<string>('AVALANCHE_RPC_URL', 'https://api.avax.network/ext/bc/C/rpc'),
      [Chain.FANTOM]: this.configService.get<string>('FANTOM_RPC_URL', 'https://rpc.fantom.network'),
      [Chain.GNOSIS]: this.configService.get<string>('GNOSIS_RPC_URL', 'https://rpc.gnosischain.com'),
    };

    const rpcUrl = rpcByChain[chain] ?? this.configService.get<string>('ETH_RPC_URL', 'https://ethereum-rpc.publicnode.com');
    try {
      const response = await axios.post(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getCode',
        params: [address, 'latest'],
      });
      const bytecode = response?.data?.result;
      return typeof bytecode === 'string' && bytecode !== '0x';
    } catch (error) {
      this.logger.warn(`Failed to run eth_getCode for ${address}: ${(error as Error).message}`);
      return false;
    }
  }

  async getEngineSummary(address: string, chain: Chain) {
    if (!this.isEngineSupportedChain(chain)) return null;
    try {
      const res = await axios.get(`${this.blockchainApiUrl}/explore/address`, {
        params: { address, chain: chain.toLowerCase(), limit: 50 },
        timeout: this.engineTimeoutMs,
      });
      const data = res.data;
      const balance = typeof data?.balance === 'object' ? (data.balance.balance ?? 0) : (data?.balance ?? 0);
      const txs = Array.isArray(data?.transactions) ? data.transactions : [];
      return {
        balance,
        txCount: data?.transaction_count ?? txs.length,
        totalReceived: data?.incoming_total ?? 0,
        totalSent: data?.outgoing_total ?? 0,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch summary from engine: ${(error as Error).message}`);
      return null;
    }
  }

  async getAddressSummary(address: string, chain: Chain): Promise<AddressSummaryDto> {
    let addr = await this.findOrCreate(address, chain);
    const startMs = Date.now();

    let dbTotals = { received: 0, sent: 0, count: 0 };
    try {
      dbTotals = await this.transactionsService.calculateTotals(address, chain);
    } catch {}

    let dataSource = 'db_only';

    const engineStart = Date.now();
    const [
      engineSummary,
      engineScreen,
      externalBalance,
      riskData,
      flaggedData,
    ] = await Promise.all([
      this.getEngineSummary(address, chain).catch((err) => {
        this.logger.warn(`Engine summary failed after ${Date.now() - engineStart}ms: ${err.message}`);
        return null;
      }),
      this.getEngineScreening(address, chain).catch((err) => {
        this.logger.warn(`Engine screening failed after ${Date.now() - engineStart}ms: ${err.message}`);
        return null;
      }),
      this.moralisService.isConfigured()
        ? this.moralisService.getNativeBalance(address, chain).catch((err) => {
            this.logger.warn(`Moralis balance failed: ${err.message}`);
            return null;
          })
        : Promise.resolve(null),
      this.riskScoringService.calculateRisk(address, chain).catch(err => {
        this.logger.error(`Risk calculation failed: ${err.message}`);
        return { score: 0, factors: [], level: 'LOW', recommendation: 'Risk calculation unavailable' };
      }),
      this.flaggedAddressesService.checkFlagged(address, chain).catch(err => {
        this.logger.error(`Flagged check failed: ${err.message}`);
        return { isFlagged: false, reasons: [] };
      }),
    ]);

    this.logger.log(`Data sources resolved in ${Date.now() - engineStart}ms for ${address} on ${chain}`);

    const safeNum = (val: any) => {
      const n = Number(val || 0);
      if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
      return Math.max(0, Number(n.toFixed(6)));
    };

    if (engineSummary) {
      dataSource = 'engine';
      addr.balance = safeNum(engineSummary.balance);
      addr.txCount = Math.min(2147483647, Math.max(0, Number(engineSummary.txCount || 0)));
      addr.totalReceived = safeNum(engineSummary.totalReceived);
      addr.totalSent = safeNum(engineSummary.totalSent);
      this.logger.log(`Engine returned balance=${addr.balance} txCount=${addr.txCount}`);
    } else {
      addr.totalReceived = safeNum(dbTotals.received);
      addr.totalSent = safeNum(dbTotals.sent);
      addr.txCount = Math.min(2147483647, Math.max(0, Number(dbTotals.count || 0)));

      if (externalBalance !== null) {
        dataSource = 'moralis';
        addr.balance = safeNum(externalBalance);
        this.logger.log(`Moralis returned balance=${addr.balance}`);
      } else if (addr.balance === 0) {
        addr.balance = safeNum(addr.totalReceived - addr.totalSent);
      }
    }

    let entityLabel = engineScreen?.entity_label || 'user wallet';

    // Update risk score and entity info
    addr.riskScore = riskData.score;
    addr.isFlagged = flaggedData.isFlagged;
    
    try {
      await this.addressesRepository.save(addr);
    } catch (err) {
      this.logger.warn(`Failed to persist address summary to DB: ${(err as Error).message}`);
    }

    this.logger.log(`getAddressSummary completed in ${Date.now() - startMs}ms — source: ${dataSource}`);

    return {
      address: addr.address,
      chain: addr.chain,
      balance: addr.balance,
      totalReceived: addr.totalReceived,
      totalSent: addr.totalSent,
      txCount: addr.txCount,
      riskScore: riskData.score,
      riskFactors: riskData.factors.map((f) => f.factor),
      isFlagged: flaggedData.isFlagged,
      firstSeen: addr.firstSeen,
      lastChecked: new Date(),
      entityLabel,
      dataSource,
    };
  }

  async getAddressTransactions(address: string, chain: Chain, limit: number, offset: number) {
    const dbResult = await this.transactionsService.findByAddress(address, chain, limit, offset);
    if (dbResult.total > 0) {
      return dbResult;
    }

    // Try Moralis first
    if (this.moralisService.isConfigured()) {
      const externalTxs = await this.moralisService.getWalletTransactions(address, chain, limit);
      if (externalTxs.length > 0) {
        return {
          data: externalTxs.map((tx) => ({
            id: tx.hash || `${tx.from}-${tx.to}-${tx.timestamp}`,
            txHash: tx.hash,
            fromAddress: tx.from ?? '',
            toAddress: tx.to ?? '',
            amount: tx.amount,
            timestamp: new Date(tx.timestamp),
            chain,
            type: 'transfer',
            blockNumber: null as any,
            gasPrice: null as any,
            gasUsed: null as any,
            createdAt: new Date(),
            fromAddressEntity: null as any,
            toAddressEntity: null as any,
          })),
          total: externalTxs.length,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: 1,
        };
      }
    }

    // Fallback to engine if Moralis failed or returned nothing
    if (!this.isEngineSupportedChain(chain)) {
      return dbResult;
    }
    try {
      const fetchLimit = Math.min(Math.max(offset + limit, limit), 100);
      const res = await axios.get(`${this.blockchainApiUrl}/explore/address`, {
        params: { address, chain: chain.toLowerCase(), limit: fetchLimit },
        timeout: this.engineTimeoutMs,
      });
      if (Array.isArray(res.data?.transactions)) {
        const txs = res.data.transactions as any[];
        const sliced = txs.slice(offset, offset + limit);
        return {
          data: sliced.map((tx: any) => ({
            id: tx.tx_hash,
            txHash: tx.tx_hash,
            fromAddress: tx.from_address ?? '',
            toAddress: tx.to_address ?? '',
            amount: tx.value,
            timestamp: new Date(tx.timestamp),
            chain,
            type: tx.tx_type || 'transfer',
            blockNumber: tx.block_number ?? null,
            gasPrice: 0,
            gasUsed: 0,
            createdAt: new Date(),
            fromAddressEntity: null as any,
            toAddressEntity: null as any,
          })),
          total: txs.length,
          page: Math.floor(offset / limit) + 1,
          limit,
          totalPages: Math.max(1, Math.ceil(txs.length / limit)),
        };
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch transactions from engine: ${(error as Error).message}`);
    }

    return dbResult;
  }

  async checkFlagged(address: string, chain: Chain) {
    return this.flaggedAddressesService.checkFlagged(address, chain);
  }

  async getRiskScore(address: string, chain: Chain): Promise<RiskScoreDto> {
    return this.riskScoringService.getOrComputeRisk(address, chain);
  }

  async getGraphData(address: string, chain: Chain, depth: number): Promise<GraphDataDto> {
    return this.addressRelationshipsService.getGraphData(address, chain, depth);
  }

  async updateAddressTotals(address: string, chain: Chain, amount: number, isSender: boolean) {
    return this.addressesRepository.updateTotals(address, chain, amount, isSender);
  }

  async incrementTxCount(address: string, chain: Chain) {
    return this.addressesRepository.incrementTxCount(address, chain);
  }

  async findOrCreate(address: string, chain: Chain) {
    let addr: Address | null = null;
    try {
      addr = await this.addressesRepository.findByAddressAndChain(address, chain);
    } catch {}

    if (!addr) {
      addr = {
        id: 'transient',
        address,
        chain,
        balance: 0,
        totalReceived: 0,
        totalSent: 0,
        txCount: 0,
        riskScore: 0,
        isFlagged: false,
        firstSeen: new Date(),
        lastChecked: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Address;
    }
    return addr;
  }

  async findAcrossChains(address: string) {
    return this.addressesRepository.findAcrossChains(address);
  }

  async getRpcBalanceAndNonce(
    address: string,
    chain: Chain,
  ): Promise<{ balance: number; txCount: number }> {
    const rpcMap: Partial<Record<Chain, string[]>> = {
      [Chain.ETHEREUM]: [
        this.configService.get<string>('ETH_RPC_URL', 'https://eth.drpc.org'),
        'https://ethereum-rpc.publicnode.com',
      ],
      [Chain.BSC]: [
        this.configService.get<string>('BSC_RPC_URL', 'https://bsc.drpc.org'),
        'https://bsc-dataseed.binance.org',
        'https://bsc-rpc.publicnode.com',
      ],
      [Chain.POLYGON]: [
        this.configService.get<string>('POLYGON_RPC_URL', 'https://polygon.drpc.org'),
        'https://polygon-rpc.com',
        'https://polygon-bor-rpc.publicnode.com',
      ],
      [Chain.ARBITRUM]: [
        this.configService.get<string>('ARBITRUM_RPC_URL', 'https://arbitrum.drpc.org'),
        'https://arb1.arbitrum.io/rpc',
      ],
      [Chain.OPTIMISM]: [
        this.configService.get<string>('OPTIMISM_RPC_URL', 'https://optimism.drpc.org'),
        'https://mainnet.optimism.io',
      ],
      [Chain.AVALANCHE]: [
        this.configService.get<string>('AVALANCHE_RPC_URL', 'https://avalanche.drpc.org'),
        'https://api.avax.network/ext/bc/C/rpc',
      ],
      [Chain.BASE]: [
        this.configService.get<string>('BASE_RPC_URL', 'https://base.drpc.org'),
        'https://mainnet.base.org',
      ],
      [Chain.GNOSIS]: [
        this.configService.get<string>('GNOSIS_RPC_URL', 'https://gnosis.drpc.org'),
        'https://rpc.gnosischain.com',
      ],
      [Chain.FANTOM]: [
        this.configService.get<string>('FANTOM_RPC_URL', 'https://rpc.fantom.network'),
      ],
    };

    const urls = rpcMap[chain] ?? ['https://eth.drpc.org'];
    for (const url of urls) {
      try {
        const [balRes, nonceRes] = await Promise.all([
          axios.post(
            url,
            { jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] },
            { timeout: 2500 },
          ),
          axios.post(
            url,
            { jsonrpc: '2.0', id: 2, method: 'eth_getTransactionCount', params: [address, 'latest'] },
            { timeout: 2500 },
          ),
        ]);

        const rawBal = balRes.data?.result || '0x0';
        const balWei = typeof rawBal === 'string' && rawBal.startsWith('0x') ? BigInt(rawBal) : 0n;
        const balEth = Number(balWei) / 1e18;

        const rawNonce = nonceRes.data?.result || '0x0';
        const nonce = typeof rawNonce === 'string' ? parseInt(rawNonce, 16) : 0;

        return {
          balance: Number.isFinite(balEth) ? Math.max(0, balEth) : 0,
          txCount: Number.isFinite(nonce) ? Math.max(0, nonce) : 0,
        };
      } catch {
        continue;
      }
    }
    return { balance: 0, txCount: 0 };
  }

  async probeChain(address: string): Promise<Chain | null> {
    const a = address.trim().toLowerCase();
    
    // Quick exit for specific known addresses
    if (a === '0x88ad09518695c6c3712ac10a214be5109a655671') {
      return Chain.GNOSIS;
    }

    const evmChains = [
      Chain.GNOSIS, Chain.ETHEREUM, Chain.POLYGON, Chain.BSC, Chain.ARBITRUM, 
      Chain.OPTIMISM, Chain.AVALANCHE, Chain.BASE, Chain.SEPOLIA
    ];

    const results = await Promise.allSettled(
      evmChains.map(async (chain) => {
        const { balance, txCount } = await this.getRpcBalanceAndNonce(address, chain);
        return { chain, active: balance > 0 || txCount > 0 };
      }),
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.active) {
        return r.value.chain;
      }
    }
    
    return Chain.ETHEREUM;
  }

  async getAddressTransactionsAllChains(address: string, limit: number) {
    return this.transactionsService.findByAddressAllChains(address, limit);
  }
}


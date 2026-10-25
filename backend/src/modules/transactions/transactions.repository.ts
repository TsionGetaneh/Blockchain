import { Injectable } from '@nestjs/common';
import { Repository, DataSource, Brackets } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { Chain } from '../../shared/enums/chain.enum';
import { AddressValidator } from '../../shared/utils/address-validator.util';

@Injectable()
export class TransactionsRepository {
  private repository: Repository<Transaction>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Transaction);
  }

  async findByTxHash(txHash: string): Promise<Transaction | null> {
    const result = await this.repository.findOne({ where: { txHash } });
    return result ?? null;
  }

  async findByTxHashAndChain(txHash: string, chain: Chain): Promise<Transaction | null> {
    const result = await this.repository.findOne({ where: { txHash, chain } });
    return result ?? null;
  }

  async findByAddress(
    address: string,
    chain: Chain,
    limit: number,
    offset: number,
  ): Promise<[Transaction[], number]> {
    const qb = this.repository
      .createQueryBuilder('tx')
      .where('tx.chain = :chain', { chain })
      .andWhere(
        new Brackets((b) => {
          if (AddressValidator.isValidEthereumAddress(address)) {
            b.where('LOWER(tx.fromAddress) = LOWER(:address)', { address }).orWhere(
              'LOWER(tx.toAddress) = LOWER(:address)',
              { address },
            );
          } else {
            b.where('tx.fromAddress = :address', { address }).orWhere('tx.toAddress = :address', {
              address,
            });
          }
        }),
      )
      .orderBy('tx.timestamp', 'DESC')
      .skip(offset)
      .take(limit);
    return qb.getManyAndCount();
  }

  async create(data: Partial<Transaction>): Promise<Transaction> {
    const sanitize = (val: any) => {
      const n = Number(val || 0);
      if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
      return Math.min(99999999999, Math.max(0, Number(n.toFixed(8))));
    };
    if (data.amount !== undefined) data.amount = sanitize(data.amount);
    if (data.gasPrice !== undefined) data.gasPrice = sanitize(data.gasPrice);
    const transaction = this.repository.create(data);
    return this.repository.save(transaction);
  }

  async findRecentByAddress(address: string, chain: Chain, since: Date): Promise<Transaction[]> {
    return this.repository
      .createQueryBuilder('tx')
      .where('tx.chain = :chain', { chain })
      .andWhere(
        new Brackets((b) => {
          if (AddressValidator.isValidEthereumAddress(address)) {
            b.where('LOWER(tx.fromAddress) = LOWER(:address)', { address }).orWhere(
              'LOWER(tx.toAddress) = LOWER(:address)',
              { address },
            );
          } else {
            b.where('tx.fromAddress = :address', { address }).orWhere('tx.toAddress = :address', {
              address,
            });
          }
        }),
      )
      .andWhere('tx.timestamp >= :since', { since })
      .orderBy('tx.timestamp', 'DESC')
      .getMany();
  }

  async findByFromTo(fromAddress: string, toAddress: string, chain: Chain): Promise<Transaction[]> {
    return this.repository.find({
      where: { fromAddress, toAddress, chain },
      order: { timestamp: 'DESC' },
    });
  }

  async calculateTotalsByAddress(address: string, chain: Chain): Promise<{ received: number; sent: number; count: number }> {
    try {
      const isEth = AddressValidator.isValidEthereumAddress(address);
      const addr = isEth ? address.toLowerCase() : address;

      const query = this.repository.createQueryBuilder('tx')
        .select('CAST(COALESCE(SUM(CASE WHEN ' + (isEth ? 'LOWER(tx.toAddress)' : 'tx.toAddress') + ' = :addr THEN tx.amount ELSE 0 END), 0) AS DOUBLE PRECISION)', 'received')
        .addSelect('CAST(COALESCE(SUM(CASE WHEN ' + (isEth ? 'LOWER(tx.fromAddress)' : 'tx.fromAddress') + ' = :addr THEN tx.amount ELSE 0 END), 0) AS DOUBLE PRECISION)', 'sent')
        .addSelect('COUNT(*)', 'count')
        .where('tx.chain = :chain', { chain })
        .andWhere(new Brackets(qb => {
          if (isEth) {
            qb.where('LOWER(tx.fromAddress) = :addr', { addr })
              .orWhere('LOWER(tx.toAddress) = :addr', { addr });
          } else {
            qb.where('tx.fromAddress = :addr', { addr })
              .orWhere('tx.toAddress = :addr', { addr });
          }
        }));

      const result = await query.getRawOne();
      return {
        received: Number(result?.received || 0),
        sent: Number(result?.sent || 0),
        count: Number(result?.count || 0),
      };
    } catch {
      return { received: 0, sent: 0, count: 0 };
    }
  }

  async findByAddressAllChains(address: string, limit: number): Promise<Transaction[]> {
    return this.repository
      .createQueryBuilder('tx')
      .andWhere(
        new Brackets((b) => {
          if (AddressValidator.isValidEthereumAddress(address)) {
            b.where('LOWER(tx.fromAddress) = LOWER(:address)', { address }).orWhere(
              'LOWER(tx.toAddress) = LOWER(:address)',
              { address },
            );
          } else {
            b.where('tx.fromAddress = :address', { address }).orWhere('tx.toAddress = :address', {
              address,
            });
          }
        }),
      )
      .orderBy('tx.timestamp', 'DESC')
      .take(limit)
      .getMany();
  }
}

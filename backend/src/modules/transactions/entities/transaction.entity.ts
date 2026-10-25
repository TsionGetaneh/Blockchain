import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Chain } from '../../../shared/enums/chain.enum';

@Entity('transactions')
@Index(['txHash', 'chain'], { unique: true })
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', name: 'tx_hash', length: 255 })
  @Index()
  txHash: string;

  @Column({ type: 'varchar', name: 'from_address', length: 255 })
  @Index()
  fromAddress: string;

  @Column({ type: 'varchar', name: 'to_address', length: 255 })
  @Index()
  toAddress: string;

  @Column({ type: 'float', default: 0 })
  amount: number;

  @Column({ type: 'timestamp' })
  timestamp: Date;

  @Column({
    type: 'enum',
    enum: Chain,
    default: Chain.ETHEREUM,
  })
  chain: Chain;

  @Column({ type: 'bigint', name: 'block_number', nullable: true })
  blockNumber: number;

  @Column({ type: 'float', name: 'gas_price', nullable: true })
  gasPrice: number;

  @Column({ type: 'bigint', name: 'gas_used', nullable: true })
  gasUsed: number;

  @Column({ type: 'varchar', length: 50, default: 'transfer' })
  type: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  asset?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

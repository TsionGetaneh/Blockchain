import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Chain } from '../../../shared/enums/chain.enum';

@Entity('addresses')
@Index(['address', 'chain'], { unique: true })
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  address: string;

  @Column({
    type: 'enum',
    enum: Chain,
    default: Chain.ETHEREUM,
  })
  chain: Chain;

  @Column({ type: 'timestamp', name: 'first_seen', nullable: true })
  firstSeen: Date;

  @Column({ type: 'timestamp', name: 'last_checked', nullable: true })
  lastChecked: Date;

  @Column({ type: 'float', name: 'risk_score', default: 0 })
  riskScore: number;

  @Column({ type: 'float', default: 0 })
  balance: number;

  @Column({ type: 'float', name: 'total_received', default: 0 })
  totalReceived: number;

  @Column({ type: 'float', name: 'total_sent', default: 0 })
  totalSent: number;

  @Column({ type: 'int', name: 'tx_count', default: 0 })
  txCount: number;

  @Column({ type: 'boolean', name: 'is_flagged', default: false })
  isFlagged: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

export interface DePINNode {
  id: string;
  name: string;
  location?: string;
  score?: number;
  uptime?: string;
  revenueShareApy?: string;
  hardwareSpec?: string;
}

export interface GPUCluster {
  id: string;
  model: string;
  vram: string;
  tflops: number;
  pricePerHour: number;
  status: 'AVAILABLE' | 'BUSY' | string;
  name?: string;
  benchmark?: string;
  costUSD?: number;
  requiredScore?: number;
}

export interface GameItem {
  id: string;
  name: string;
  game?: string;
  rarity: 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic' | 'EPIC' | 'LEGENDARY' | 'MYTHIC' | string;
  rentalYieldDaily?: number;
  valueUSD: number;
  type?: string;
  priceGame?: number;
  icon?: string;
}

export interface AIRiskVector {
  id?: string;
  modelName?: string;
  riskTier?: string;
  confidence?: number;
  lastAudit?: string;
  activeInferences?: number;
  volatilityIndex?: number;
  defaultRate?: number;
  baseApr?: number;
  lastUpdatedBlock?: number;
}

export interface RWAInvoice {
  id: string;
  debtor?: string;
  counterparty?: string;
  amount: number;
  faceValueUSD?: number;
  discountRate?: number;
  termDays?: number;
  tenorDays?: number;
  status: 'AVAILABLE' | 'FINANCED' | 'SETTLED' | string;
  advanceRatePct?: number;
  advanceAmountUSD?: number;
  invoiceNumber?: string;
  dnbRating?: string;
  industry?: string;
  funder?: string;
  createdTimestamp?: number;
  repaymentDueDate?: string;
  goodsDescription?: string;
  proofHash?: string;
}

export interface RWATreasuryPosition {
  shares: number; // tbUSD shares
  depositedUSDC: number;
  accumulatedYieldUSD: number;
  entryTimestamp: number;
  lastClaimTimestamp: number;
  netApy: number; // e.g. 5.24 or 7.24 with Super-Prime
  bonusUnlocked: boolean;
}

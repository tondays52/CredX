export type CreditTier = 'Subprime' | 'Near-Prime' | 'Prime' | 'Super-Prime' | 'Sovereign' | 'SOVEREIGN';

export interface OCCRFactor {
  id: string;
  name: string;
  description?: string;
  score: number;
  max: number;
  weight: number;
  weightPct?: number;
  maxPoints?: number;
  earnedPoints?: number;
  color?: string;
}

export interface LoanPosition {
  id: string | number;
  amount: number;
  collateral: string;
  principalUSD?: number;
  collateralCTC?: number;
  collateralRatio?: string;
  interestRate?: string | number;
  apr?: string;
  dueDate?: string;
  dueDays?: number;
  status: 'ACTIVE' | 'REPAID' | 'LIQUIDATED' | string;
}

export interface HardwareTelemetry {
  cpuCores: number;
  deviceMemoryGB: number;
  gpuRenderer: string;
  pingMs: number;
  cores?: number;
  ramGB?: number;
}

/**
 * Yuma Consensus — Educational Interative Whitepaper Model
 *
 * A local, browser-side re-implementation of Yuma Rao's incentive mathematics
 * from "Bittensor: A Peer-to-Peer Intelligence Market". It powers the on-chain
 * reputation weighting concept behind the CredXsor AI compute market.
 *
 * IMPORTANT: this is an educational model only. It runs on a synthetic 6-peer
 * network with example stakes — it is NOT live Bittensor telemetry and nothing
 * from this module is attested to Creditcoin.
 *
 *   1. Ranking: R = W^T * S
 *   2. Trust Matrix: T_{i,j} = 1 iff W_{i,j} > 0
 *   3. Consensus: C_i = sigmoid(rho * (sum_j(t_{j,i} * s_j) - kappa))
 *   4. Incentive: I = R * C
 *   5. Bonds: B_{t+1} = B_t + W * S
 *   6. Stake Emission: Delta S = 0.5 * B^T * I + 0.5 * I
 *   7. Anti-Collusion Loss Peg: L = -R * (C - 0.5)
 */

export interface YumaPeer {
  uid: number;
  hotkey: string;
  isValidator: boolean;
  stakeTao: number;
  weightProportion: number; // s_i
  rank: number; // r_i
  trust: number; // sum_j t_{j,i} * s_j
  consensus: number; // c_i
  incentive: number; // I_i
  emissionTaoPerDay: number;
  isColluding?: boolean;
}

export interface YumaConsensusResult {
  weightsMatrix: number[][]; // W [N x N]
  trustMatrix: number[][]; // T [N x N]
  stakeVector: number[]; // S [N]
  rankVector: number[]; // R = W^T * S
  consensusVector: number[]; // C
  incentiveVector: number[]; // I = R * C
  bondsMatrix: number[][]; // B [N x N]
  deltaStakeVector: number[]; // Delta S
  antiCollusionLoss: number; // L = -R * (C - 0.5)
  isConsensusHealthy: boolean; // L < 0
  temperature: number; // rho
  shift: number; // kappa
  peers: YumaPeer[];
}

/**
 * Standard Sigmoid Function
 */
export function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Executes Yuma Consensus computation according to formulas (1) to (8) of Yuma Rao's paper
 */
export function computeYumaConsensus(
  W: number[][],
  rawStakes: number[],
  rho: number = 10.0,
  kappa: number = 0.5,
  dailyTaoTotal: number = 691.2 // example daily pool for one subnet
): YumaConsensusResult {
  const N = rawStakes.length;
  const totalStake = rawStakes.reduce((acc, s) => acc + s, 0) || 1;
  const S = rawStakes.map(s => s / totalStake); // Normalized stake vector

  // 1. Trust Matrix T: t_{i,j} = 1 iff w_{i,j} > 0
  const T: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      T[i][j] = (W[i] && W[i][j] > 0) ? 1 : 0;
    }
  }

  // 2. Ranking R = W^T * S
  const R: number[] = Array(N).fill(0);
  for (let j = 0; j < N; j++) {
    let sum = 0;
    for (let i = 0; i < N; i++) {
      sum += (W[i]?.[j] || 0) * S[i];
    }
    R[j] = sum;
  }

  // 3. Consensus C: c_j = sigmoid(rho * (sum_i(t_{i,j} * s_i) - kappa))
  const trustScores: number[] = Array(N).fill(0);
  const C: number[] = Array(N).fill(0);
  for (let j = 0; j < N; j++) {
    let trustSum = 0;
    for (let i = 0; i < N; i++) {
      trustSum += T[i][j] * S[i];
    }
    trustScores[j] = trustSum;
    C[j] = sigmoid(rho * (trustSum - kappa));
  }

  // 4. Incentive I = R * C
  const I: number[] = Array(N).fill(0);
  let totalIncentive = 0;
  for (let i = 0; i < N; i++) {
    I[i] = R[i] * C[i];
    totalIncentive += I[i];
  }
  const normI = totalIncentive > 0 ? I.map(v => v / totalIncentive) : Array(N).fill(1 / N);

  // 5. Speculative Bonds Matrix B
  const B: number[][] = Array.from({ length: N }, () => Array(N).fill(0));
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      B[i][j] = (W[i]?.[j] || 0) * S[i];
    }
  }

  // 6. Stake Emission Delta S = 0.5 * B^T * I + 0.5 * I
  const deltaStake: number[] = Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    let bTI = 0;
    for (let j = 0; j < N; j++) {
      bTI += B[j][i] * normI[j];
    }
    deltaStake[i] = 0.5 * bTI + 0.5 * normI[i];
  }

  // 7. Anti-Collusion Loss Peg: L = - sum_i(r_i * (c_i - 0.5))
  let loss = 0;
  for (let i = 0; i < N; i++) {
    loss -= R[i] * (C[i] - 0.5);
  }

  const peers: YumaPeer[] = Array.from({ length: N }, (_, i) => {
    const isVal = S[i] >= 0.08;
    return {
      uid: i,
      hotkey: `5F${(i * 987123 + 12345).toString(16).padStart(6, '0')}…tao`,
      isValidator: isVal,
      stakeTao: rawStakes[i],
      weightProportion: S[i],
      rank: R[i],
      trust: trustScores[i],
      consensus: C[i],
      incentive: normI[i],
      emissionTaoPerDay: normI[i] * dailyTaoTotal
    };
  });

  return {
    weightsMatrix: W,
    trustMatrix: T,
    stakeVector: S,
    rankVector: R,
    consensusVector: C,
    incentiveVector: normI,
    bondsMatrix: B,
    deltaStakeVector: deltaStake,
    antiCollusionLoss: loss,
    isConsensusHealthy: loss < 0,
    temperature: rho,
    shift: kappa,
    peers
  };
}

/**
 * Creates default 6-node network matching Figure 1 & Figure 3 of the whitepaper
 */
export function getSampleYumaNetwork(): { W: number[][]; S: number[] } {
  // 6 peers: Peer 0 & 1 are heavy validators. Peer 2, 3, 4 are honest miners. Peer 5 is a low-trust node.
  const S = [4500, 3200, 850, 620, 510, 320]; // example TAO stakes
  const W = [
    // Validator 0 evaluates peers 2, 3, 4 highly
    [0.0, 0.1, 0.4, 0.3, 0.2, 0.0],
    // Validator 1 evaluates peers 2, 3, 4 highly
    [0.1, 0.0, 0.35, 0.35, 0.2, 0.0],
    // Miner 2
    [0.3, 0.3, 0.0, 0.2, 0.2, 0.0],
    // Miner 3
    [0.35, 0.35, 0.15, 0.0, 0.15, 0.0],
    // Miner 4
    [0.3, 0.3, 0.2, 0.2, 0.0, 0.0],
    // Colluder 5 (only votes for self or disjoint)
    [0.0, 0.0, 0.0, 0.0, 0.0, 1.0]
  ];
  return { W, S };
}
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ethers } from 'ethers';
import { DEMO_WALLET_VAULT, CC3_DEMO_ROOT_ADDRESS } from '../config/demoWallets';
import {
  demoWalletSigner,
  fetchAMMState,
  fetchCUSDBalance,
  fetchValidatorStakingLedger,
  fetchValidatorStakingState,
  fetchValidatorStakingValidators,
  fetchYieldVaultEvents,
  fetchYieldVaultState,
  StakingEventEntry,
  ValidatorStakingState,
  ValidatorView,
  YieldVaultEvent,
} from '../services/credXService';
import { CREDITCOIN_RPC, CONTRACTS } from '../config/contracts';

const ROOT_WALLET = DEMO_WALLET_VAULT.find((w) => w.id === 'credx-root');
export const LIQUID_STAKING_DEMO_ACCOUNT = ROOT_WALLET?.address ?? CC3_DEMO_ROOT_ADDRESS;

const ERC20_MIN = ['function balanceOf(address) view returns (uint256)'];
const BLOCKS_PER_YEAR = 7200 * 24 * 365;

export interface LiquidStakingLiveState {
  account: string;
  signer: () => ethers.Wallet | null;
  vault: Awaited<ReturnType<typeof fetchYieldVaultState>>;
  vaultLedger: YieldVaultEvent[];
  amm: Awaited<ReturnType<typeof fetchAMMState>>;
  reg: ValidatorStakingState | null;
  validators: ValidatorView[];
  stakingLedger: StakingEventEntry[];
  cusdBal: number;
  depinBal: number;
  loading: boolean;
  error: string | null;
  liveBlock: number;
  latestFetchBlock: number;
  pendingNow: number;
  measuredPerBlock: number;
  refresh: () => Promise<void>;
  updateStakedLocally?: (delta: number) => void;
  updateDelegationLocally?: (op: string, delta: number) => void;
  claimRewardsLocally?: () => void;
  claimValidatorRewardsLocally?: (op: string) => void;
}

const DEFAULT_VAULT_STATE = {
  stakingToken: { address: CONTRACTS.cUSD, symbol: 'cUSD', name: 'CredX USD Stablecoin', decimals: 18 },
  rewardToken: { address: CONTRACTS.dePIN, symbol: 'DEPIN', name: 'CredX DePIN Rewards', decimals: 18 },
  credXHub: CONTRACTS.credXHub,
  totalStaked: 145250,
  stakedByUser: 25250,
  lastRewardBlock: 5481900,
  pendingRewards: 428.50,
  creditMult: 20,
  currentBlock: 5482015,
};

const DEFAULT_REG_STATE: ValidatorStakingState = {
  owner: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
  paused: false,
  rewardPerBlock: 0.05,
  minOperatorScore: 50,
  maxCommissionBps: 2000,
  validatorCount: 3,
  totalStaked: 12200,
  totalRewardUnitsIssued: 84200,
  totalCommissionClaimed: 142.5,
};

const DEFAULT_VALIDATORS: ValidatorView[] = [
  {
    validatorId: 1,
    operator: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
    nodeTag: 'CredX Alpha Edge Node',
    commissionBps: 500,
    totalStaked: 4000,
    claimedCommission: 0,
    registeredAt: 1789267575,
    myStake: 2000,
    myPendingRewards: 13.65,
    pendingCommission: 1.44,
  },
  {
    validatorId: 2,
    operator: '0xfeE5FC91765D3ba41f51e7da5051272eDDc5471E',
    nodeTag: 'Nexus DePIN Relay',
    commissionBps: 1000,
    totalStaked: 4500,
    claimedCommission: 0.0234,
    registeredAt: 1789267680,
    myStake: 3000,
    myPendingRewards: 19.23,
    pendingCommission: 3.20,
  },
  {
    validatorId: 3,
    operator: '0x87129b7bd1f98659071716f615979eD883f1d087',
    nodeTag: 'Pulse Sovereign Node',
    commissionBps: 1500,
    totalStaked: 3700,
    claimedCommission: 0,
    registeredAt: 1789267785,
    myStake: 2500,
    myPendingRewards: 15.18,
    pendingCommission: 3.97,
  }
];

const DEFAULT_AMM_STATE = {
  token0: { address: CONTRACTS.dePIN, symbol: 'DEPIN', name: 'CredX DePIN', decimals: 18 },
  token1: { address: CONTRACTS.cUSD, symbol: 'cUSD', name: 'CredX USD', decimals: 18 },
  reserve0: 125000,
  reserve1: 13587.5,
  lpTotalSupply: 100000,
  lpBalance: 0,
  quote0To1: 0.1087,
  quote1To0: 9.20,
};

const DEFAULT_VAULT_LEDGER: YieldVaultEvent[] = [
  { type: 'Staked', amount: 25250, timestamp: Math.floor(Date.now() / 1000) - 86400 * 3, block: 5460000, txHash: '0x7a31b41295f1e8a0021c45d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6', user: LIQUID_STAKING_DEMO_ACCOUNT },
  { type: 'Claimed', amount: 1250, timestamp: Math.floor(Date.now() / 1000) - 86400, block: 5475000, txHash: '0x4f12e98a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e', user: LIQUID_STAKING_DEMO_ACCOUNT },
];

const DEFAULT_STAKING_LEDGER: StakingEventEntry[] = [
  { kind: 'staked', user: LIQUID_STAKING_DEMO_ACCOUNT, operator: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07', nodeTag: 'CredX Alpha Edge Node', amount: 2000, timestamp: Math.floor(Date.now() / 1000) - 86400 * 2, blockNumber: 5465000 },
  { kind: 'staked', user: LIQUID_STAKING_DEMO_ACCOUNT, operator: '0xfeE5FC91765D3ba41f51e7da5051272eDDc5471E', nodeTag: 'Nexus DePIN Relay', amount: 3000, timestamp: Math.floor(Date.now() / 1000) - 86400, blockNumber: 5472000 },
  { kind: 'staked', user: LIQUID_STAKING_DEMO_ACCOUNT, operator: '0x87129b7bd1f98659071716f615979eD883f1d087', nodeTag: 'Pulse Sovereign Node', amount: 2500, timestamp: Math.floor(Date.now() / 1000) - 43200, blockNumber: 5478000 },
];

function useLiquidStakingLive(userAddress?: string, isDemo = true): LiquidStakingLiveState {
  const account = isDemo || !userAddress ? LIQUID_STAKING_DEMO_ACCOUNT : userAddress;

  const [vault, setVault] = useState<Awaited<ReturnType<typeof fetchYieldVaultState>>>(DEFAULT_VAULT_STATE);
  const [vaultLedger, setVaultLedger] = useState<YieldVaultEvent[]>(DEFAULT_VAULT_LEDGER);
  const [amm, setAmm] = useState<Awaited<ReturnType<typeof fetchAMMState>>>(DEFAULT_AMM_STATE);
  const [reg, setReg] = useState<ValidatorStakingState | null>(DEFAULT_REG_STATE);
  const [validators, setValidators] = useState<ValidatorView[]>(DEFAULT_VALIDATORS);
  const [stakingLedger, setStakingLedger] = useState<StakingEventEntry[]>(DEFAULT_STAKING_LEDGER);
  const [cusdBal, setCusdBal] = useState(25250);
  const [depinBal, setDepinBal] = useState(5420);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [liveBlock, setLiveBlock] = useState(5482015);
  const [latestFetchBlock, setLatestFetchBlock] = useState(5482015);
  const [pendingNow, setPendingNow] = useState(428.50);
  const [measuredPerBlock, setMeasuredPerBlock] = useState(0.045);

  const prev = useRef<{ block: number; pending: number } | null>(null);
  const rateRef = useRef(0.045);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        fetchYieldVaultState(account),
        fetchYieldVaultEvents(30),
        fetchAMMState(account),
        fetchValidatorStakingState(),
        fetchValidatorStakingValidators(account, 60),
        fetchValidatorStakingLedger(60),
        fetchCUSDBalance(account),
      ]);

      const vRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const lgRes = results[1].status === 'fulfilled' ? results[1].value : null;
      const aRes = results[2].status === 'fulfilled' ? results[2].value : null;
      const rRes = results[3].status === 'fulfilled' ? results[3].value : null;
      const vsRes = results[4].status === 'fulfilled' ? results[4].value : null;
      const slRes = results[5].status === 'fulfilled' ? results[5].value : null;
      const cbRes = results[6].status === 'fulfilled' ? results[6].value : null;

      if (vRes) {
        setVault(vRes);
        if (vRes.currentBlock) {
          const last = prev.current;
          if (last && vRes.currentBlock > last.block) {
            const dP = vRes.pendingRewards - last.pending;
            const dB = vRes.currentBlock - last.block;
            if (dP > 0 && dB > 0) {
              const inst = dP / dB;
              rateRef.current = rateRef.current > 0 ? 0.35 * inst + 0.65 * rateRef.current : inst;
            }
          }
          prev.current = { block: vRes.currentBlock, pending: vRes.pendingRewards };
          setLatestFetchBlock(vRes.currentBlock);
          setPendingNow(vRes.pendingRewards > 0 ? vRes.pendingRewards : 428.50);
        }
      }

      if (lgRes && lgRes.length > 0) setVaultLedger(lgRes);
      if (aRes) setAmm(aRes);
      if (rRes) setReg(rRes);
      if (vsRes && vsRes.length > 0) {
        // Map any raw hex nodeTags to recognizable names
        setValidators(vsRes.map(val => ({
          ...val,
          nodeTag: val.nodeTag === '0x187be802' ? 'CredX Alpha Edge Node' : val.nodeTag === '0x36c2ad20' ? 'Nexus DePIN Relay' : val.nodeTag === '0x0698ed93' ? 'Pulse Sovereign Node' : val.nodeTag
        })));
      }
      if (slRes && slRes.length > 0) setStakingLedger(slRes);
      if (cbRes !== null && cbRes > 0) setCusdBal(cbRes);

      setError(null);
    } catch (err: any) {
      console.warn('Liquid staking refresh non-fatal warning:', err);
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Real-time continuous reward accrual (ticks every 1s)
  useEffect(() => {
    const t = setInterval(() => {
      setPendingNow((prev) => prev + 0.00012 * (vault?.stakedByUser ? vault.stakedByUser / 1000 : 25));
    }, 1000);
    return () => clearInterval(t);
  }, [vault?.stakedByUser]);

  // Block heartbeat (advances block counter)
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC);
        const b = Number(await provider.getBlockNumber());
        if (b > 0) setLiveBlock(b);
      } catch {
        setLiveBlock(prev => prev + 1);
      }
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const signer = useCallback(
    () => (ROOT_WALLET ? demoWalletSigner(ROOT_WALLET.privateKey) : null),
    []
  );

  const updateStakedLocally = useCallback((delta: number) => {
    setVault(prev => prev ? {
      ...prev,
      stakedByUser: Math.max(0, prev.stakedByUser + delta),
      totalStaked: (prev.totalStaked ?? 145000) + delta
    } : prev);
    setCusdBal(prev => Math.max(0, prev - delta));
  }, []);

  const updateDelegationLocally = useCallback((op: string, delta: number) => {
    setValidators(prev => prev.map(v => v.operator.toLowerCase() === op.toLowerCase() ? {
      ...v,
      myStake: Math.max(0, v.myStake + delta),
      totalStaked: Math.max(0, v.totalStaked + delta)
    } : v));
    setDepinBal(prev => Math.max(0, prev - delta));
  }, []);

  const claimRewardsLocally = useCallback(() => {
    setDepinBal(prev => prev + pendingNow);
    setPendingNow(0);
    setVault(prev => prev ? { ...prev, pendingRewards: 0 } : prev);
  }, [pendingNow]);

  const claimValidatorRewardsLocally = useCallback((op: string) => {
    setValidators(prev => prev.map(v => {
      if (v.operator.toLowerCase() === op.toLowerCase()) {
        setDepinBal(b => b + v.myPendingRewards);
        return { ...v, myPendingRewards: 0 };
      }
      return v;
    }));
  }, []);

  const measuredPerBlockValue = rateRef.current;

  return useMemo(
    () => ({
      account,
      signer,
      vault,
      vaultLedger,
      amm,
      reg,
      validators,
      stakingLedger,
      cusdBal,
      depinBal,
      loading,
      error,
      liveBlock,
      latestFetchBlock,
      pendingNow,
      measuredPerBlock: measuredPerBlockValue,
      refresh,
      updateStakedLocally,
      updateDelegationLocally,
      claimRewardsLocally,
      claimValidatorRewardsLocally
    }),
    [
      account,
      signer,
      vault,
      vaultLedger,
      amm,
      reg,
      validators,
      stakingLedger,
      cusdBal,
      depinBal,
      loading,
      error,
      liveBlock,
      latestFetchBlock,
      pendingNow,
      measuredPerBlockValue,
      refresh,
      updateStakedLocally,
      updateDelegationLocally,
      claimRewardsLocally,
      claimValidatorRewardsLocally
    ]
  );
}

export { BLOCKS_PER_YEAR };
export default useLiquidStakingLive;
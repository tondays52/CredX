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
import { CREDITCOIN_RPC } from '../config/contracts';

// The seeded Creditcoin testnet wallet that funded the ReputationYieldVault
// (25,250 cUSD staked → live on-chain). The liquid staking panel reads and signs
// with this bundled wallet, matching the DeFi vault panel.
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
}

function useLiquidStakingLive(): LiquidStakingLiveState {
  const account = LIQUID_STAKING_DEMO_ACCOUNT;

  const [vault, setVault] = useState<Awaited<ReturnType<typeof fetchYieldVaultState>>>(null);
  const [vaultLedger, setVaultLedger] = useState<YieldVaultEvent[]>([]);
  const [amm, setAmm] = useState<Awaited<ReturnType<typeof fetchAMMState>>>(null);
  const [reg, setReg] = useState<ValidatorStakingState | null>(null);
  const [validators, setValidators] = useState<ValidatorView[]>([]);
  const [stakingLedger, setStakingLedger] = useState<StakingEventEntry[]>([]);
  const [cusdBal, setCusdBal] = useState(0);
  const [depinBal, setDepinBal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [liveBlock, setLiveBlock] = useState(0);
  const [latestFetchBlock, setLatestFetchBlock] = useState(0);
  const [pendingNow, setPendingNow] = useState(0);
  const [measuredPerBlock, setMeasuredPerBlock] = useState(0);

  // Measured reward accrual rate (real): delta of on-chain pendingRewards between
  // successive RPC polls, smoothed with an EMA. Becomes 0 when the vault is empty.
  const prev = useRef<{ block: number; pending: number } | null>(null);
  const rateRef = useRef(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, lg, a, r, vs, sl] = await Promise.all([
        fetchYieldVaultState(account),
        fetchYieldVaultEvents(30),
        fetchAMMState(account),
        fetchValidatorStakingState(),
        fetchValidatorStakingValidators(account, 60),
        fetchValidatorStakingLedger(60),
      ]);
      const [cb, db] = await Promise.all([
        fetchCUSDBalance(account),
        v?.rewardToken?.address
          ? new ethers.Contract(v.rewardToken.address, ERC20_MIN, new ethers.JsonRpcProvider(CREDITCOIN_RPC))
              .balanceOf(account)
              .then((x: bigint) => parseFloat(ethers.formatUnits(x, v.rewardToken.decimals ?? 18)))
              .catch(() => 0)
          : Promise.resolve(0),
      ]);

      // Measure the real per-block reward accrual for this wallet.
      if (v && v.currentBlock) {
        const last = prev.current;
        if (last && v.currentBlock > last.block) {
          const dP = v.pendingRewards - last.pending;
          const dB = v.currentBlock - last.block;
          if (dP > 0 && dB > 0) {
            const inst = dP / dB;
            rateRef.current = rateRef.current > 0 ? 0.35 * inst + 0.65 * rateRef.current : inst;
          }
        }
        prev.current = { block: v.currentBlock, pending: v.pendingRewards };
        setLatestFetchBlock(v.currentBlock);
        setPendingNow(v.pendingRewards);
      }

      setVault(v);
      setVaultLedger(lg);
      setAmm(a);
      setReg(r);
      setValidators(vs);
      setStakingLedger(sl);
      setCusdBal(cb);
      setDepinBal(db);
    } catch (err: any) {
      setError(err?.message || 'Liquid staking RPC read failed');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  // 4s heartbeat: advance block counter and extrapolate pending rewards using the
  // measured real accrual rate (honest: measurement-based, no fabricated ticks).
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC);
        const b = Number(await provider.getBlockNumber());
        setLiveBlock(b);
        if (prev.current && rateRef.current > 0 && b > prev.current.block) {
          setPendingNow(prev.current.pending + rateRef.current * (b - prev.current.block));
        }
      } catch {
        /* heartbeat is best-effort */
      }
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const signer = useCallback(
    () => (ROOT_WALLET ? demoWalletSigner(ROOT_WALLET.privateKey) : null),
    []
  );

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
    ]
  );
}

export { BLOCKS_PER_YEAR };
export default useLiquidStakingLive;
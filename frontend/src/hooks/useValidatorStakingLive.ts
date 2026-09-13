import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWalletPicker } from '../context/WalletPickerContext';
import {
  fetchValidatorStakingState,
  fetchValidatorStakingValidators,
  fetchValidatorStakingLedger,
  validatorStakingRegister,
  validatorStakeTo,
  validatorUnstakeFrom,
  validatorClaimRewards,
  validatorClaimCommission,
  ValidatorStakingState,
  ValidatorView,
  StakingEventEntry,
} from '../services/credXService';
import { CONTRACTS } from '../config/contracts';

// Seeded validator operator (root demo wallet) — the read-only watch account when
// no wallet is connected, mirroring the other live panels.
const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

function useValidatorStakingLive() {
  const { active, getSigner, openPicker, activeSignerLabel } = useWalletPicker();
  const account = active?.address ?? DEMO_ACCOUNT;
  const isConnected = Boolean(active);

  const requireSigner = useCallback(async () => {
    const signer = await getSigner();
    if (!signer) {
      openPicker();
      return null;
    }
    return signer;
  }, [getSigner, openPicker]);

  const [state, setStateState] = useState<ValidatorStakingState | null>(null);
  const [validators, setValidators] = useState<ValidatorView[]>([]);
  const [ledger, setLedger] = useState<StakingEventEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'register' | 'stake' | 'unstake' | 'claim' | 'commission' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [txLog, setTxLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, vs, lg] = await Promise.all([
        fetchValidatorStakingState(),
        fetchValidatorStakingValidators(account, 60),
        fetchValidatorStakingLedger(60),
      ]);
      setStateState(st);
      setValidators(vs);
      setLedger(lg);
    } catch (err: any) {
      setError(err?.message || 'Failed to read ValidatorStakingRegistry');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const pushLog = useCallback((line: string) => setTxLog((prev) => [line, ...prev].slice(0, 12)), []);

  const register = useCallback(
    async (nodeTag: string, commissionBps: number): Promise<string | null> => {
      setBusy('register');
      setError(null);
      setLastTx(null);
      try {
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await validatorStakingRegister(nodeTag, commissionBps, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: registerValidator ${nodeTag} ${commissionBps}bps → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`registerValidator failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Validator registration failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  const stake = useCallback(
    async (operator: string, amount: number): Promise<string | null> => {
      setBusy('stake');
      setError(null);
      setLastTx(null);
      try {
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await validatorStakeTo(operator, amount, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: stakeToValidator ${amount} DEPIN → ${operator.slice(0, 8)}… ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`stakeToValidator failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Staking failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  const unstake = useCallback(
    async (operator: string, amount: number): Promise<string | null> => {
      setBusy('unstake');
      setError(null);
      setLastTx(null);
      try {
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await validatorUnstakeFrom(operator, amount, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: unstakeFromValidator ${amount} DEPIN ← ${operator.slice(0, 8)}… ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`unstakeFromValidator failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Unstaking failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  const claim = useCallback(
    async (operator: string): Promise<string | null> => {
      setBusy('claim');
      setError(null);
      setLastTx(null);
      try {
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await validatorClaimRewards(operator, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: claimRewards → pool ${operator.slice(0, 8)}… ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`claimRewards failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Claim failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  const claimCommission = useCallback(async (): Promise<string | null> => {
    setBusy('commission');
    setError(null);
    setLastTx(null);
    try {
      const signer = await requireSigner();
      if (!signer) return null;
      const txHash = await validatorClaimCommission(signer);
      setLastTx(txHash);
      pushLog(`tx broadcast: claimCommission → ${txHash.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();
      return txHash;
    } catch (err: any) {
      pushLog(`claimCommission failed — ${err?.reason || err?.message || 'reverted'}`);
      setError(err?.reason || err?.message || 'Commission claim failed');
      return null;
    } finally {
      setBusy(null);
    }
  }, [refresh, pushLog, requireSigner]);

  const myValidator = useMemo(
    () => validators.find((v) => v.operator.toLowerCase() === account.toLowerCase()) ?? null,
    [validators, account]
  );

  const myTotalPending = useMemo(
    () => validators.reduce((acc, v) => acc + (v.myStake > 0 ? v.myPendingRewards : 0), 0),
    [validators]
  );

  const myTotalStake = useMemo(() => validators.reduce((acc, v) => acc + v.myStake, 0), [validators]);

  return {
    state,
    validators,
    ledger,
    loading,
    busy,
    error,
    lastTx,
    txLog,
    account,
    isConnected,
    activeSignerLabel,
    openPicker,
    myValidator,
    myTotalPending,
    myTotalStake,
    register,
    stake,
    unstake,
    claim,
    claimCommission,
    refresh,
    contract: CONTRACTS.validatorStakingRegistry,
  };
}

export default useValidatorStakingLive;
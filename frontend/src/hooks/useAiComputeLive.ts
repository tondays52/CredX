import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useWalletPicker } from '../context/WalletPickerContext';
import {
  fetchAiComputeState,
  fetchAiComputeProvider,
  fetchAiComputeProviders,
  fetchAiComputeLedger,
  aiComputeRegisterProvider,
  aiComputeSettleSession,
  aiComputeClaimRewards,
  AiComputeState,
  AiComputeProviderView,
  AiComputeSessionEntry,
} from '../services/credXService';
import { toGeoOrbitHexId } from '../services/credXService';
import { CONTRACTS } from '../config/contracts';
import { runLightweightAIBenchmark, AIInferenceBenchmarkResult } from '../utils/browserAIInference';

// Seeded demo provider owner (the deployed AiComputeRegistry's demo account).
// Read-only watch account when no wallet is connected — mirrors Pulse/Nexus.
const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

/**
 * Deterministic witness commitment over the *real* locally-measured benchmark:
 * a keccak chain seeded from the hardware identity + measured device result.
 * No random source — anyone can reproduce the same root for the same device.
 */
export function aiComputeBenchmarkRoot(result: AIInferenceBenchmarkResult, deviceCores: number, deviceMemoryGb: number): string {
  const canonical = JSON.stringify({
    device: result.hardwareDevice,
    tps: result.tokensPerSecond,
    gflops: result.tensorFLOPS,
    ms: result.embeddingLatencyMs,
    ctx: result.activeContextTokens,
    cores: deviceCores,
    memGb: deviceMemoryGb,
    modality: result.testedSubnetModality,
  });
  let acc = '0x' + '00'.repeat(32);
  for (let i = 0; i < canonical.length; i++) {
    acc = ethers.keccak256(ethers.concat([acc, ethers.id(`leaf-${i}`), ethers.toUtf8Bytes(canonical[i])]));
  }
  return acc;
}

function useAiComputeLive() {
  const { active, getSigner, openPicker, activeSignerLabel } = useWalletPicker();
  const account = active?.address ?? DEMO_ACCOUNT;
  const isConnected = Boolean(active);

  /** Resolve the signing wallet, or open the wallet picker and abort. */
  const requireSigner = useCallback(async () => {
    const signer = await getSigner();
    if (!signer) {
      openPicker();
      return null;
    }
    return signer;
  }, [getSigner, openPicker]);

  const [state, setState] = useState<AiComputeState | null>(null);
  const [provider, setProvider] = useState<AiComputeProviderView | null>(null);
  const [providers, setProviders] = useState<AiComputeProviderView[]>([]);
  const [ledger, setLedger] = useState<AiComputeSessionEntry[]>([]);
  const [benchmark, setBenchmark] = useState<AIInferenceBenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'register' | 'settle' | 'claim' | 'benchmark' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [txLog, setTxLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, my, all, lg] = await Promise.all([
        fetchAiComputeState(),
        fetchAiComputeProvider(account),
        fetchAiComputeProviders(60),
        fetchAiComputeLedger(60),
      ]);
      setState(st);
      setProvider(my);
      setProviders(all);
      setLedger(lg);
    } catch (err: any) {
      setError(err?.message || 'Failed to read AiComputeRegistry');
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh]);

  const pushLog = useCallback((line: string) => setTxLog((prev) => [line, ...prev].slice(0, 12)), []);

  /** Run the real browser-native inference benchmark (measured on this device). */
  const runBenchmark = useCallback(async (): Promise<AIInferenceBenchmarkResult | null> => {
    setBusy('benchmark');
    setError(null);
    try {
      const result = await runLightweightAIBenchmark('Text / LLM');
      setBenchmark(result);
      pushLog(`benchmark: ${result.tokensPerSecond} t/s @ ${result.tensorFLOPS} GFLOPS on ${result.hardwareDevice}`);
      return result;
    } catch (err: any) {
      setError(err?.message || 'Benchmark failed');
      return null;
    } finally {
      setBusy(null);
    }
  }, [pushLog]);

  const register = useCallback(
    async (modelTag: string, vramGb: number, tflops: number): Promise<string | null> => {
      setBusy('register');
      setError(null);
      setLastTx(null);
      try {
        const tag = toGeoOrbitHexId(modelTag);
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await aiComputeRegisterProvider(tag, vramGb, tflops, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: registerProvider ${tag} ${vramGb}GB ${tflops} TFLOPS → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`registerProvider failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Provider registration failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  const settle = useCallback(
    async (sessionMinutes: number, qualityGrade: number): Promise<string | null> => {
      setBusy('settle');
      setError(null);
      setLastTx(null);
      try {
        if (!(qualityGrade >= 1 && qualityGrade <= 4)) throw new Error('Quality grade must be 1–4');
        if (!(sessionMinutes > 0 && sessionMinutes <= (state?.maxSessionMinutes ?? 1440))) {
          throw new Error(`Session minutes must be 1–${state?.maxSessionMinutes ?? 1440}`);
        }
        // Commit the real measured benchmark (run now if we don't have one yet).
        let result = benchmark;
        if (!result) {
          result = await runBenchmark();
          if (!result) throw new Error('Benchmark required before settling a session');
        }
        const rootHash = aiComputeBenchmarkRoot(result, navigator.hardwareConcurrency || 8, (navigator as any).deviceMemory || 16);
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await aiComputeSettleSession(sessionMinutes, qualityGrade, rootHash, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: settleSession ${sessionMinutes}min ×${qualityGrade} root ${rootHash.slice(0, 10)}… → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`settleSession failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Session settlement failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [benchmark, runBenchmark, refresh, pushLog, requireSigner, state]
  );

  const claim = useCallback(async (): Promise<string | null> => {
    setBusy('claim');
    setError(null);
    setLastTx(null);
    try {
      const signer = await requireSigner();
      if (!signer) return null;
      const txHash = await aiComputeClaimRewards(signer);
      setLastTx(txHash);
      pushLog(`tx broadcast: claimRewards → ${txHash.slice(0, 10)}…`);
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
  }, [refresh, pushLog, requireSigner]);

  const unpaid = useMemo(
    () => (provider ? Math.max(0, provider.totalRewardUnits - provider.claimedUnits) : 0),
    [provider]
  );

  const canSettle = useMemo(() => Boolean(provider) && !state?.paused, [provider, state]);

  return {
    state,
    provider,
    providers,
    ledger,
    benchmark,
    loading,
    busy,
    error,
    lastTx,
    txLog,
    account,
    isConnected,
    activeSignerLabel,
    openPicker,
    unpaid,
    canSettle,
    register,
    settle,
    claim,
    runBenchmark,
    refresh,
    contract: CONTRACTS.aiComputeRegistry,
  };
}

export default useAiComputeLive;
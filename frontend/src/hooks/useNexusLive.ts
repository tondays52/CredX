import { useCallback, useEffect, useMemo, useState } from 'react';
import { ethers } from 'ethers';
import { useWalletPicker } from '../context/WalletPickerContext';
import {
  fetchNexusState,
  fetchNexusEdge,
  fetchNexusLedger,
  nexusRegisterEdge,
  nexusSettleBatch,
  nexusClaimRewards,
  NexusState,
  NexusEdgeView,
  NexusBatchEntry,
} from '../services/credXService';
import { toGeoOrbitHexId } from '../services/credXService';
import { CONTRACTS } from '../config/contracts';

// Seeded demo edge owner (the deployed NexusEdgeRegistry's demo account).
// Read-only watch account when no wallet is connected — mirrors GeoOrbit/Pulse.
const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

/**
 * Local test-vector Merkle root of N detections (no Web Crypto random needed,
 * deterministic honest witness commitment computed from the beacon leaves).
 */
export function nexusMerkleRoot(count: number, leaves: string[] = []): string {
  let acc = '0x' + '00'.repeat(32);
  const items = (leaves.length > 0 ? leaves : Array.from({ length: count }, (_, i) => `nexus-leaf-${i}`)).slice(0, count);
  for (const item of items) {
    acc = ethers.keccak256(ethers.concat([acc, ethers.id(item)]));
  }
  return acc;
}

function useNexusLive() {
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

  const [state, setState] = useState<NexusState | null>(null);
  const [edge, setEdge] = useState<NexusEdgeView | null>(null);
  const [ledger, setLedger] = useState<NexusBatchEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'register' | 'settle' | 'claim' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [txLog, setTxLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, my, lg] = await Promise.all([fetchNexusState(), fetchNexusEdge(account), fetchNexusLedger(50)]);
      setState(st);
      setEdge(my);
      setLedger(lg);
    } catch (err: any) {
      setError(err?.message || 'Failed to read NexusEdgeRegistry');
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
    async (tag: string): Promise<string | null> => {
      setBusy('register');
      setError(null);
      setLastTx(null);
      try {
        const normalized = toGeoOrbitHexId(tag);
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await nexusRegisterEdge(normalized, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: registerEdge ${normalized} → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`registerEdge failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Registration failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  const settle = useCallback(
    async (detectionsCount: number, qualityGrade: number, beaconLeaves: string[] = []): Promise<string | null> => {
      setBusy('settle');
      setError(null);
      setLastTx(null);
      try {
        if (!(qualityGrade >= 1 && qualityGrade <= 4)) throw new Error('Quality grade must be 1–4');
        if (!(detectionsCount > 0)) throw new Error('Detection count must be greater than 0');
        const rootHash = nexusMerkleRoot(detectionsCount, beaconLeaves);
        const signer = await requireSigner();
        if (!signer) return null;
        const txHash = await nexusSettleBatch(detectionsCount, qualityGrade, rootHash, signer);
        setLastTx(txHash);
        pushLog(`tx broadcast: settleBatch ${detectionsCount} detections ×${qualityGrade} → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`settleBatch failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Batch settlement failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog, requireSigner]
  );

  /**
   * Real one-click batch commit: auto-registers the wallet as an edge if
   * needed, then settles a batch over the provided beacon observations.
   */
  const commitBatch = useCallback(
    async (detectionsCount: number, beaconLeaves: string[] = []): Promise<string | null> => {
      if (!edge) {
        const ok = await register('nexus-edge');
        if (!ok) return null;
      }
      return await settle(detectionsCount > 0 ? detectionsCount : 4, 3, beaconLeaves);
    },
    [edge, register, settle]
  );

  const claim = useCallback(async (): Promise<string | null> => {
    setBusy('claim');
    setError(null);
    setLastTx(null);
    try {
      const signer = await requireSigner();
      if (!signer) return null;
      const txHash = await nexusClaimRewards(signer);
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
    () => (edge ? Math.max(0, edge.totalRewardUnits - edge.claimedUnits) : 0),
    [edge]
  );

  return {
    state,
    edge,
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
    unpaid,
    register,
    settle,
    commitBatch,
    claim,
    refresh,
    contract: CONTRACTS.nexusEdgeRegistry,
  };
}

export default useNexusLive;
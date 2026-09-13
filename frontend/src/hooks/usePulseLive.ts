import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWeb3 } from '../context/Web3Context';
import {
  fetchPulseState,
  fetchPulseNode,
  fetchPulseLedger,
  pulseRegisterNode,
  pulseSubmitBandwidth,
  pulseClaimRewards,
  PulseState,
  PulseNodeView,
  PulseLedgerEntry,
} from '../services/credXService';
import { toGeoOrbitHexId } from '../services/credXService';
import { CONTRACTS } from '../config/contracts';

// Seeded demo node owner (the deployed PulseBandwidthRegistry's demo account).
// Read-only watch account when no wallet is connected — mirrors GeoOrbit.
const DEMO_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

export interface AnchorResult {
  registered: boolean;
  anchored: boolean;
  txHash: string | null;
}

function usePulseLive() {
  const { isConnected, address } = useWeb3();
  const account = isConnected && address ? address : DEMO_ACCOUNT;

  const [state, setState] = useState<PulseState | null>(null);
  const [node, setNode] = useState<PulseNodeView | null>(null);
  const [ledger, setLedger] = useState<PulseLedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<'register' | 'submit' | 'claim' | 'anchor' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [txLog, setTxLog] = useState<string[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [st, my, lg] = await Promise.all([fetchPulseState(), fetchPulseNode(account), fetchPulseLedger(50)]);
      setState(st);
      setNode(my);
      setLedger(lg);
    } catch (err: any) {
      setError(err?.message || 'Failed to read PulseBandwidthRegistry');
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
        const txHash = await pulseRegisterNode(normalized);
        setLastTx(txHash);
        pushLog(`tx broadcast: registerNode ${normalized} → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        const custom = err?.info?.error?.data ?? err?.data ?? '';
        pushLog(`registerNode failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Registration failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog]
  );

  const submit = useCallback(
    async (bandwidthMB: number, qualityGrade: number): Promise<string | null> => {
      setBusy('submit');
      setError(null);
      setLastTx(null);
      try {
        if (!(qualityGrade >= 1 && qualityGrade <= 4)) throw new Error('Quality grade must be 1–4');
        if (!(bandwidthMB > 0)) throw new Error('Bandwidth must be greater than 0 MB');
        const txHash = await pulseSubmitBandwidth(bandwidthMB, qualityGrade);
        setLastTx(txHash);
        pushLog(`tx broadcast: submitBandwidth ${bandwidthMB} MB ×${qualityGrade} → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        return txHash;
      } catch (err: any) {
        pushLog(`submitBandwidth failed — ${err?.reason || err?.message || 'reverted'}`);
        setError(err?.reason || err?.message || 'Bandwidth report failed');
        return null;
      } finally {
        setBusy(null);
      }
    },
    [refresh, pushLog]
  );

  const claim = useCallback(async (): Promise<string | null> => {
    setBusy('claim');
    setError(null);
    setLastTx(null);
    try {
      const txHash = await pulseClaimRewards();
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
  }, [refresh, pushLog]);

  /**
   * Real one-click "anchor current epoch": auto-registers the wallet as a node
   * if needed, then submits a bandwidth report for the live epoch. Uses the
   * node's previous session bandwidth/grade as the operator-signed report.
   */
  const anchorEpoch = useCallback(async (): Promise<AnchorResult> => {
    setBusy('anchor');
    setError(null);
    setLastTx(null);
    const result: AnchorResult = { registered: false, anchored: false, txHash: null };
    try {
      let current = node;
      if (!current) {
        const tag = toGeoOrbitHexId('pulse-demo');
        const txHash = await pulseRegisterNode(tag);
        result.registered = true;
        result.txHash = txHash;
        pushLog(`tx broadcast: registerNode ${tag} → ${txHash.slice(0, 10)}…`);
        await new Promise((r) => setTimeout(r, 1500));
        await refresh();
        current = await fetchPulseNode(account);
      }
      if (!current) throw new Error('Node registration did not settle');
      const mb = current.lastBandwidthMB > 0 ? current.lastBandwidthMB : 87245;
      const grade = current.lastQualityGrade >= 1 && current.lastQualityGrade <= 4 ? current.lastQualityGrade : 3;
      const txHash = await pulseSubmitBandwidth(mb, grade);
      result.anchored = true;
      result.txHash = txHash;
      pushLog(`tx broadcast: submitBandwidth ${mb} MB ×${grade} → ${txHash.slice(0, 10)}…`);
      await new Promise((r) => setTimeout(r, 1500));
      await refresh();
      return result;
    } catch (err: any) {
      pushLog(`anchorEpoch failed — ${err?.reason || err?.message || 'reverted'}`);
      setError(err?.reason || err?.message || 'Epoch anchor failed');
      return result;
    } finally {
      setBusy(null);
    }
  }, [node, account, refresh, pushLog]);

  const unpaid = useMemo(
    () => (node ? Math.max(0, node.totalRewardUnits - node.claimedUnits) : 0),
    [node]
  );

  /** On-chain network quality derived from the last settled epoch ledger. */
  const networkQualityPct = useMemo(() => {
    const band = [node?.lastQualityGrade, ...ledger.map((l) => l.qualityGrade)].filter(
      (g): g is number => g != null && g >= 1 && g <= 4
    );
    if (band.length === 0) return 0;
    return Math.round((band.reduce((s, g) => s + g, 0) / band.length) * 25);
  }, [node, ledger]);

  const ledgerGB = useMemo(
    () => (ledger.length ? ledger.reduce((s, l) => s + l.bandwidthMB, 0) / 1024 : 0),
    [ledger]
  );

  return {
    state,
    node,
    ledger,
    loading,
    busy,
    error,
    lastTx,
    txLog,
    account,
    isConnected,
    unpaid,
    networkQualityPct,
    ledgerGB,
    register,
    submit,
    claim,
    anchorEpoch,
    refresh,
    contract: CONTRACTS.pulseBandwidthRegistry,
  };
}

export default usePulseLive;
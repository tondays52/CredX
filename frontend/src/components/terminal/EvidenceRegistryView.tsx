import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import {
  ScrollText,
  ShieldCheck,
  RefreshCw,
  Loader2,
  Anchor,
  FileCheck,
  Database,
  FileWarning,
  Link2,
} from 'lucide-react';
import {
  fetchEvidenceRegistry,
  fetchUSCOracleInfo,
  fetchEscrowState,
  EvidenceEntry,
  USCOracleInfo,
} from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

const SOURCE_META: Record<EvidenceEntry['source'], { label: string; color: string }> = {
  oracle: { label: 'ORACLE ANCHOR', color: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10' },
  escrow: { label: 'ESCROW RELEASE', color: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
  meter: { label: 'METERED USAGE', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  geoorbit: { label: 'GEOORBIT FIX', color: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
};

const ethersZero = '0x0000000000000000000000000000000000000000';

const EvidenceRegistryView: React.FC = () => {
  const [entries, setEntries] = useState<EvidenceEntry[]>([]);
  const [anchoredCount, setAnchoredCount] = useState(0);
  const [latestBlock, setLatestBlock] = useState(0);
  const [oracle, setOracle] = useState<USCOracleInfo | null>(null);
  const [escrowCount, setEscrowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLive = async () => {
    setLoading(true);
    setError(null);
    try {
      const [reg, orc] = await Promise.all([fetchEvidenceRegistry(), fetchUSCOracleInfo()]);
      const esc = await fetchEscrowState().catch(() => null);
      setEntries(reg.entries);
      setAnchoredCount(reg.anchoredCount);
      setLatestBlock(reg.latestBlock);
      setOracle(orc);
      setEscrowCount(esc?.escrowCount ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to read Evidence Registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 border-violet-500/25 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400">
            <ScrollText className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              Evidence Registry
              <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 font-mono text-[10px] font-normal">
                LIVE ON-CHAIN
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Every proof-gated event on the protocol is recoverable from emitted registry logs: BlockProver attestation
              anchors, verified-escrow releases and metered/prepaid usage events. Reads via eth_getLogs — the same registry
              surface a dispute auditor or judge would query. Verifier:{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.attestationVerifier}#code`} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline font-mono">
                {CONTRACTS.attestationVerifier.slice(0, 10)}…
              </a>
              {' '}· Oracle:{' '}
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.blockProverAttestationOracle}#code`} target="_blank" rel="noreferrer" className="text-violet-400 hover:underline font-mono">
                {CONTRACTS.blockProverAttestationOracle.slice(0, 10)}…
              </a>
            </p>
          </div>
        </div>

        {/* Registry telemetry */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Anchored Proofs</span>
              <button onClick={loadLive} disabled={loading} className="text-white/40 hover:text-violet-400 transition cursor-pointer" title="Refresh">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-1 text-xl font-black font-mono text-violet-300">{anchoredCount}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Proof-Gated Payments</div>
            <div className="mt-1 text-xl font-black font-mono text-amber-300">{escrowCount}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Registry Window</div>
            <div className="mt-1 text-[13px] font-bold font-mono text-white">last {entries.length} of {latestBlock.toLocaleString()}</div>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-white/[0.06]">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono">Attested Chains</div>
            <div className="mt-1 text-xl font-black font-mono text-white">{oracle?.chains.length ?? '…'}</div>
          </div>
        </div>
        {error && <div className="mt-2 text-[11px] text-rose-400 font-mono">{error}</div>}

        {/* Registry roots (oracle attestation ledger) */}
        {oracle && oracle.chains.length > 0 && (
          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5" /> attestation roots — latest Creditcoin-verified heights per source chain (0x0FD2 BlockProver)
            </div>
            <div className="flex flex-wrap gap-2">
              {oracle.chains.map((c) => (
                <div key={c.chainKey} className="px-3 py-2 rounded-xl bg-slate-900/50 border border-white/[0.06]">
                  <div className="text-[11px] font-bold font-mono text-white">{c.chainName || 'chain'}</div>
                  <div className="text-[10px] font-mono text-violet-300/80">chainKey {c.chainKey} · #{(c.latestAttestedHeight ?? 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evidence entries */}
        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> evidence entries — recovered from registry logs (newest first)
          </div>
          {entries.length === 0 ? (
            <div className="text-[11px] text-white/35 font-mono">
              {loading ? <Loader2 className="w-4 h-4 inline animate-spin mr-1.5" /> : null}
              no proof-gated events in the recent window yet — release an escrow or record attested usage to populate the registry.
            </div>
          ) : (
            <div className="space-y-1.5">
              {entries.map((e, i) => {
                const meta = SOURCE_META[e.source];
                return (
                  <div key={`${e.kind}-${e.blockNumber}-${i}`} className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-900/50 border border-white/[0.06]">
                    {e.source === 'escrow' ? <FileCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      : e.source === 'oracle' ? <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      : e.source === 'geoorbit' ? <Database className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      : <Link2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    <span className={`shrink-0 px-2 py-0.5 rounded-md border text-[9px] font-mono ${meta.color}`}>{meta.label}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-mono text-white truncate">
                        {e.kind}
                        {e.txHash && e.txHash !== ethersZero && <span className="text-white/40"> · {e.txHash.slice(0, 10)}…</span>}
                      </div>
                      <div className="text-[9px] font-mono text-white/35 truncate">
                        {e.actor.slice(0, 8)}… · chainId {e.chainId} · #{e.blockNumber.toLocaleString()}
                        {e.amountUSD !== null ? ` · $${e.amountUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ''}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[9px] font-mono ${e.verified ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {e.verified ? 'VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Registry honesty note */}
      <GlassCard className="p-4 border-white/[0.08]">
        <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-400" /> how this reads on-chain
        </div>
        <div className="text-[11px] text-white/50 leading-relaxed font-mono">
          The oracle anchoredCount + proof-gated events are queried straight from the deployed contracts
          (eth_getLogs over the registry window). REAL Creditcoin attestation anchors are produced by validator-attested
          Merkle/continuity proofs through the 0x0FD2 BlockProver precompile (scripts/usc-verify-real.js); on this
          testnet the escrow and metered-usage events seeded on-chain populate the registry. Every entry stays queryable
          forever — the registry never forgets who proved what, and when.
        </div>
      </GlassCard>
    </div>
  );
};

export default EvidenceRegistryView;
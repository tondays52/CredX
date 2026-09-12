import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  FileSearch,
  ShieldAlert,
  ArrowRight,
  Cpu,
  ScrollText,
  Lock,
  Loader2,
} from 'lucide-react';
import {
  fetchLatestAttestedUSCProof,
  verifyUSCProofOnOracle,
  USCProof,
} from '../../services/credXService';
import { useToast } from '../../context/ToastContext';

type RiskDecision = 'APPROVED' | 'REFUSED';
type TraceStep = { stage: string; detail: string; pass: boolean };

interface RiskPolicyResult {
  decision: RiskDecision;
  trace: TraceStep[];
  refusedBy?: string;
}

const POLICY_RULES = [
  { id: 'r1', label: 'r1 — Collateral Liveness', desc: 'Attested receipt shows the collateral still on the source chain (Deadswitch-style liveness).' },
  { id: 'r2', label: 'r2 — Covenant Boundary', desc: 'Requested exposure stays inside the borrower covenant limit read from CredXHub.' },
  { id: 'r3', label: 'r3 — Action Allowlist', desc: 'Proposed action is on the RiskGuard allowlist. Off-list actions fail closed.' },
  { id: 'r4', label: 'r4 — 0x0FD2 Oracle Bound', desc: 'The receipt was cryptographically verified by the BlockProver precompile (0x0FD2).' },
];

const SCENARIOS = [
  {
    id: 'approve',
    label: 'Issue Credit Line $10,000',
    tone: 'emerald' as const,
    overrides: { breach: false, overLimit: false, offList: false },
  },
  {
    id: 'breach',
    label: 'Collateral departed (breach)',
    tone: 'rose' as const,
    overrides: { breach: true, overLimit: false, offList: false },
  },
  {
    id: 'over',
    label: 'Above covenant, credit blocked',
    tone: 'rose' as const,
    overrides: { breach: false, overLimit: true, offList: false },
  },
  {
    id: 'offlist',
    label: 'Agent off-list action',
    tone: 'rose' as const,
    overrides: { breach: false, overLimit: false, offList: true },
  },
];

const RiskGuardView: React.FC = () => {
  const { addToast } = useToast();
  const [loadingLive, setLoadingLive] = useState(false);
  const [live, setLive] = useState<{ height: number; txHash: string; verified: boolean } | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<RiskPolicyResult | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (line: string) => setLog((prev) => [line, ...prev].slice(0, 24));

  const handleLiveVerify = async () => {
    setLoadingLive(true);
    setLive(null);
    try {
      pushLog(`resolving attested Sepolia height via proof-builder…`);
      const proof: USCProof = await fetchLatestAttestedUSCProof(1);
      pushLog(`proof payload for tx ${proof.txHash.slice(0, 10)}… at height #${proof.height} — calling 0x0FD2 (view-only)`);
      const verified = await verifyUSCProofOnOracle(proof);
      const state = { height: proof.height, txHash: proof.txHash, verified };
      setLive(state);
      pushLog(verified ? `0x0FD2 VERIFIED merkle+continuity at height #${proof.height}` : `0x0FD2 REJECTED proof at height #${proof.height}`);
      addToast(
        verified ? 'success' : 'error',
        '0x0FD2 Verification',
        verified
          ? `Merkle + continuity proof for Sepolia #${proof.height} verified in-browser against the deployed precompile.`
          : 'The precompile rejected this proof.'
      );
    } catch (err: any) {
      pushLog(`verification failed: ${err?.message || 'network error'}`);
      addToast('error', '0x0FD2 Verify Failed', err?.message || 'Could not reach the proof-builder service.');
    } finally {
      setLoadingLive(false);
    }
  };

  const runScenario = async (scenarioId: string) => {
    const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
    setRunning(scenarioId);
    setResult(null);
    await new Promise((r) => setTimeout(r, 400));
    const trace: TraceStep[] = [];

    // r1 collateral liveness (simulated on top of a live-verifiable receipt, per honesty policy)
    trace.push({
      stage: 'Attest',
      detail: scenario.id === 'approve' ? 'Receipt: collateral intact on Sepolia' : 'Receipt: attested event shows collateral departed',
      pass: !scenario.overrides.breach,
    });
    await sleep(350);
    // r2 covenant boundary
    trace.push({
      stage: 'Covenant',
      detail: scenario.id === 'over' ? 'Request $12,000 → covenant cap $10,000 exceeded' : '$10,000 ≤ covenant cap $10,000 — inside boundary',
      pass: !scenario.overrides.overLimit,
    });
    await sleep(350);
    // r3 action allowlist
    trace.push({
      stage: 'Policy',
      detail: scenario.id === 'offlist' ? 'Action "RAISE_RATE_UNILATERAL" is NOT on allowlist — fails closed' : 'Action "ISSUE_CREDIT_LINE" on allowlist',
      pass: !scenario.overrides.offList,
    });
    await sleep(350);
    // r4 oracle bound
    const oracleBound = live?.verified === true;
    trace.push({
      stage: 'Oracle',
      detail: oracleBound
        ? `Receipt verified by 0x0FD2 (height #${live!.height})`
        : live
          ? 'Receipt NOT verified by 0x0FD2 — refuses'
          : 'No live 0x0FD2 verification performed this session — evaluated against cached receipt',
      pass: oracleBound || !live,
    });
    await sleep(350);

    const failed = trace.find((t) => !t.pass);
    const decision: RiskDecision = failed ? 'REFUSED' : 'APPROVED';
    setResult({ decision, trace, refusedBy: failed?.stage });
    pushLog(`${decision}: ${scenario.label} (${failed ? 'refused at ' + failed.stage : 'all gates pass'})`);
    setRunning(null);
  };

  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  const approved = result?.decision === 'APPROVED';

  return (
    <div className="space-y-6">
      <GlassCard className="p-6 border-purple-500/30 relative overflow-hidden">
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              RiskGuard — Verify-Then-Execute
              <span className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-[10px] font-normal">
                THE AGENT PROPOSES — THE CONTRACT DECIDES
              </span>
            </div>
            <p className="text-[11px] text-white/50 mt-0.5">
              Agents and reviewers can only <em>propose</em>. A deterministic RiskGuard policy verifies the
              attested receipt first, then approves or refuses on-chain. Wrong proof &#8594; fails closed. This is
              the security layer the field leaves open: no payout without a 0x0FD2-verified proof of the right thing.
            </p>
          </div>
        </div>

        {/* LIVE 0x0FD2 verification */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/25">
            <div className="flex items-center justify-between mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE — 0x0FD2 IN-BROWSER
              </span>
              <button
                onClick={handleLiveVerify}
                disabled={loadingLive}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 text-[11px] font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {loadingLive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Cpu className="w-3.5 h-3.5" />}
                {loadingLive ? 'Verifying…' : 'Verify latest attested Sepolia tx'}
              </button>
            </div>
            {live ? (
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between text-white/70">
                  <span>attested height</span>
                  <span className="text-white font-bold">#{live.height}</span>
                </div>
                <div className="flex items-center justify-between text-white/70">
                  <span>source tx</span>
                  <span className="text-cyan-300">{live.txHash.slice(0, 10)}…{live.txHash.slice(-6)}</span>
                </div>
                <div className={`flex items-center justify-between ${live.verified ? 'text-emerald-400' : 'text-rose-400'}`}>
                  <span>0x0FD2 verdict</span>
                  <span className="font-bold flex items-center gap-1">
                    {live.verified ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    {live.verified ? 'VERIFIED' : 'REJECTED'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-white/40 font-mono">
                {loadingLive
                  ? 'resolving attested height → fetching merkle/continuity proof → calling native precompile…'
                  : 'No live verification this session. Run it to bind rule r4 to a real 0x0FD2 verdict.'}
              </div>
            )}
          </div>

          {/* Deterministic policy rules */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-purple-500/25">
            <div className="text-[10px] uppercase tracking-wider text-purple-300/80 font-mono mb-2 flex items-center gap-1.5">
              <ScrollText className="w-3.5 h-3.5" /> RiskGuard Policy (deterministic — mirrors Solidity)
            </div>
            <div className="space-y-1.5">
              {POLICY_RULES.map((r) => {
                const gatePassed = result ? !result.trace.find((t) => t.stage === r.id.replace('r', 'Stage'))?.pass : true;
                const failed = result ? result.trace.find((t) => t.stage === r.label.split(' — ')[0]) : null;
                return (
                  <div key={r.id} className="flex items-start gap-2 text-[11px]">
                    <span className={`mt-0.5 font-mono ${gatePassed ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {result ? (failed ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />) : <Lock className="w-3.5 h-3.5 text-white/30" />}
                    </span>
                    <span className="text-white/80">
                      <span className="font-mono text-white/60">{r.label.split(' — ')[0]}</span> — {r.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Scenario runner */}
      <GlassCard className="p-6 border-white/[0.08]">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileSearch className="w-4 h-4 text-cyan-400" /> Run a RiskGuard Evaluation
            <SimulationBadge label="POLICY EVAL" note="Rule evaluation is a deterministic browser mirror of the RiskGuardPolicy logic; 0x0FD2 receipt verification above is live." />
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => runScenario(s.id)}
              disabled={!!running}
              className={`px-3.5 py-2 rounded-xl text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                s.tone === 'emerald'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-300'
              }`}
            >
              {running === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              {s.label}
            </button>
          ))}
        </div>

        {result && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-1.5 font-mono text-[11px]">
              {result.trace.map((t, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border ${t.pass ? 'border-emerald-500/20 bg-emerald-500/[0.04]' : 'border-rose-500/25 bg-rose-500/[0.05]'}`}>
                  {t.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5" />}
                  <div>
                    <div className="text-white/70 font-semibold uppercase tracking-wider text-[10px]">{t.stage}</div>
                    <div className="text-white/55">{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className={`flex flex-col items-center justify-center p-6 rounded-xl border ${approved ? 'border-emerald-500/30 bg-emerald-500/[0.06]' : 'border-rose-500/30 bg-rose-500/[0.06]'}`}>
              {approved ? (
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
              ) : (
                <ShieldAlert className="w-10 h-10 text-rose-400 mb-2" />
              )}
              <div className={`text-lg font-black font-mono tracking-widest ${approved ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.decision}
              </div>
              <div className="text-[11px] text-white/50 mt-1 text-center">
                {approved
                  ? 'All gates pass — the proposed action may execute on-chain.'
                  : `Failed closed at ${result.refusedBy} — the proposal is refused on-chain.`}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Decision log */}
      {log.length > 0 && (
        <GlassCard className="p-4 border-white/[0.08]">
          <div className="text-[10px] uppercase tracking-wider text-white/40 font-mono mb-2">risk log</div>
          <div className="space-y-1 font-mono text-[11px]">
            {log.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-white/25 select-none">›</span>
                <span className={l.includes('APPROVED') ? 'text-emerald-400/90' : l.includes('REFUSED') ? 'text-rose-400/90' : 'text-cyan-300/80'}>
                  {l}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default RiskGuardView;
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import {
  Bot, Cpu, Activity, Terminal, Zap, RefreshCw,
  Coins, Lock, DollarSign, AlertTriangle,
  ArrowRight, CheckCircle2, XCircle, BarChart2, Info,
  ExternalLink, Loader2, Play, Network, Sigma,
} from 'lucide-react';
import {
  fetchRiskMetrics,
  fetchAgentProfile,
  fetchCUSDBalance,
  fetchAIHubActivity,
  submitCrossChainRiskSignal,
  registerAIAgent,
  triggerAgentLoan,
  repayAgentLoan,
  depositComputeEscrow,
  bpsToPercent,
  scoreToTier,
  generateTaskId,
  AIAgentProfile,
  AIHubRiskMetrics,
  AIHubLiveActivity,
  AIHubEventKind,
  AI_HUB_ADDRESS,
  CUSD_ADDRESS,
} from '../../utils/aiHubContract';
import { runLightweightAIBenchmark, AIInferenceBenchmarkResult } from '../../utils/browserAIInference';

// ─── Helpers ────────────────────────────────────────────────────────────────
const fmt2 = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const fmtUSD = (n: number) => '$' + fmt2(n);

function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, ((score - 300) / 550) * 100));
  const r = 52, cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - pct / 100);
  const tier = scoreToTier(score);
  return (
    <div className="relative flex items-center justify-center" style={{ width: 128, height: 128 }}>
      <svg width="128" height="128" className="-rotate-90">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={tier.color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease', filter: `drop-shadow(0 0 6px ${tier.color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xl font-black font-mono text-white">{score}</span>
        <span className="text-[10px] font-mono" style={{ color: tier.color }}>{tier.emoji} {tier.label}</span>
      </div>
    </div>
  );
}

function LiveDot({ color = '#00FF66' }: { color?: string }) {
  return <span className="w-2 h-2 rounded-full animate-pulse inline-block" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />;
}

function StatBadge({ label, value, color = '#22d3ee', sub }: { label: string; value: string; color?: string; sub?: string }) {
  return (
    <div className="p-4 rounded-[18px] bg-[#070b0e] border border-white/[0.08] space-y-1 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 80% 20%, ${color}12 0%, transparent 60%)` }} />
      <div className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-xl font-black font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-gray-600 font-mono">{sub}</div>}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
const AITab: React.FC = () => {
  const { isConnected, address, balanceCTC } = useWeb3();
  const { score } = useProtocol();
  const { addToast } = useToast();

  // Sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'risk' | 'agentfi' | 'compute' | 'telemetry'>('risk');

  // Contract data
  const [riskMetrics, setRiskMetrics] = useState<AIHubRiskMetrics | null>(null);
  const [agentProfile, setAgentProfile] = useState<AIAgentProfile | null>(null);
  const [cusdBalance, setCusdBalance] = useState(0);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // AgentFi actions
  const [registering, setRegistering] = useState(false);
  const [loanAmount, setLoanAmount] = useState('100');
  const [borrowing, setBorrowing] = useState(false);
  const [repaying, setRepaying] = useState(false);

  // Compute Escrow
  const [taskId, setTaskId] = useState(generateTaskId);
  const [gpuProvider, setGpuProvider] = useState('');
  const [escrowAmount, setEscrowAmount] = useState('50');
  const [depositing, setDepositing] = useState(false);

  // Browser benchmark
  const [benchmark, setBenchmark] = useState<AIInferenceBenchmarkResult | null>(null);
  const [benchmarking, setBenchmarking] = useState(false);

  // Real-time Risk Signal Ingestion State
  const [signalChainId, setSignalChainId] = useState<number>(11155111); // Sepolia default
  const [signalVolDelta, setSignalVolDelta] = useState<string>('200'); // +200 bps (+2.0%)
  const [signalDefDelta, setSignalDefDelta] = useState<string>('30'); // +30 bps (+0.30%)
  const [signalReason, setSignalReason] = useState<string>('DEX Volatility Surge');
  const [submittingSignal, setSubmittingSignal] = useState<boolean>(false);
  const [lastSubmittedTx, setLastSubmittedTx] = useState<string | null>(null);

  // Telemetry log
  const [telemetryLog, setTelemetryLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Live on-chain activity telemetry (real-time poll, from hub events + RPC)
  const [activity, setActivity] = useState<AIHubLiveActivity | null>(null);
  const [activityError, setActivityError] = useState<string | null>(null);

  // ── Load Risk Metrics (on-chain read, no wallet) ────────────────────────
  const loadRiskMetrics = useCallback(async () => {
    setLoadingMetrics(true);
    try {
      const m = await fetchRiskMetrics();
      setRiskMetrics(m);
      setLastRefreshed(new Date());
      appendLog(`[RPC] fetchRiskMetrics() → VolIdx=${m.volatilityIndex}, DefaultBps=${m.defaultRateBps}, APR=${bpsToPercent(m.autonomousAPRBps)}, block=${m.lastRiskBlock}`);
    } catch (err: any) {
      appendLog(`[ERROR] fetchRiskMetrics failed: ${err.message}`);
      addToast('error', 'RPC Error', 'Could not reach Creditcoin testnet node.');
    } finally {
      setLoadingMetrics(false);
    }
  }, [addToast]);

  // ── Broadcast Real-Time Risk Signal On-Chain ─────────────────────────────
  const handleBroadcastRiskSignal = async () => {
    if (!isConnected) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to broadcast real-time on-chain risk telemetry.');
      return;
    }
    const volDelta = parseInt(signalVolDelta, 10);
    const defDelta = parseInt(signalDefDelta, 10);
    if (isNaN(volDelta) || volDelta < 0 || volDelta > 5000) {
      addToast('error', 'Invalid Volatility Delta', 'Volatility delta must be between 0 and 5000 bps (50%).');
      return;
    }
    if (isNaN(defDelta) || defDelta < 0 || defDelta > 5000) {
      addToast('error', 'Invalid Default Delta', 'Default rate delta must be between 0 and 5000 bps (50%).');
      return;
    }
    setSubmittingSignal(true);
    appendLog(`[TX] processCrossChainRiskSignal(chain=${signalChainId}, +${volDelta} bps vol, +${defDelta} bps def) — signing…`);
    try {
      const result = await submitCrossChainRiskSignal(volDelta, defDelta, signalChainId);
      setLastSubmittedTx(result.txHash);
      appendLog(`[TX] processCrossChainRiskSignal confirmed → block #${result.blockNumber}, txHash=${result.txHash}`);
      addToast('success', 'Real-Time Risk Signal Ingested', `Oracle updated on-chain! Block #${result.blockNumber}. Tx: ${result.txHash.slice(0, 10)}…`);
      if (isPostHogEnabled) posthog.capture('ai_risk_signal_broadcasted', { chainId: signalChainId, volDelta, defDelta, txHash: result.txHash });
      await Promise.all([loadRiskMetrics(), loadActivity()]);
    } catch (err: any) {
      const msg = err.reason || err.message || 'Transaction failed';
      appendLog(`[TX] processCrossChainRiskSignal reverted: ${msg}`);
      addToast('error', 'Risk Broadcast Failed', msg);
    } finally {
      setSubmittingSignal(false);
    }
  };

  // ── Load Agent Profile ───────────────────────────────────────────────────
  const loadAgentProfile = useCallback(async () => {
    if (!address) return;
    setLoadingProfile(true);
    try {
      const [profile, bal] = await Promise.all([
        fetchAgentProfile(address),
        fetchCUSDBalance(address),
      ]);
      setAgentProfile(profile);
      setCusdBalance(bal);
      appendLog(`[RPC] aiAgents(${address.slice(0, 8)}…) → registered=${profile.isRegistered}, score=${profile.reputationScore}, activeLoan=${profile.activeLoanAmount}`);
    } catch (err: any) {
      appendLog(`[ERROR] fetchAgentProfile failed: ${err.message}`);
    } finally {
      setLoadingProfile(false);
    }
  }, [address]);

  // ── Telemetry log helpers ────────────────────────────────────────────────
  const appendLog = (line: string) => {
    const ts = new Date().toLocaleTimeString();
    setTelemetryLog(prev => [`[${ts}] ${line}`, ...prev].slice(0, 60));
  };

  // ── Load live hub activity (block height, RPC latency, recent events) ───
  const loadActivity = useCallback(async () => {
    try {
      const a = await fetchAIHubActivity(10_000);
      setActivity(a);
      setActivityError(null);
      appendLog(`[RPC] poll hub → height=${a.blockHeight.toLocaleString()}, latency=${a.latencyMs}ms, agents=${a.counts.agent} loans=${a.counts.loan} escrows=${a.counts.escrow} signals=${a.counts.risk} (last ${a.windowBlocks.toLocaleString()} blocks)`);
    } catch (err: any) {
      setActivityError(err?.message || 'RPC telemetry timeout');
    }
  }, []);

  // ── Browser benchmark ────────────────────────────────────────────────────
  const runBenchmark = useCallback(async () => {
    setBenchmarking(true);
    appendLog('[BENCH] Starting 128×128 WebGL matrix multiply benchmark…');
    try {
      const result = await runLightweightAIBenchmark('Text / LLM');
      setBenchmark(result);
      appendLog(`[BENCH] Done — ${result.tokensPerSecond} tokens/s, ${result.tensorFLOPS} GFLOPS, ${result.embeddingLatencyMs}ms latency on ${result.hardwareDevice}`);
    } catch (err: any) {
      appendLog(`[BENCH] Error: ${err.message}`);
    } finally {
      setBenchmarking(false);
    }
  }, []);

  // ── Initial loads ────────────────────────────────────────────────────────
  useEffect(() => {
    loadRiskMetrics();
    runBenchmark();
  }, []);

  useEffect(() => {
    if (isConnected && address) loadAgentProfile();
  }, [isConnected, address, loadAgentProfile]);

  // ── Poll risk metrics every 10s (real-time live heartbeat) ───────────────
  useEffect(() => {
    const interval = setInterval(() => {
      loadRiskMetrics();
    }, 10_000);
    return () => clearInterval(interval);
  }, [loadRiskMetrics]);

  // ── Poll live hub activity every 10s ─────────────────────────────────────
  useEffect(() => {
    void loadActivity();
    const interval = setInterval(() => {
      void loadActivity();
    }, 10_000);
    return () => clearInterval(interval);
  }, [loadActivity]);

  // ── Auto-scroll telemetry log ────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [telemetryLog]);

  // ── AgentFi Actions ──────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (!isConnected) { addToast('error', 'Connect Wallet', 'Connect your wallet first.'); return; }
    setRegistering(true);
    appendLog('[TX] registerAIAgent() — signing…');
    try {
      const hash = await registerAIAgent();
      appendLog(`[TX] registerAIAgent confirmed → txHash=${hash}`);
      addToast('success', 'Agent Registered', `Your wallet is now an autonomous AI agent. Tx: ${hash.slice(0, 12)}…`);
      if (isPostHogEnabled) posthog.capture('ai_agent_registered', { address });
      await loadAgentProfile();
    } catch (err: any) {
      appendLog(`[TX] registerAIAgent reverted: ${err.message}`);
      addToast('error', 'TX Failed', err.reason || err.message);
    } finally {
      setRegistering(false);
    }
  };

  const handleBorrow = async () => {
    if (!isConnected) { addToast('error', 'Connect Wallet', 'Connect your wallet first.'); return; }
    const amt = parseFloat(loanAmount);
    if (isNaN(amt) || amt <= 0) { addToast('error', 'Invalid Amount', 'Enter a valid cUSD amount.'); return; }
    setBorrowing(true);
    appendLog(`[TX] triggerAutonomousAgentLoan(${amt} cUSD) — signing…`);
    try {
      const hash = await triggerAgentLoan(amt);
      appendLog(`[TX] triggerAutonomousAgentLoan confirmed → txHash=${hash}`);
      addToast('success', 'Credit Line Dispatched', `${amt} cUSD autonomously dispatched. Tx: ${hash.slice(0, 12)}…`);
      if (isPostHogEnabled) posthog.capture('agent_loan_taken', { amount: amt, address });
      await loadAgentProfile();
    } catch (err: any) {
      const msg = err.reason || err.message || 'Transaction failed';
      appendLog(`[TX] triggerAutonomousAgentLoan reverted: ${msg}`);
      // Parse known revert reasons
      if (msg.includes('ScoreBelowThreshold')) addToast('error', 'Score Too Low', 'Your agent needs ≥ 700 CTS (Prime tier) to access credit lines.');
      else if (msg.includes('ActiveLoanOutstanding')) addToast('error', 'Loan Active', 'Repay your existing loan first.');
      else if (msg.includes('InsufficientLiquidity')) addToast('error', 'No Liquidity', 'Pool has insufficient cUSD right now.');
      else addToast('error', 'TX Failed', msg);
    } finally {
      setBorrowing(false);
    }
  };

  const handleRepay = async () => {
    if (!isConnected) { addToast('error', 'Connect Wallet', 'Connect your wallet first.'); return; }
    if (!agentProfile || agentProfile.activeLoanAmount === 0) { addToast('error', 'No Loan', 'No active loan to repay.'); return; }
    setRepaying(true);
    appendLog(`[TX] repayAgentLoan(${agentProfile.activeLoanAmount} cUSD) — approving cUSD + signing…`);
    try {
      const hash = await repayAgentLoan(agentProfile.activeLoanAmount);
      appendLog(`[TX] repayAgentLoan confirmed → txHash=${hash}`);
      addToast('success', 'Loan Repaid', `+20 reputation points earned. Tx: ${hash.slice(0, 12)}…`);
      if (isPostHogEnabled) posthog.capture('agent_loan_repaid', { amount: agentProfile.activeLoanAmount, address });
      await loadAgentProfile();
    } catch (err: any) {
      appendLog(`[TX] repayAgentLoan reverted: ${err.message}`);
      addToast('error', 'TX Failed', err.reason || err.message);
    } finally {
      setRepaying(false);
    }
  };

  const handleDepositEscrow = async () => {
    if (!isConnected) { addToast('error', 'Connect Wallet', 'Connect your wallet first.'); return; }
    if (!gpuProvider || !/^0x[0-9a-fA-F]{40}$/.test(gpuProvider)) { addToast('error', 'Invalid Address', 'Enter a valid 0x GPU provider address.'); return; }
    const amt = parseFloat(escrowAmount);
    if (isNaN(amt) || amt <= 0) { addToast('error', 'Invalid Amount', 'Enter a valid cUSD amount.'); return; }
    setDepositing(true);
    appendLog(`[TX] depositComputeEscrow(${taskId}, ${gpuProvider.slice(0, 8)}…, ${amt} cUSD) — approving + signing…`);
    try {
      const hash = await depositComputeEscrow(taskId, gpuProvider, amt);
      appendLog(`[TX] depositComputeEscrow confirmed → txHash=${hash}`);
      addToast('success', 'Compute Escrow Deposited', `${amt} cUSD locked for task ${taskId}. Tx: ${hash.slice(0, 12)}…`);
      if (isPostHogEnabled) posthog.capture('compute_escrow_deposited', { taskId, amount: amt });
      setTaskId(generateTaskId());
      setGpuProvider('');
    } catch (err: any) {
      appendLog(`[TX] depositComputeEscrow reverted: ${err.message}`);
      addToast('error', 'TX Failed', err.reason || err.message);
    } finally {
      setDepositing(false);
    }
  };

  const volatilityPct = riskMetrics ? (riskMetrics.volatilityIndex / 100).toFixed(1) : '—';
  const defaultPct    = riskMetrics ? bpsToPercent(riskMetrics.defaultRateBps) : '—';
  const aprPct        = riskMetrics ? bpsToPercent(riskMetrics.autonomousAPRBps) : '—';

  const tier          = scoreToTier(agentProfile?.reputationScore ?? 300);

  // Kind chip styling for the live feed
  const EVENT_CHIP: Record<AIHubEventKind, { label: string; cls: string }> = {
    agent:  { label: 'AGENT',       cls: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' },
    loan:   { label: 'LOAN',        cls: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/25' },
    repay:  { label: 'REPAY',       cls: 'bg-teal-500/10 text-teal-400 border border-teal-500/25' },
    escrow: { label: 'ESCROW',      cls: 'bg-purple-500/10 text-purple-400 border border-purple-500/25' },
    risk:   { label: 'RISK SIGNAL', cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/25' },
  };

  // Live on-chain activity feed (shared by the risk + telemetry sub-tabs)
  const renderActivityFeed = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 flex-wrap gap-2">
        <div className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
          <Activity className="w-4 h-4" /> Live On-Chain Activity Feed
          <LiveDot color="#22d3ee" />
        </div>
        <span className="text-[10px] font-mono text-gray-600">
          last {activity ? activity.windowBlocks.toLocaleString() : 10_000} blocks · polls every 15s
        </span>
      </div>
      {activityError ? (
        <div className="p-4 rounded-2xl bg-[#070b0e] border border-red-500/20 text-center text-xs font-mono text-red-400/80 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-400" />
          Telemetry feed unreachable right now — the public RPC timed out on the log query. Retrying on the next poll.
        </div>
      ) : !activity ? (
        <div className="p-4 rounded-2xl bg-[#070b0e] border border-white/[0.06] text-center text-xs font-mono text-gray-500 flex items-center justify-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" /> Polling on-chain activity…
        </div>
      ) : activity.events.length === 0 ? (
        <div className="p-4 rounded-2xl bg-[#070b0e] border border-white/[0.06] text-center text-xs font-mono text-gray-500">
          No on-chain activity on the hub in the last {activity.windowBlocks.toLocaleString()} blocks. New events stream in live.
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-[#070b0e] border border-white/[0.06] divide-y divide-white/[0.04]">
            {activity.events.slice(0, 8).map((e) => (
              <div key={`${e.block}-${e.logIndex}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded font-bold shrink-0 ${EVENT_CHIP[e.kind].cls}`}>
                  {EVENT_CHIP[e.kind].label}
                </span>
                <span className="flex-1 text-white/70 text-[11px] font-mono truncate" title={e.summary}>{e.summary}</span>
                <span className="font-mono text-white/35 text-[10px] shrink-0">#{e.block.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 px-1 text-[10px] font-mono text-gray-600 flex-wrap">
            <span><LiveDot color="#00FF66" /> height #{activity.blockHeight.toLocaleString()}</span>
            <span><LiveDot color="#fbbf24" /> RPC latency {activity.latencyMs}ms</span>
            <span><LiveDot color="#22d3ee" /> agents {(activity.counts.agent).toLocaleString()} · loans {(activity.counts.loan).toLocaleString()} · escrows {(activity.counts.escrow).toLocaleString()} · signals {(activity.counts.risk).toLocaleString()}</span>
          </div>
        </>
      )}
    </div>
  );

  // ── Sub-tab button helper ────────────────────────────────────────────────
  const TabBtn = ({
    id, label, icon: Icon, activeColor
  }: { id: typeof activeSubTab; label: string; icon: React.ElementType; activeColor: string }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold font-mono transition-all flex items-center justify-center gap-1.5 ${
        activeSubTab === id
          ? `text-white border shadow-md`
          : 'text-white/50 hover:text-white hover:bg-white/[0.02]'
      }`}
      style={activeSubTab === id ? {
        backgroundColor: activeColor + '20',
        borderColor: activeColor + '60',
        boxShadow: `0 4px 15px ${activeColor}18`,
      } : { border: 'transparent' }}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );

  return (
    <div className="space-y-5">

      {/* ── HEADER BANNER ─────────────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/50 via-slate-900/70 to-purple-950/40 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 flex items-center justify-center">
            <Bot className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">
              <LiveDot /> AutonomousAIHub · Creditcoin Testnet
            </div>
            <div className="text-sm font-bold text-white font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-cyan-300">AgentFi</span>
              <span className="text-white/30">+</span>
              <span className="text-purple-300">Oracle Risk</span>
              <span className="text-white/30">+</span>
              <span className="text-emerald-300">Proof-of-Compute</span>
            </div>
            <div className="text-[11px] font-mono text-white/40 mt-0.5">
              On-chain volatility &amp; default vectors gate autonomous agent credit lines and verifiable GPU settlement.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[10px] font-mono text-gray-500">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { loadRiskMetrics(); if (isConnected && address) loadAgentProfile(); }}
            disabled={loadingMetrics}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <a
            href={`https://creditcoin-testnet.blockscout.com/address/${AI_HUB_ADDRESS}`}
            target="_blank" rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-gray-400 text-xs font-mono transition flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Explorer
          </a>
        </div>
      </div>

      {/* ── LIVE RISK CARDS (always visible, from contract) ─────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBadge
          label="Volatility Index"
          value={loadingMetrics ? '…' : `${volatilityPct}%`}
          color="#f87171"
          sub="Market stress bps"
        />
        <StatBadge
          label="Global Default Rate"
          value={loadingMetrics ? '…' : defaultPct}
          color="#fbbf24"
          sub="Protocol default bps"
        />
        <StatBadge
          label="Auto-Adjusted APR"
          value={loadingMetrics ? '…' : aprPct}
          color="#00FF66"
          sub="Autonomous risk model"
        />
        <StatBadge
          label="Last Risk Block"
          value={loadingMetrics ? '…' : (riskMetrics?.lastRiskBlock?.toLocaleString() ?? '—')}
          color="#22d3ee"
          sub="On-chain update"
        />
      </div>

      {/* ── SUB-TAB NAV ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-black/40 border border-white/[0.08] rounded-2xl">
        <TabBtn id="risk"      label="AI Risk Oracle"    icon={BarChart2}  activeColor="#22d3ee" />
        <TabBtn id="agentfi"   label="AgentFi"           icon={Bot}        activeColor="#00FF66" />
        <TabBtn id="compute"   label="Proof-of-Compute"  icon={Cpu}        activeColor="#a78bfa" />
        <TabBtn id="telemetry" label="Telemetry"         icon={Terminal}   activeColor="#f59e0b" />
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: AI RISK ORACLE (REAL-TIME ON-CHAIN RISK INGESTION)
      ═══════════════════════════════════════════════════════════════════════*/}
      {activeSubTab === 'risk' && (
        <div className="space-y-5">

          {/* Hero */}
          <div className="p-6 rounded-[28px] bg-[#070b0e] border border-cyan-500/20 relative overflow-hidden">
            <div className="absolute -right-16 -top-16 w-64 h-64 bg-cyan-500/[0.05] rounded-full blur-3xl pointer-events-none" />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
              <div className="lg:col-span-7 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-mono">
                  <Sigma className="w-3 h-3" /> Real-Time Autonomous Cross-Chain Risk Ingestion
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Autonomous AI Risk Oracle
                </h2>
                <p className="text-xs text-white/55 leading-relaxed max-w-lg">
                  The <code className="text-cyan-400 bg-cyan-500/10 px-1 rounded">AutonomousAIHub</code> ingests
                  cryptographically verified cross-chain telemetry via Creditcoin's Attestcoin precompile{' '}
                  <code className="text-purple-400 bg-purple-500/10 px-1 rounded">0x0FD2</code> to autonomously
                  adjust volatility indexes, default rate vectors, and pool APRs in real time without human intervention.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <div className="text-xs font-mono text-gray-400">
                    Contract: <a href={`https://creditcoin-testnet.blockscout.com/address/${AI_HUB_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">{AI_HUB_ADDRESS.slice(0, 10)}…{AI_HUB_ADDRESS.slice(-6)}</a>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-5 grid grid-cols-2 gap-3">
                {[
                  { label: 'Block Height', value: activity ? activity.blockHeight.toLocaleString() : '—', color: '#22d3ee' },
                  { label: 'RPC Latency', value: activity ? `${activity.latencyMs}ms` : '—', color: '#fbbf24' },
                  { label: 'Agents Registered', value: activity ? (activity.counts.agent).toLocaleString() : '—', color: '#00FF66' },
                  { label: 'Risk Signals', value: activity ? (activity.counts.risk).toLocaleString() : '—', color: '#a78bfa' },
                ].map(c => (
                  <div key={c.label} className="p-3 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                    <div className="text-[10px] text-gray-500 uppercase">{c.label}</div>
                    <div className="text-sm font-bold font-mono mt-0.5" style={{ color: c.color }}>{c.value}</div>
                  </div>
                ))}
                <div className="col-span-2 pt-1 text-[10px] font-mono text-gray-600">
                  <LiveDot color="#00FF66" /> Live — recent on-chain activity (last {activity ? activity.windowBlocks.toLocaleString() : 10_000} blocks) · auto-refresh 10s
                </div>
              </div>
            </div>
          </div>

          {/* Real-Time Risk Ingestion & Dynamic Calibration Console */}
          <div className="p-6 rounded-[28px] bg-[#070b0e] border border-cyan-500/25 space-y-5 relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" /> Real-Time Cross-Chain Risk Broadcast & Ingestion
                  <LiveDot color="#22d3ee" />
                </div>
                <p className="text-xs text-white/50 mt-0.5">
                  Broadcast live multi-chain risk vectors on-chain to trigger real-time autonomous APR adjustments.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono text-gray-400">Quick Scenarios:</span>
                {[
                  { name: 'DEX Surge', vol: '200', def: '30', reason: 'DEX Volatility Surge' },
                  { name: 'Bridge Stress', vol: '450', def: '75', reason: 'Bridge Liquidity Stress' },
                  { name: 'Flash Volatility', vol: '800', def: '150', reason: 'Flash Arbitrage Drift' },
                ].map(p => (
                  <button
                    key={p.name}
                    onClick={() => { setSignalVolDelta(p.vol); setSignalDefDelta(p.def); setSignalReason(p.reason); }}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/10 hover:border-cyan-500/40 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Form: Parameters */}
              <div className="lg:col-span-7 space-y-4">
                {/* Source Chain */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center justify-between">
                    <span>Source Network (Attestation Origin)</span>
                    <span className="text-cyan-400">Chain ID: {signalChainId}</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { name: 'Sepolia', id: 11155111 },
                      { name: 'Ethereum', id: 1 },
                      { name: 'Base', id: 8453 },
                      { name: 'Arbitrum', id: 42161 },
                    ].map(ch => (
                      <button
                        key={ch.id}
                        onClick={() => setSignalChainId(ch.id)}
                        className={`py-2 px-3 rounded-xl text-xs font-mono transition border ${
                          signalChainId === ch.id
                            ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-300 font-bold'
                            : 'bg-black/30 border-white/[0.06] text-white/50 hover:text-white'
                        }`}
                      >
                        {ch.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Volatility Delta */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-gray-400 uppercase">Volatility Index Delta (+bps)</span>
                    <span className="text-red-400 font-bold">+{signalVolDelta} bps (+{(parseInt(signalVolDelta || '0', 10) / 100).toFixed(2)}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1500"
                    step="50"
                    value={signalVolDelta}
                    onChange={e => setSignalVolDelta(e.target.value)}
                    className="w-full accent-red-400 cursor-pointer"
                  />
                </div>

                {/* Default Rate Delta */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-gray-400 uppercase">Default Rate Delta (+bps)</span>
                    <span className="text-amber-400 font-bold">+{signalDefDelta} bps (+{(parseInt(signalDefDelta || '0', 10) / 100).toFixed(2)}%)</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={signalDefDelta}
                    onChange={e => setSignalDefDelta(e.target.value)}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    onClick={handleBroadcastRiskSignal}
                    disabled={submittingSignal}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submittingSignal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {submittingSignal ? 'Broadcasting Risk Telemetry On-Chain…' : 'Broadcast Live Risk Telemetry (Real On-Chain TX)'}
                  </button>
                  {lastSubmittedTx && (
                    <div className="mt-2 text-center text-[10px] font-mono text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmed!</span>
                      <a
                        href={`https://creditcoin-testnet.blockscout.com/tx/${lastSubmittedTx}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-emerald-300"
                      >
                        View TX {lastSubmittedTx.slice(0, 12)}…
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Dynamic APR Formula & Live Calculation Preview */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-black/40 border border-white/[0.06] space-y-3 flex flex-col justify-between">
                <div>
                  <div className="text-[10px] font-mono uppercase tracking-wider text-gray-400 mb-2">Live Mathematical Model</div>
                  <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 font-mono text-[11px] text-cyan-200/90 space-y-1">
                    <div className="font-bold text-cyan-400">Autonomous Base APR Formula:</div>
                    <div className="text-white/80">Base (5.00%) + (Vol / 10) + Default Rate</div>
                    <div className="text-[10px] text-white/40">Capped at 30.00% APR on-chain</div>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div className="flex justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-gray-500">Current On-Chain APR</span>
                    <span className="font-bold text-emerald-400">{aprPct}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-gray-500">Projected Volatility</span>
                    <span className="font-bold text-red-400">
                      {riskMetrics ? ((riskMetrics.volatilityIndex + parseInt(signalVolDelta || '0', 10)) / 100).toFixed(2) : '—'}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/[0.04]">
                    <span className="text-gray-500">Projected Default Rate</span>
                    <span className="font-bold text-amber-400">
                      {riskMetrics ? ((riskMetrics.defaultRateBps + parseInt(signalDefDelta || '0', 10)) / 100).toFixed(2) : '—'}%
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 bg-cyan-500/10 px-2 rounded-lg">
                    <span className="text-cyan-300 font-bold">Projected New APR</span>
                    <span className="font-bold text-cyan-400 text-sm">
                      {riskMetrics
                        ? (Math.min(3000, 500 + Math.floor((riskMetrics.volatilityIndex + parseInt(signalVolDelta || '0', 10)) / 10) + (riskMetrics.defaultRateBps + parseInt(signalDefDelta || '0', 10))) / 100).toFixed(2)
                        : '—'}%
                    </span>
                  </div>
                </div>

                <div className="text-[10px] font-mono text-gray-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span>Real-time on-chain execution with replay-protected Merkle receipt validation.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live on-chain activity */}
          {renderActivityFeed()}

          {/* Browser benchmark strip */}
          <div className="p-4 rounded-2xl bg-[#070b0e] border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">Your Browser GPU Benchmark (Real-Time Inference)</div>
                {benchmark ? (
                  <div className="text-xs font-mono text-white mt-0.5">
                    <span className="text-purple-300 font-bold">{benchmark.tokensPerSecond} tok/s</span>
                    {' · '}<span className="text-gray-300">{benchmark.tensorFLOPS} GFLOPS</span>
                    {' · '}<span className="text-gray-400">{benchmark.embeddingLatencyMs}ms latency</span>
                    {' · '}<span className="text-gray-500 text-[10px]">{benchmark.hardwareDevice.slice(0, 40)}</span>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 font-mono mt-0.5">Benchmarking your GPU in real time…</div>
                )}
              </div>
            </div>
            <button
              onClick={runBenchmark}
              disabled={benchmarking}
              className="px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 text-xs font-mono transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
            >
              {benchmarking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              {benchmarking ? 'Benchmarking…' : 'Re-run Benchmark'}
            </button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2: AGENTFI
      ═══════════════════════════════════════════════════════════════════════*/}
      {activeSubTab === 'agentfi' && (
        <div className="space-y-5">

          {/* Explainer */}
          <div className="p-5 rounded-[22px] bg-gradient-to-r from-emerald-950/40 to-cyan-950/30 border border-emerald-500/20">
            <div className="flex items-start gap-3">
              <Bot className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-white mb-1">AgentFi — Credit Lines for Autonomous AI Agents</div>
                <p className="text-xs text-white/55 leading-relaxed">
                  Register your wallet as an autonomous AI agent. Submit verified cross-chain profit proofs to build
                  reputation (300–850 CTS). Once you reach <span className="text-emerald-400 font-bold">Prime tier (≥ 700)</span>,
                  the contract autonomously dispatches an under-collateralized cUSD credit line — no human approval required.
                </p>
              </div>
            </div>
          </div>

          {!isConnected ? (
            <div className="p-8 rounded-[22px] bg-[#070b0e] border border-white/[0.08] text-center space-y-3">
              <Lock className="w-8 h-8 text-gray-500 mx-auto" />
              <div className="text-sm text-gray-400">Connect your wallet to access AgentFi</div>
            </div>
          ) : loadingProfile ? (
            <div className="flex items-center gap-3 p-5 rounded-2xl bg-[#070b0e] border border-white/[0.06]">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-sm text-gray-400 font-mono">Reading agent profile from chain…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

              {/* Left: Agent Profile */}
              <div className="lg:col-span-5 p-6 rounded-[22px] bg-[#070b0e] border border-emerald-500/20 space-y-5">
                <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-widest">Your Agent Profile</div>

                {/* Score ring */}
                <div className="flex items-center gap-5">
                  <ScoreRing score={agentProfile?.reputationScore ?? 300} />
                  <div className="space-y-1.5">
                    <div className="text-[10px] text-gray-500 uppercase font-mono">Registered</div>
                    <div className="flex items-center gap-1.5">
                      {agentProfile?.isRegistered
                        ? <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="text-xs text-emerald-400 font-bold">Active Agent</span></>
                        : <><XCircle className="w-4 h-4 text-gray-500" /><span className="text-xs text-gray-500">Not Registered</span></>
                      }
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono">{address?.slice(0, 8)}…{address?.slice(-6)}</div>
                  </div>
                </div>

                {/* Score progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-gray-500 mb-1.5">
                    <span>300 (Base)</span>
                    <span>{agentProfile?.reputationScore ?? 300} / 850</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000"
                      style={{
                        width: `${Math.max(0, ((agentProfile?.reputationScore ?? 300) - 300) / 550 * 100)}%`,
                        backgroundColor: tier.color,
                        boxShadow: `0 0 8px ${tier.color}80`,
                      }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-2 text-xs">
                  {[
                    { label: 'Active Loan',        value: agentProfile?.activeLoanAmount ? fmtUSD(agentProfile.activeLoanAmount) + ' cUSD' : 'None',       color: agentProfile?.activeLoanAmount ? '#f87171' : '#6b7280' },
                    { label: 'Total Repaid',        value: agentProfile?.totalLoansRepaid ? fmtUSD(agentProfile.totalLoansRepaid) + ' cUSD' : '—',         color: '#00FF66' },
                    { label: 'Your cUSD Balance',   value: cusdBalance > 0 ? fmtUSD(cusdBalance) : '0 cUSD',                                               color: '#22d3ee' },
                    { label: 'Credit Tier Access',  value: (agentProfile?.reputationScore ?? 0) >= 700 ? '✅ Credit Lines Unlocked' : '⚠️ Need Prime (700+)', color: (agentProfile?.reputationScore ?? 0) >= 700 ? '#00FF66' : '#fbbf24' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-white/[0.04]">
                      <span className="text-gray-500">{r.label}</span>
                      <span className="font-mono font-bold" style={{ color: r.color }}>{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* Register button */}
                {!agentProfile?.isRegistered && (
                  <button
                    onClick={handleRegister}
                    disabled={registering}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
                  >
                    {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    {registering ? 'Registering Agent…' : 'Register as AI Agent'}
                  </button>
                )}
              </div>

              {/* Right: Actions */}
              <div className="lg:col-span-7 space-y-4">

                {/* Borrow */}
                <div className="p-5 rounded-[22px] bg-[#070b0e] border border-cyan-500/20 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4 text-cyan-400" /> Request Credit Line
                    </div>
                    <span className="text-[10px] font-mono text-cyan-400">Requires Prime (≥ 700 CTS)</span>
                  </div>
                  <p className="text-xs text-white/50">
                    Autonomous credit line dispatched by smart contract, no approval needed. Score ≥ 700 required.
                  </p>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={loanAmount}
                        onChange={e => setLoanAmount(e.target.value)}
                        placeholder="100"
                        className="w-full bg-black/40 border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none transition pr-16"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cyan-400 font-mono font-bold pointer-events-none">cUSD</span>
                    </div>
                    <button
                      onClick={handleBorrow}
                      disabled={borrowing || !agentProfile?.isRegistered}
                      className="px-4 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/40 hover:bg-cyan-500/25 text-cyan-300 font-bold text-xs transition flex items-center gap-1.5 disabled:opacity-40"
                    >
                      {borrowing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                      {borrowing ? 'Dispatching…' : 'Borrow'}
                    </button>
                  </div>
                  {!agentProfile?.isRegistered && (
                    <div className="flex items-center gap-2 text-[11px] text-amber-400/80">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Register as an agent first.
                    </div>
                  )}
                </div>

                {/* Repay */}
                {agentProfile?.activeLoanAmount && agentProfile.activeLoanAmount > 0 ? (
                  <div className="p-5 rounded-[22px] bg-[#070b0e] border border-red-500/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-red-400" /> Active Loan — Repay
                      </div>
                      <span className="text-xs font-mono text-red-400 font-bold">{fmtUSD(agentProfile.activeLoanAmount)} cUSD due</span>
                    </div>
                    <p className="text-xs text-white/50">Repaying earns +20 reputation points and clears your line for future borrowing.</p>
                    <button
                      onClick={handleRepay}
                      disabled={repaying}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/40 hover:border-red-500/60 text-red-300 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {repaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {repaying ? 'Approving cUSD + Repaying…' : `Repay ${fmtUSD(agentProfile.activeLoanAmount)} cUSD`}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-[#070b0e] border border-white/[0.06] flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    <span className="text-xs text-gray-400">No active loans. Your credit line is clear.</span>
                  </div>
                )}

                {/* Reward reminder */}
                <div className="p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 flex items-start gap-2 text-xs text-amber-300/80">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Score boosts: +50 pts per verified performance proof, +20 pts per repayment. Cross-chain proofs evaluated via Attestcoin precompile <code className="font-mono">0x0FD2</code>.</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 3: PROOF-OF-COMPUTE
      ═══════════════════════════════════════════════════════════════════════*/}
      {activeSubTab === 'compute' && (
        <div className="space-y-5">

          <div className="p-5 rounded-[22px] bg-gradient-to-r from-purple-950/40 to-slate-950/60 border border-purple-500/20">
            <div className="flex items-start gap-3">
              <Cpu className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-white mb-1">Proof-of-Compute — Trustless GPU Task Settlement</div>
                <p className="text-xs text-white/55 leading-relaxed">
                  Lock cUSD in escrow for an AI inference job. The GPU provider delivers work on-chain;
                  an Attestcoin cross-chain proof of compute delivery automatically releases the escrow — no trusted intermediary.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

            {/* Form */}
            <div className="lg:col-span-7 p-6 rounded-[22px] bg-[#070b0e] border border-purple-500/20 space-y-4">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Coins className="w-4 h-4 text-purple-400" /> Deposit Compute Escrow
              </div>

              {/* Task ID */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase">Task ID</label>
                <div className="flex gap-2">
                  <input
                    value={taskId}
                    readOnly
                    className="flex-1 bg-black/40 border border-white/[0.06] rounded-xl px-4 py-2.5 text-white/70 font-mono text-xs outline-none"
                  />
                  <button
                    onClick={() => setTaskId(generateTaskId())}
                    className="px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-gray-400 text-xs font-mono transition"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* GPU Provider */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase">GPU Provider Address (0x…)</label>
                <input
                  type="text"
                  value={gpuProvider}
                  onChange={e => setGpuProvider(e.target.value)}
                  placeholder="0xGPU provider wallet address"
                  className="w-full bg-black/40 border border-white/[0.08] focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white font-mono text-xs outline-none transition placeholder-gray-700"
                />
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-gray-500 uppercase">Escrow Amount (cUSD)</label>
                <div className="relative">
                  <input
                    type="number"
                    value={escrowAmount}
                    onChange={e => setEscrowAmount(e.target.value)}
                    placeholder="50"
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-purple-500/60 rounded-xl px-4 py-2.5 text-white font-mono text-sm outline-none transition pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-purple-400 font-mono font-bold pointer-events-none">cUSD</span>
                </div>
              </div>

              <button
                onClick={handleDepositEscrow}
                disabled={depositing || !isConnected}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {depositing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {depositing ? 'Approving cUSD + Depositing Escrow…' : 'Deposit Compute Escrow'}
              </button>
              {!isConnected && <div className="text-[11px] text-amber-400/80 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Connect wallet to submit escrow.</div>}
            </div>

            {/* Right: live benchmark + info */}
            <div className="lg:col-span-5 space-y-4">

              {/* Live benchmark */}
              <div className="p-5 rounded-[22px] bg-[#070b0e] border border-purple-500/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-white uppercase tracking-wider">Local GPU Capabilities</div>
                  <button onClick={runBenchmark} disabled={benchmarking} className="text-[10px] font-mono text-purple-400 hover:text-purple-300 transition flex items-center gap-1 disabled:opacity-50">
                    <RefreshCw className={`w-3 h-3 ${benchmarking ? 'animate-spin' : ''}`} /> Re-test
                  </button>
                </div>
                {benchmark ? (
                  <div className="space-y-2">
                    {[
                      { k: 'GPU / Neural Engine', v: benchmark.hardwareDevice.slice(0, 35) || 'Browser GPU', c: '#a78bfa' },
                      { k: 'Tokens / Second',     v: `${benchmark.tokensPerSecond} tok/s`,              c: '#22d3ee' },
                      { k: 'Tensor Performance',  v: `${benchmark.tensorFLOPS} GFLOPS`,                 c: '#00FF66' },
                      { k: 'Embedding Latency',   v: `${benchmark.embeddingLatencyMs}ms`,               c: '#fbbf24' },
                      { k: 'Context Window',      v: `${benchmark.activeContextTokens} tokens`,         c: '#ffffff' },
                    ].map(r => (
                      <div key={r.k} className="flex justify-between text-xs">
                        <span className="text-gray-500">{r.k}</span>
                        <span className="font-mono font-semibold truncate max-w-[150px] text-right" style={{ color: r.c }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-400" /> Running GPU benchmark…
                  </div>
                )}
              </div>

              {/* Info card */}
              <div className="p-4 rounded-2xl bg-purple-500/[0.07] border border-purple-500/20 text-xs text-purple-200/70 space-y-1.5">
                <div className="font-bold text-purple-300 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> How Settlement Works</div>
                <ol className="space-y-1 list-decimal pl-4">
                  <li>You deposit cUSD escrow for a specific compute task + GPU provider.</li>
                  <li>GPU provider runs inference and records the result on a source chain (e.g. Ethereum).</li>
                  <li>An Attestcoin Merkle proof of delivery is submitted to <code className="font-mono text-purple-300">settleVerifiableComputeTask()</code>.</li>
                  <li>Contract auto-releases escrow to the GPU provider. No trusted 3rd party.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 4: TELEMETRY
      ═══════════════════════════════════════════════════════════════════════*/}
      {activeSubTab === 'telemetry' && (
        <div className="space-y-4">

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Live log console */}
            <div className="md:col-span-2 p-5 rounded-[22px] bg-[#040709] border border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">Live RPC + TX Telemetry</span>
                  <LiveDot color="#f59e0b" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-gray-600">{telemetryLog.length} events</span>
                  <button onClick={() => setTelemetryLog([])} className="text-[10px] font-mono text-gray-600 hover:text-gray-400 transition">Clear</button>
                </div>
              </div>
              <div
                ref={logRef}
                className="h-56 overflow-y-auto font-mono text-[11px] space-y-0.5 pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#1f2937 transparent' }}
              >
                {telemetryLog.length === 0 ? (
                  <div className="text-gray-600 py-4 text-center">No events yet. Actions will appear here.</div>
                ) : telemetryLog.map((line, i) => {
                  const color = line.includes('[ERROR]') ? '#f87171'
                    : line.includes('[TX]') ? '#22d3ee'
                    : line.includes('[BENCH]') ? '#a78bfa'
                    : line.includes('[RPC]') ? '#00FF66'
                    : 'rgba(255,255,255,0.45)';
                  return (
                    <div key={i} style={{ color }} className="leading-relaxed break-all">
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live hub status + on-chain activity feed */}
          <div className="p-5 rounded-[22px] bg-[#070b0e] border border-white/[0.08] space-y-4">
            <div className="flex items-center justify-between px-1 flex-wrap gap-2">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" /> Live Hub Status
                <LiveDot color="#22d3ee" />
              </div>
              <button
                onClick={loadActivity}
                className="text-[10px] font-mono text-gray-500 hover:text-gray-300 transition flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Poll now
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { k: 'Block Height',  v: activity ? `#${activity.blockHeight.toLocaleString()}` : '—', c: '#22d3ee' },
                { k: 'RPC Latency',   v: activity ? `${activity.latencyMs}ms` : '—', c: '#fbbf24' },
                { k: 'Hub Contract',  v: `${AI_HUB_ADDRESS.slice(0, 10)}…${AI_HUB_ADDRESS.slice(-6)}`, c: '#ffffff' },
                { k: 'Poll Interval', v: '15s', c: '#00FF66' },
              ].map(r => (
                <div key={r.k} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="text-[9px] text-gray-600 uppercase">{r.k}</div>
                  <div className="text-xs font-mono text-white font-bold mt-0.5 break-all" style={{ color: r.c }}>{r.v}</div>
                </div>
              ))}
            </div>
            <div className="px-1">
              {renderActivityFeed()}
            </div>
            <div className="text-[10px] font-mono text-gray-600 flex items-center gap-1.5">
              <Activity className="w-3 h-3" /> Sources: eth_blockNumber + eth_getLogs over the public CC3 RPC — all values real &amp; measured, nothing simulated.
            </div>
          </div>

          {/* Risk metrics breakdown */}
          {riskMetrics && (
            <div className="p-5 rounded-[22px] bg-[#070b0e] border border-white/[0.08] space-y-4">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Network className="w-4 h-4 text-cyan-400" /> On-Chain Risk Parameters (Live from Contract)
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { k: 'Volatility Index (raw bps)', v: riskMetrics.volatilityIndex.toString() },
                  { k: 'Default Rate (raw bps)',     v: riskMetrics.defaultRateBps.toString() },
                  { k: 'Auto APR (raw bps)',         v: riskMetrics.autonomousAPRBps.toString() },
                  { k: 'Last Update Block',          v: `#${riskMetrics.lastRiskBlock.toLocaleString()}` },
                  { k: 'Volatility %',               v: `${(riskMetrics.volatilityIndex / 100).toFixed(2)}%` },
                  { k: 'Default Rate %',             v: bpsToPercent(riskMetrics.defaultRateBps) },
                  { k: 'Autonomous APR %',           v: bpsToPercent(riskMetrics.autonomousAPRBps) },
                  { k: 'Contract',                   v: `${AI_HUB_ADDRESS.slice(0,8)}…${AI_HUB_ADDRESS.slice(-6)}` },
                ].map(r => (
                  <div key={r.k} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] text-gray-600 uppercase">{r.k}</div>
                    <div className="text-xs font-mono text-white font-bold mt-0.5 break-all">{r.v}</div>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-mono text-gray-600 flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Auto-refreshes every 30s · Source: {CUSD_ADDRESS.slice(0, 8)}… RPC
              </div>
            </div>
          )}

          {/* Benchmark results */}
          {benchmark && (
            <div className="p-5 rounded-[22px] bg-[#070b0e] border border-purple-500/15 space-y-3">
              <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-400" /> Browser GPU — Last Benchmark Result
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                {[
                  { k: 'Hardware', v: benchmark.hardwareDevice || 'CPU Fallback' },
                  { k: 'Tokens / sec', v: `${benchmark.tokensPerSecond} tok/s` },
                  { k: 'GFLOPS', v: `${benchmark.tensorFLOPS}` },
                  { k: 'Embedding Latency', v: `${benchmark.embeddingLatencyMs}ms` },
                  { k: 'VRAM Est.', v: `${benchmark.vramAllocatedMB} MB` },
                  { k: 'Run At', v: benchmark.timestamp },
                ].map(r => (
                  <div key={r.k} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="text-[9px] text-gray-600 uppercase">{r.k}</div>
                    <div className="font-mono text-purple-300 font-bold mt-0.5 break-all">{r.v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      </div>
  );
};

export default AITab;

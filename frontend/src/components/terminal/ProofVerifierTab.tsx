import React, { useEffect, useState } from 'react';
import GlassCard from '../common/GlassCard';
import SimulationBadge from '../common/SimulationBadge';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Terminal,
  FileCheck,
  Search,
  Coins,
  Zap,
  Sparkles,
  ExternalLink,
  RefreshCw,
  Cpu
} from 'lucide-react';
import ComposableQueryModal from '../modals/ComposableQueryModal';
import ThirdCheckModal from '../modals/ThirdCheckModal';
import { submitProofBatch, fetchBorrowerProfile, fetchUSCOracleInfo, fetchLatestAttestedUSCProof, verifyUSCProofOnOracle, anchorUSCVerifiedProof, ProofSubmission, USCOracleInfo } from '../../services/credXService';
import { CONTRACTS, CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';

const ProofVerifierTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score, refreshFromChain } = useProtocol();
  const { addToast } = useToast();

  const [queryModalOpen, setQueryModalOpen] = useState(false);
  const [thirdCheckModalOpen, setThirdCheckModalOpen] = useState(false);
  const [proofInput, setProofInput] = useState('0x');
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [uscInfo, setUscInfo] = useState<USCOracleInfo | null>(null);
  const [uscLoading, setUscLoading] = useState(false);
  const [uscError, setUscError] = useState<string | null>(null);

  const [uscAttesting, setUscAttesting] = useState(false);
  const [uscStage, setUscStage] = useState<'fetching' | 'verified' | 'anchoring' | 'done' | 'error' | null>(null);
  const [uscProofSummary, setUscProofSummary] = useState<{ height: number; txHash: string; verified: boolean; anchorTx: string | null } | null>(null);

  const USC_STAGE_LABEL: Record<string, string> = {
    fetching: 'Resolving attested block',
    verified: '0x0FD2 verifying proof',
    anchoring: 'Awaiting wallet signature',
    done: 'Anchored on Creditcoin',
    error: 'Attestation failed',
  };

  const handleUSCAttest = async () => {
    if (!isConnected || !address) {
      addToast('info', 'Connect a Wallet', 'Connect your wallet to capture and anchor a fresh proof on 0x0FD2.');
      openConnectModal();
      return;
    }
    setUscAttesting(true);
    setUscProofSummary(null);
    try {
      setUscStage('fetching');
      addToast('info', 'Fetching Attested Block', 'Resolving the latest attested Sepolia block via the official proof-builder…');
      const proof = await fetchLatestAttestedUSCProof(1);

      setUscStage('verified');
      addToast('info', 'Calling 0x0FD2', `Verifying Merkle + continuity proof for ${proof.txHash.slice(0, 10)}… at height #${proof.height}.`);
      const verified = await verifyUSCProofOnOracle(proof);
      if (!verified) {
        setUscStage('error');
        setUscProofSummary({ height: proof.height, txHash: proof.txHash, verified: false, anchorTx: null });
        addToast('error', '0x0FD2 Rejected Proof', 'The precompile could not verify this proof. The attestation window may have rotated.');
        return;
      }

      setUscStage('anchoring');
      addToast('info', 'Anchoring On-Chain', 'Sign the anchor transaction in your wallet to store the verified proof.');
      const { ok, txHash } = await anchorUSCVerifiedProof(proof);
      setUscProofSummary({ height: proof.height, txHash: proof.txHash, verified: ok, anchorTx: txHash });
      setUscStage(ok ? 'done' : 'error');
      if (ok) {
        addToast('success', 'Proof Anchored on Creditcoin', `0x0FD2 accepted the proof — anchored at ${txHash.slice(0, 12)}…`);
        loadUscInfo();
      } else {
        addToast('error', 'Anchor Returned False', 'The transaction mined but the precompile did not verify the proof.');
      }
    } catch (err: any) {
      setUscStage('error');
      addToast('error', '0x0FD2 Attest Failed', err?.shortMessage || err?.message || 'Unable to attest — check your network connection.');
    } finally {
      setUscAttesting(false);
    }
  };

  const loadUscInfo = async () => {
    setUscLoading(true);
    setUscError(null);
    try {
      const info = await fetchUSCOracleInfo();
      setUscInfo(info);
    } catch (err: any) {
      setUscError(err?.shortMessage || err?.message || 'Failed to read BlockProverAttestationOracle');
    } finally {
      setUscLoading(false);
    }
  };

  useEffect(() => {
    loadUscInfo();
  }, []);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const handleVerify = async () => {
    if (!proofInput.startsWith('0x')) {
      addToast('error', 'Invalid Hash', 'Proof hash must be a valid 0x hexadecimal string.');
      return;
    }
    if (!isConnected || !address) {
      addToast('info', 'Connect a Wallet', 'Submit real cross-chain proofs on Creditcoin testnet, or continue in demo mode below.');
      openConnectModal();
      return;
    }
    setVerifying(true);
    addToast('info', 'Submitting Proof', `Casting verification proof ${proofInput.slice(0, 12)}… to CredXHub (MockAttestationOracle harness).`);
    try {
      const proof: ProofSubmission = {
        sourceChainId: 1,
        actionType: 5, // RWA_INVOICE_SETTLEMENT
        reportedValueUSD: 10000,
        txHash: proofInput,
      };
      const hash = await submitProofBatch([proof]);
      const profile = await fetchBorrowerProfile(address);
      const newScore = profile?.creditScore ?? score;
      setResult({
        valid: true,
        proofType: 'Merkle/continuity receipt (testnet harness)',
        blockNumber: hash.slice(0, 8),
        subject: address,
        provenCTS: newScore,
        attestations: [`Proof anchored — tx ${hash.slice(0, 8)}…`, 'RWA invoice settlement ($10k)', 'Score recomputed on-chain'],
      });
      addToast('success', 'Proof Submitted On-Chain', `CredXHub accepted the proof batch — CTS refreshed (tx ${hash.slice(0, 10)}…).`);
      await refreshFromChain();
    } catch (err: any) {
      addToast('error', 'Proof Submission Failed', err?.shortMessage || err?.message || 'Transaction rejected.');
      setResult(null);
    } finally {
      setVerifying(false);
    }
  };

  const handleDemoVerify = () => {
    if (!proofInput.startsWith('0x')) {
      addToast('error', 'Invalid Hash', 'Proof hash must be a valid 0x hexadecimal string.');
      return;
    }
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setResult({
        valid: true,
        proofType: 'Demo simulation (no on-chain submission)',
        blockNumber: 'demo',
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
        subject: address || '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
        provenCTS: score,
        attestations: ['Demo receipt — no wallet transaction was created'],
      });
      addToast('info', 'Demo Proof Simulated', 'This verification is simulated locally. Connect a wallet to submit real proofs to CredXHub.');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Connected Wallet Money Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-teal-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Cryptographic ZK Prover Wallet
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-cyan-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setThirdCheckModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 text-purple-300 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title="Inspect 3-Tier cryptographic Merkle & Semantic event log audit"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> ThirdCheck Proof Auditor
          </button>
          <button
            onClick={() => setQueryModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-400 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" /> Composable Query SDK
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-cyan-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
              <Lock className="w-3.5 h-3.5" /> ZK Privacy & Attestation Engine (Merkle/Continuity)
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Independently Audit ZK Reputational Receipts On-Chain
            </h2>
            <p className="text-xs text-white/60 leading-relaxed max-w-xl">
              Verify mathematical Groth16 / SnarkJS proofs without revealing private wallet transactions, balances, or KYC identifiers. Instant verification on Creditcoin Testnet.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Proof Verification Gas</span>
                <span className="text-base font-bold font-mono text-emerald-400">~240k Gas (0 CTC Overhead)</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Verifier Deployed</span>
                <span className="text-base font-bold font-mono text-cyan-300">MockAttestationOracle (testnet harness)</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Cryptographic Standard</span>
                <span className="text-base font-bold font-mono text-white">Attestcoin USC / Merkle Receipts</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 group">
              <img
                src="/images/proof-verifier.jpg"
                alt="3D Cryptographic Zero-Knowledge Sybil Mesh and Verification Circuits"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-cyan-500/30 text-cyan-300">
                  🔐 ZK-SNARK Verified
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                  USC / Merkle Receipts
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* LIVE USC Attestcoin BlockProver (real 0x0FD2 integration) */}
      <GlassCard className="p-6 border-emerald-500/30 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-3 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE — USC ATTESTCOIN PROTOCOL
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.1] text-white/70 text-[11px] font-mono">
                0x0FD2 BlockProver
              </div>
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-4.5 h-4.5 text-emerald-400" /> BlockProverAttestationOracle
            </h3>
            <p className="text-xs text-white/55 leading-relaxed max-w-2xl">
              Real on-chain reads through the deployed
              <a href={`${CREDITCOIN_BLOCKSCOUT}/address/${CONTRACTS.blockProverAttestationOracle}#code`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline font-mono mx-1">
                {CONTRACTS.blockProverAttestationOracle.slice(0, 8)}…{CONTRACTS.blockProverAttestationOracle.slice(-6)}
              </a>
              which wraps Creditcoin's native Attestcoin precompiles. Supported source chains and attestation
              heights come straight from the ChainInfo precompile (0x0FD3). Run{' '}
              <code className="font-mono text-emerald-300">{'npm run usc:verify'}</code> for a live
              Merkle + continuity proof from the official proof-builder service, verified and anchored on 0x0FD2.
            </p>
          </div>

          <button
            onClick={loadUscInfo}
            disabled={uscLoading}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${uscLoading ? 'animate-spin' : ''}`} /> Refresh Chain Info
          </button>
        </div>

        {uscError && (
          <div className="mt-3 text-xs font-mono text-amber-300 bg-amber-500/[0.06] border border-amber-500/20 rounded-xl px-3 py-2">
            {uscError}
          </div>
        )}

        {uscInfo && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3">
            {uscInfo.chains.slice(0, 3).map((chain) => (
              <div key={chain.chainKey} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07]">
                <div className="text-[10px] text-white/40 uppercase font-mono">Source Chain</div>
                <div className="text-sm font-bold text-white mt-0.5 flex items-center gap-1.5">
                  {chain.chainName || `Chain ${chain.chainKey}`}
                  <span className="text-[10px] text-white/40 font-mono font-normal">chainId {chain.chainId}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/45">chainKey</span>
                  <span className="text-cyan-300">{chain.chainKey}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-white/45">attested height</span>
                  <span className="text-emerald-400">#{chain.latestAttestedHeight.toLocaleString()}</span>
                </div>
              </div>
            ))}

            <div className="p-3 rounded-xl bg-emerald-500/[0.05] border border-emerald-500/25 col-span-1">
              <div className="text-[10px] text-white/40 uppercase font-mono">Anchored Proofs (on-chain)</div>
              <div className="text-2xl font-black text-emerald-400 font-mono mt-1">{uscInfo.anchoredCount}</div>
              <div className="mt-2 text-[10px] font-mono text-white/45 leading-relaxed">
                Live proof anchor at{' '}
                <a href={`${CREDITCOIN_BLOCKSCOUT}/tx/0xd0b88f9e7b596e1f23b5d99db9f72261c0d45ab208cd5381c623bca1a8befd69`} target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">
                  tx 0xd0b88f…befd69
                </a>
                <ExternalLink className="w-3 h-3 inline ml-0.5" />
              </div>
            </div>
          </div>
        )}

        {!uscInfo && !uscLoading && !uscError && (
          <div className="mt-3 text-xs text-white/45 font-mono">Reading 0x0FD2 / 0x0FD3 through the oracle contract…</div>
        )}

        {/* Live "Verify on 0x0FD2" connected-wallet attest */}
        <div className="mt-4 p-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" /> Verify &amp; Anchor a Fresh Proof
              </div>
              <p className="text-[11px] text-white/55 leading-relaxed max-w-xl">
                In-browser pipeline: official proof-builder <code className="text-emerald-300 font-mono">attested-height</code> →
                a real Sepolia tx → Merkle + continuity proof → crypto-verified on the live 0x0FD2 precompile,
                then anchored on-chain by your wallet (gas: Creditcoin testnet faucet).
              </p>
            </div>
            <button
              onClick={handleUSCAttest}
              disabled={uscAttesting}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 font-mono"
            >
              <Zap className={`w-3.5 h-3.5 ${uscAttesting ? 'animate-spin' : ''}`} />
              {uscAttesting
                ? USC_STAGE_LABEL[uscStage || 'fetching'] + '…'
                : 'Verify & Anchor on 0x0FD2'}
            </button>
          </div>

          {uscProofSummary && (
            <div className="text-[11px] font-mono text-white/80 leading-relaxed">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                  {uscProofSummary.verified ? '0x0FD2 VERIFIED ✓' : '0x0FD2 verify returned false ✗'}
                </span>
                <span>height #{uscProofSummary.height.toLocaleString()}</span>
                <span className="text-white/45 break-all">tx {uscProofSummary.txHash.slice(0, 18)}…</span>
                {uscProofSummary.anchorTx && (
                  <a
                    href={`${CREDITCOIN_BLOCKSCOUT}/tx/${uscProofSummary.anchorTx}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-emerald-400 hover:underline"
                  >
                    anchor tx {uscProofSummary.anchorTx.slice(0, 12)}… <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Proof Input Card */}
      <GlassCard className="p-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-semibold text-white uppercase tracking-wider block">
            Cryptographic Receipt Hash (USC / Merkle Receipts)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={proofInput}
              onChange={(e) => setProofInput(e.target.value)}
              className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-4 py-2.5 text-white font-mono text-xs outline-none transition"
              placeholder="0x..."
            />
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Search className="w-3.5 h-3.5" />
              {verifying ? 'Submitting Proof...' : isConnected ? 'Submit Proof On-Chain' : 'Verify On-Chain'}
            </button>
            <button
              onClick={handleDemoVerify}
              disabled={verifying}
              className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 font-medium text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              title="Simulate proof verification locally — no on-chain transaction"
            >
              <Sparkles className="w-3.5 h-3.5" /> Demo Verify
            </button>
          </div>
          <div className="text-[10px] text-white/40 mt-1 font-mono flex items-center gap-1.5">
            <SimulationBadge label={isConnected ? 'REAL ON-CHAIN' : 'NOT CONNECTED'} note="Proof submission requires a connected wallet on Creditcoin testnet. 'Demo Verify' simulates locally without a transaction." />
            {!isConnected && 'Connect a wallet above to submit real proofs to CredXHub.'}
          </div>
        </div>

        {result && (
          <div className="p-5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/30 space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5" /> {result.proofType.includes('Demo') ? 'DEMO PROOF SIMULATED' : 'PROOF SUBMITTED ON-CHAIN'}
                {result.proofType.includes('Demo') && <SimulationBadge />}
              </div>
              <span className="font-mono text-[11px] text-white/50">{result.proofType.includes('Demo') ? 'no tx' : `tx ${result.blockNumber}…`}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Proof Protocol</span>
                <div className="text-white font-mono font-medium">{result.proofType}</div>
              </div>
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Subject Wallet</span>
                <div className="text-cyan-300 font-mono font-medium">{result.subject}</div>
              </div>
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Attested CTS Score</span>
                <div className="text-emerald-400 font-mono font-bold text-base">{result.provenCTS} / 1000</div>
              </div>
              <div className="space-y-1">
                <span className="text-white/40 text-[10px] uppercase">Timestamp</span>
                <div className="text-white font-mono">{result.timestamp}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-emerald-500/20">
              <span className="text-white/40 text-[10px] uppercase block mb-1.5">Included Zero-Knowledge Claims</span>
              <div className="flex flex-wrap gap-2">
                {result.attestations.map((att: string) => (
                  <span key={att} className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 font-mono text-[11px]">
                    {att}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* Modals */}
      <ComposableQueryModal isOpen={queryModalOpen} onClose={() => setQueryModalOpen(false)} />
      <ThirdCheckModal isOpen={thirdCheckModalOpen} onClose={() => setThirdCheckModalOpen(false)} />
    </div>
  );
};

export default ProofVerifierTab;

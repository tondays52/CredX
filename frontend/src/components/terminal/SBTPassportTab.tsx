import React, { useState, useRef, useEffect } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  Shield,
  Award,
  Sparkles,
  CheckCircle2,
  Lock,
  ExternalLink,
  QrCode,
  Coins,
  DollarSign,
  UserCheck,
  Fingerprint,
  FileBadge,
  RefreshCw,
  Cpu,
  Zap,
  KeyRound,
  FileCode2,
  CheckCheck
} from 'lucide-react';
import SBTModal from '../modals/SBTModal';

const SBTPassportTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score, tier, sbtMinted } = useProtocol();
  const { addToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

  // 3D Card Physics State
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50, opacity: 0 });
  const [isFlipped, setIsFlipped] = useState(false);

  // Verification Simulation State
  const [verifying, setVerifying] = useState(false);
  const [verifiedOnChain, setVerifiedOnChain] = useState(false);

  // Biometric 3D Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  // 3D Mouse Movement Tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -14;
    const rotY = ((x - centerX) / centerX) * 14;

    setRotateX(rotX);
    setRotateY(rotY);

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;
    setGlarePos({ x: glareX, y: glareY, opacity: 0.65 });
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setGlarePos((prev) => ({ ...prev, opacity: 0 }));
  };

  // Quantum Biometric 3D Scan Canvas Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    // Node Lattice Points in 3D Space
    const nodes: { x: number; y: number; z: number }[] = [];
    const count = 36;
    for (let i = 0; i < count; i++) {
      const theta = (i / count) * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 65;
      nodes.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
      });
    }

    const render = () => {
      angle += 0.015;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Sweeping Laser Scan Line
      const laserY = cy + Math.sin(angle * 2) * 55;
      const laserGrad = ctx.createLinearGradient(0, laserY - 10, 0, laserY + 10);
      laserGrad.addColorStop(0, 'rgba(0, 229, 255, 0)');
      laserGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.45)');
      laserGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = laserGrad;
      ctx.fillRect(0, laserY - 10, w, 20);

      // Rotate and Project 3D Nodes
      const projected = nodes.map((node) => {
        // Rotate Y
        const cosY = Math.cos(angle);
        const sinY = Math.sin(angle);
        const x1 = node.x * cosY + node.z * sinY;
        const z1 = -node.x * sinY + node.z * cosY;

        // Rotate X
        const cosX = Math.cos(0.4);
        const sinX = Math.sin(0.4);
        const y1 = node.y * cosX - z1 * sinX;
        const z2 = node.y * sinX + z1 * cosX;

        const fov = 160;
        const scale = fov / (fov + z2 + 80);
        return {
          x: cx + x1 * scale,
          y: cy + y1 * scale,
          scale,
          z: z2,
        };
      });

      // Draw Connections
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.18)';
      ctx.lineWidth = 1;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 42) {
            ctx.beginPath();
            ctx.moveTo(projected[i].x, projected[i].y);
            ctx.lineTo(projected[j].x, projected[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw Nodes
      projected.forEach((p) => {
        const rad = Math.max(1.2, 2.5 * p.scale);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = p.scale > 0.9 ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)';
        ctx.fill();
      });

      // Center Hologram Shield Outline
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 32, 0, Math.PI * 2);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleVerifyOnChain = () => {
    setVerifying(true);
    addToast('info', 'Invoking Precompile 0x0FD2', 'Querying Creditcoin L1 cryptographic attestation engine...');

    setTimeout(() => {
      setVerifying(false);
      setVerifiedOnChain(true);
      addToast('success', 'Soulbound Attestation Verified', 'Merkle Root valid, ERC-5192 lock active on Creditcoin Block #4,192,804.');
    }, 1400);
  };

  return (
    <div className="space-y-6">
      {/* Live Soulbound Identity Wallet Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/40 border border-indigo-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-indigo-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Soulbound Identity Wallet
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-indigo-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">ERC-5192 Soulbound Status</span>
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1 justify-end">
              <Lock className="w-3 h-3" />
              {sbtMinted ? 'Minted #4928-SBT' : 'Eligible for Sovereign Mint'}
            </span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {sbtMinted ? 'View Attestation Payload' : 'Mint Soulbound Passport'}
          </button>
        </div>
      </div>

      {/* Main Interactive 3D Stage: 3D Holographic Passport Card & Biometric Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Left: 3D Holographic Tilt Card with 3D Flip */}
        <div className="lg:col-span-6 flex flex-col items-center justify-center space-y-4">
          {/* Card 3D Container */}
          <div
            style={{ perspective: '1200px' }}
            className="w-full max-w-md cursor-pointer select-none"
            onClick={() => setIsFlipped((prev) => !prev)}
          >
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `rotateX(${rotateX}deg) rotateY(${rotateY + (isFlipped ? 180 : 0)}deg) scale3d(${glarePos.opacity > 0 ? 1.02 : 1}, ${glarePos.opacity > 0 ? 1.02 : 1}, 1)`,
                transformStyle: 'preserve-3d',
                transition: glarePos.opacity > 0 ? 'transform 0.08s ease-out' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
              }}
              className="w-full aspect-[1.62/1] rounded-3xl relative overflow-hidden shadow-2xl shadow-cyan-500/20 border border-cyan-400/40 p-6 flex flex-col justify-between"
            >
              {/* Card Holographic Rainbow Sheen */}
              <div
                style={{
                  background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(0, 240, 255, 0.45) 0%, rgba(168, 85, 247, 0.25) 35%, transparent 75%)`,
                  opacity: glarePos.opacity,
                  transition: 'opacity 0.25s ease-out',
                }}
                className="absolute inset-0 pointer-events-none z-30 mix-blend-overlay"
              />

              {/* Holographic Iridescent Texture */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#06121e] via-[#091726] to-[#120d2a] z-0" />
              <div className="absolute -top-24 -left-24 w-52 h-52 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />

              {/* ─── FRONT OF CARD ─── */}
              <div
                style={{
                  backfaceVisibility: 'hidden',
                  display: isFlipped ? 'none' : 'flex',
                }}
                className="relative z-10 h-full flex flex-col justify-between"
              >
                {/* Card Top Row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-[1px] shadow-lg shadow-cyan-500/30">
                      <div className="w-full h-full bg-[#050b14] rounded-xl flex items-center justify-center text-cyan-400">
                        <Shield className="w-4 h-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-white font-black text-xs tracking-wider flex items-center gap-1.5">
                        CREDX SOVEREIGN
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      </div>
                      <div className="text-[9px] font-mono text-cyan-300/80">SOULBOUND &bull; ERC-5192</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-[10px] font-mono font-bold">
                    <Lock className="w-3 h-3 text-cyan-400" />
                    NON-TRANSFERABLE
                  </div>
                </div>

                {/* Center Chip & CTS Score */}
                <div className="my-auto py-2 flex items-center justify-between">
                  {/* Smart EMV Chip Hologram */}
                  <div className="w-12 h-9 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-[1px] shadow-md shadow-amber-500/20 relative overflow-hidden">
                    <div className="w-full h-full bg-[#1a1408] rounded-lg relative p-1.5 flex flex-col justify-between">
                      <div className="flex justify-between">
                        <div className="w-2.5 h-2 rounded border border-amber-400/60" />
                        <div className="w-2.5 h-2 rounded border border-amber-400/60" />
                      </div>
                      <div className="w-full h-[1px] bg-amber-400/40" />
                      <div className="flex justify-between">
                        <div className="w-2.5 h-2 rounded border border-amber-400/60" />
                        <div className="w-2.5 h-2 rounded border border-amber-400/60" />
                      </div>
                    </div>
                  </div>

                  {/* CTS Credit Score Badge */}
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-mono text-white/40 tracking-wider block">
                      Credit Reputation Score
                    </span>
                    <div className="text-3xl font-black font-mono text-white tracking-tight flex items-center gap-1.5 justify-end">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400">
                        {score}
                      </span>
                      <span className="text-xs text-white/60 font-sans font-bold">/ 1000 CTS</span>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 font-bold">
                      Tier: {tier} &bull; Top 2.4%
                    </span>
                  </div>
                </div>

                {/* Card Bottom Row */}
                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono">
                  <div>
                    <span className="text-[8px] text-white/40 uppercase block">Bound Address</span>
                    <span className="text-cyan-300 font-bold">
                      {address ? `${address.slice(0, 8)}...${address.slice(-6)}` : '0x9afB...8f07'}
                    </span>
                  </div>

                  <div>
                    <span className="text-[8px] text-white/40 uppercase block">Token ID</span>
                    <span className="text-white font-bold">#4928-SBT</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[8px] text-white/40 uppercase block">Consensus Anchor</span>
                    <span className="text-emerald-400 font-bold">CREDITCOIN L1</span>
                  </div>
                </div>
              </div>

              {/* ─── BACK OF CARD (Cryptographic Proofs) ─── */}
              <div
                style={{
                  transform: 'rotateY(180deg)',
                  display: isFlipped ? 'flex' : 'none',
                }}
                className="relative z-10 h-full flex flex-col justify-between font-mono text-xs"
              >
                <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
                  <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5" /> CRYPTOGRAPHIC AUDIT PROOF
                  </span>
                  <span className="text-[9px] text-white/50">PRECOMPILE: 0x0FD2</span>
                </div>

                <div className="grid grid-cols-12 gap-3 items-center py-2">
                  {/* Verifiable Matrix QR */}
                  <div className="col-span-4 p-2 bg-white/5 rounded-xl border border-cyan-500/30 flex items-center justify-center">
                    <QrCode className="w-16 h-16 text-cyan-300" />
                  </div>

                  <div className="col-span-8 space-y-1 text-[10px]">
                    <div>
                      <span className="text-white/40 block text-[8px]">CONTRACT:</span>
                      <span className="text-white">CreditAttestationSBT.sol</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[8px]">SHA-256 MERKLE ROOT:</span>
                      <span className="text-cyan-300 truncate block">0xa8f3b92c4e71...99e821</span>
                    </div>
                    <div>
                      <span className="text-white/40 block text-[8px]">RLP ATTESTATION RECEIPT:</span>
                      <span className="text-emerald-400">Block #4,192,804 (Finalized)</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[10px]">
                  <span className="text-white/40">Click card anywhere to flip back</span>
                  <span className="text-cyan-400 font-bold flex items-center gap-1">
                    <CheckCheck className="w-3.5 h-3.5" /> VALIDATED
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Card Action Buttons */}
          <div className="flex items-center gap-3 text-xs font-mono">
            <button
              onClick={() => setIsFlipped((prev) => !prev)}
              className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] text-white font-medium transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
              {isFlipped ? 'Show Front Passport' : '3D Flip to Proofs'}
            </button>

            <button
              onClick={handleVerifyOnChain}
              disabled={verifying}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400 fill-current" />
              {verifying ? 'Verifying Precompile...' : verifiedOnChain ? '✓ On-Chain Verified' : 'Verify via 0x0FD2'}
            </button>
          </div>
        </div>

        {/* Right: Quantum Biometric 3D Scanner & Live Attestation Matrix */}
        <div className="lg:col-span-6 space-y-4">
          <GlassCard className="p-5 border-cyan-500/30 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[10px] font-mono">
                  <Fingerprint className="w-3 h-3" /> Live Biometric Telemetry Matrix
                </div>
                <h3 className="text-base font-bold text-white mt-1">
                  On-Chain Verifiable Soulbound Credentials
                </h3>
              </div>

              {/* Mini Quantum 3D Canvas */}
              <div className="w-20 h-20 rounded-2xl bg-[#040810] border border-cyan-500/30 overflow-hidden relative shadow-lg shadow-cyan-500/10">
                <canvas
                  ref={canvasRef}
                  width={80}
                  height={80}
                  className="w-full h-full block"
                />
              </div>
            </div>

            <p className="text-xs text-white/60 leading-relaxed">
              Bound directly to this wallet address under ERC-5192. Encapsulates cross-chain loan repayment history, zero-knowledge sybil-resistance, and edge compute uptime.
            </p>

            {/* Credential Matrix Items */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between hover:border-cyan-500/30 transition">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-white font-medium">DeFi Reputational Solvency</div>
                    <div className="text-[10px] text-white/40">38 settled loans across Aave & CredX without liquidation</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-bold">
                  ATTESTED
                </span>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between hover:border-cyan-500/30 transition">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-white font-medium">Verified Edge Telemetry Worker</div>
                    <div className="text-[10px] text-white/40">Hardware Concurrency & Edge WebSocket Latency (38ms)</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-bold">
                  ATTESTED
                </span>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between hover:border-cyan-500/30 transition">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-white font-medium">Zero-Knowledge Sybil Defense</div>
                    <div className="text-[10px] text-white/40">ZK-SNARK proof of unique human biometric signature</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-bold">
                  ATTESTED
                </span>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center justify-between hover:border-cyan-500/30 transition">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <div className="text-white font-medium">PredictBay Arena Binary Master</div>
                    <div className="text-[10px] text-white/40">Creditcoin L1 epoch parimutuel accuracy index</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 font-bold">
                  CTS +50 BONUS
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Modal */}
      <SBTModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};

export default SBTPassportTab;


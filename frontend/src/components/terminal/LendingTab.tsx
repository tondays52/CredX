import React, { useState } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  Landmark,
  ArrowDownLeft,
  CheckCircle2,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Percent,
  Coins,
  DollarSign,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';
import BorrowModal from '../modals/BorrowModal';
import RepayModal from '../modals/RepayModal';
import { LoanPosition } from '../../types/protocol';

const LendingTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score, tier, maxBorrowLimit, activeLoans } = useProtocol();
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [repayModalOpen, setRepayModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<LoanPosition | null>(null);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const handleOpenRepay = (loan: LoanPosition) => {
    setSelectedLoan(loan);
    setRepayModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Connected Wallet Money Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-teal-950/40 border border-cyan-500/20 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Lending Account Capital
            </div>
            <div className="text-xl font-bold font-mono text-white flex items-center gap-2">
              {userWalletCTC.toLocaleString()} <span className="text-xs text-cyan-300 font-normal">CTC</span>
              <span className="text-xs text-white/40 font-mono font-normal">(${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })} USD)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-mono text-white/40 block">Max Approved Credit Line</span>
            <span className="text-xs font-mono font-bold text-emerald-400">${maxBorrowLimit.toLocaleString()} USDC</span>
          </div>
          <button
            onClick={() => setBorrowModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-500/20 transition flex items-center gap-1.5"
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> Request Credit Line
          </button>
        </div>
      </div>

      {/* 3D Visual Hero Feature Banner */}
      <GlassCard className="p-6 relative overflow-hidden border-cyan-500/30">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-7 space-y-3 z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5" /> Undercollateralized Lending Engine &bull; Chain ID 102031
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Borrow Capital with Zero Over-Collateralization
            </h2>
            <p className="text-xs text-white/60 leading-relaxed max-w-xl">
              Unlock algorithmic credit lines powered by your on-chain Creditcoin Trust Score (CTS). Enjoy low single-digit interest rates (3.2% - 5.5% APR) with zero origination penalty.
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Approved Credit Cap</span>
                <span className="text-base font-bold font-mono text-emerald-400">${maxBorrowLimit.toLocaleString()} USDC</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">Interest Rate</span>
                <span className="text-base font-bold font-mono text-cyan-300">3.2% APR (Prime)</span>
              </div>
              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                <span className="text-[10px] text-white/40 uppercase block">First-Loss Safety Pool</span>
                <span className="text-base font-bold font-mono text-white">$12,500,000</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative flex items-center justify-center">
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 group">
              <img
                src="/images/lending-market.jpg"
                alt="3D Undercollateralized Lending Market and Credit Scales"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-cyan-500/30 text-cyan-300">
                  ⚖️ LTV Margin: 110% Uncollateralized
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-emerald-500/30 text-emerald-400">
                  CTS: {score}
                </span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Credit Tier Matrix Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 space-y-3 border-emerald-500/30">
          <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">Your Active Status</span>
          <div className="text-2xl font-black font-mono text-white flex items-center gap-2">
            {tier} TIER
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Your high CTS score ({score}) qualifies you for maximum collateral discounts and zero protocol origination fees.
          </p>
          <div className="pt-2 border-t border-white/[0.06] flex justify-between text-xs font-mono">
            <span className="text-white/40">Interest APR</span>
            <span className="text-emerald-400 font-bold">3.2% - 5.5%</span>
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Available Liquidity</span>
          <div className="text-2xl font-black font-mono text-cyan-300">
            ${maxBorrowLimit.toLocaleString()} <span className="text-xs text-white/40 font-normal">USDC</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Uncollateralized credit buffer dynamically refreshed based on live OCCR factor risk evaluations.
          </p>
          <div className="pt-2 border-t border-white/[0.06] flex justify-between text-xs font-mono">
            <span className="text-white/40">LTV Margin</span>
            <span className="text-white font-bold">110% (Prime Tier)</span>
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider">Protocol Safety</span>
          <div className="text-2xl font-black font-mono text-purple-300">
            $12.5M <span className="text-xs text-white/40 font-normal">RESERVE</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            First-loss capital pool underwritten by staking validators on Creditcoin Testnet.
          </p>
          <div className="pt-2 border-t border-white/[0.06] flex justify-between text-xs font-mono">
            <span className="text-white/40">Insurance Ratio</span>
            <span className="text-emerald-400 font-bold">100% Covered</span>
          </div>
        </GlassCard>
      </div>

      {/* Active Borrowing Positions */}
      <GlassCard className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Debt Positions</h3>
            <p className="text-xs text-white/40 mt-0.5">Underwritten via Creditcoin OCCR protocol contracts</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs">
            {activeLoans.length} Loans
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-white/40 text-[10px] uppercase font-mono tracking-wider">
                <th className="pb-3 font-medium">Position ID</th>
                <th className="pb-3 font-medium">Principal</th>
                <th className="pb-3 font-medium">Collateral Pledged</th>
                <th className="pb-3 font-medium">Interest Rate</th>
                <th className="pb-3 font-medium">Settlement Target</th>
                <th className="pb-3 font-medium text-right">Repayment Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {activeLoans.map((loan) => (
                <tr key={loan.id} className="hover:bg-white/[0.01] transition">
                  <td className="py-3 font-mono font-medium text-white">{loan.id}</td>
                  <td className="py-3 font-mono font-semibold text-cyan-300">${loan.amount.toLocaleString()} USDC</td>
                  <td className="py-3 font-mono text-white/70">{loan.collateral}</td>
                  <td className="py-3 font-mono text-emerald-400">{loan.interestRate}% APR</td>
                  <td className="py-3 text-white/60 font-mono">{loan.dueDate}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => handleOpenRepay(loan)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-400 font-medium text-xs transition"
                    >
                      Settle Debt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Modals */}
      <BorrowModal isOpen={borrowModalOpen} onClose={() => setBorrowModalOpen(false)} />
      <RepayModal isOpen={repayModalOpen} onClose={() => setRepayModalOpen(false)} loan={selectedLoan} />
    </div>
  );
};

export default LendingTab;

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import {
  Landmark,
  FileSpreadsheet,
  ShieldCheck,
  TrendingUp,
  Building2,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  DollarSign,
  Briefcase,
  PieChart,
  Lock,
  Sparkles,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Sliders,
  Activity,
  Info,
  BarChart3,
  Clock,
  ChevronRight,
  Send,
  Scale
} from 'lucide-react';
import RWATreasuryModal from '../modals/RWATreasuryModal';
import SimulationBadge from '../common/SimulationBadge';
import { RWATreasuryPosition } from '../../types/tracks';
import {
  fetchTreasuryState,
  treasuryDeposit,
  treasuryWithdraw,
  fetchCUSDBalance,
  fetchInvoices,
  fetchCurrentBlock,
  fetchBorrowerProfile,
  tokenizeInvoice,
  fundInvoice,
  repayInvoice,
  reclaimInvoice
} from '../../services/credXService';
import type { InvoiceView } from '../../services/credXService';

const RWATab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score } = useProtocol();
  const { addToast } = useToast();

  const userScore = score;
  const baseAprPct = 5.24;

  const [treasuryState, setTreasuryState] = useState<Awaited<ReturnType<typeof fetchTreasuryState>>>(null);
  const [treasuryLoading, setTreasuryLoading] = useState<boolean>(false);

  const treasuryMeta = treasuryState?.treasuryMeta;
  const tbBalance = treasuryState?.tbBalance ?? 0;
  const navPrice = treasuryState?.stablePrice ?? 1;
  const minScoreRequired = treasuryState?.minScoreRequired ?? 600;
  const premiumScoreThreshold = treasuryState?.premiumScoreThreshold ?? 750;
  const premiumBonusBps = treasuryState?.premiumBonusBps ?? 0;
  const premiumBonusPct = premiumBonusBps / 100;
  const lastDepositBlock = treasuryState?.lastDepositBlock ?? 0;
  const currentBlock = treasuryState?.currentBlock ?? 0;
  const bonusVestBlocks = treasuryState?.bonusVestBlocks ?? 0;

  const isKycVerified = userScore >= minScoreRequired;
  const isPremium = userScore >= premiumScoreThreshold;
  const vestProgress = bonusVestBlocks > 0
    ? Math.min(1, Math.max(0, (currentBlock - lastDepositBlock) / bonusVestBlocks))
    : 0;
  const bonusEligible = isPremium && lastDepositBlock > 0;
  const vestedBonusPct = bonusEligible ? premiumBonusPct * vestProgress : 0;
  const effectiveApr = baseAprPct + vestedBonusPct;

  const refreshTreasury = useCallback(async () => {
    if (!address) return;
    setTreasuryLoading(true);
    try {
      const [treasury, cusd] = await Promise.all([
        fetchTreasuryState(address),
        fetchCUSDBalance(address),
      ]);
      setTreasuryState(treasury);
      setWalletUSDC(cusd);
    } catch {
      setTreasuryState(null);
    } finally {
      setTreasuryLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) {
      void refreshTreasury();
    } else {
      setTreasuryState(null);
      setWalletUSDC(0);
    }
  }, [address, refreshTreasury]);

  // Active sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'tbills' | 'factoring' | 'por'>('tbills');
  const [factoringMode, setFactoringMode] = useState<'marketplace' | 'tokenize'>('marketplace');

  // Modals
  const [treasuryOpen, setTreasuryOpen] = useState(false);

  // On-chain wallet financial state
  const [walletUSDC, setWalletUSDC] = useState<number>(0);

  // Real treasury-backed position mapped to the shared UI shape
  const userPosition: RWATreasuryPosition = useMemo(() => ({
    shares: tbBalance,
    depositedUSDC: tbBalance * navPrice,
    accumulatedYieldUSD: 0,
    entryTimestamp: Date.now(),
    lastClaimTimestamp: Date.now(),
    netApy: baseAprPct + (isPremium ? premiumBonusPct : 0),
    bonusUnlocked: isPremium
  }), [tbBalance, navPrice, isPremium, premiumBonusPct]);

  const totalPositionUSD = tbBalance * navPrice;

  // Wallet balances
  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userTotalPortfolioUSD = userWalletCTC * 2.0 + walletUSDC + totalPositionUSD;

  // Interactive Yield Calculator Simulator State
  const [simAmount, setSimAmount] = useState<number>(10000);
  const simAnnualBaseReturn = (simAmount * baseAprPct) / 100;
  const simAnnualBonusReturn = bonusEligible ? (simAmount * premiumBonusPct) / 100 : 0;
  const simTotalAnnualReturn = simAnnualBaseReturn + simAnnualBonusReturn;

  // Invoices State (real on-chain reads from RWAInvoiceFinancing)
  const [invoices, setInvoices] = useState<InvoiceView[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState<boolean>(false);
  const [liveBlock, setLiveBlock] = useState<number>(0);
  const [fundingId, setFundingId] = useState<number | null>(null);
  const [repayingId, setRepayingId] = useState<number | null>(null);
  const [reclaimingId, setReclaimingId] = useState<number | null>(null);

  // Invoice Tokenization Form State
  const [tokenAmount, setTokenAmount] = useState('85000');
  const [tokenTerm, setTokenTerm] = useState('2880');
  const [isTokenizing, setIsTokenizing] = useState(false);

  const refreshInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const [list, block] = await Promise.all([fetchInvoices(), fetchCurrentBlock()]);
      setInvoices(list);
      setLiveBlock(block);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshInvoices();
  }, [refreshInvoices]);

  // Dynamic CTS advance rate calculation for enterprise
  const calculatedAdvanceRate = useMemo(() => {
    if (userScore >= 700) return 95;
    if (userScore >= 500) return 90;
    return 80;
  }, [userScore]);

  // Handlers for Treasury Vault (real on-chain writes)
  const handleDepositUSDC = async (depositedAmount: number) => {
    if (!isConnected || !address) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to deposit into the treasury fund.');
      return;
    }
    if (!depositedAmount || depositedAmount <= 0) {
      addToast('error', 'Invalid Sum', 'Specify a valid cUSD amount to allocate.');
      return;
    }
    try {
      const hash = await treasuryDeposit(depositedAmount);
      addToast('success', 'Treasury Deposit Mined', `Allocated $${depositedAmount.toLocaleString()} — tx ${hash.slice(0, 12)}…`);
      await refreshTreasury();
    } catch (err: any) {
      addToast('error', 'Deposit Failed', err?.reason || err?.shortMessage || err?.message || 'Transaction rejected.');
    }
  };

  const handleWithdrawShares = async (shares: number) => {
    if (!isConnected || !address) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to redeem tbUSD.');
      return;
    }
    if (!shares || shares <= 0) {
      addToast('error', 'Invalid Shares', 'Enter valid tbUSD shares to redeem.');
      return;
    }
    try {
      const hash = await treasuryWithdraw(shares);
      addToast('success', 'Redemption Mined', `Burned ${shares.toFixed(2)} tbUSD — tx ${hash.slice(0, 12)}…`);
      await refreshTreasury();
    } catch (err: any) {
      addToast('error', 'Redemption Failed', err?.reason || err?.shortMessage || err?.message || 'Transaction rejected.');
    }
  };

  const advanceRateFor = (score: number) => {
    if (score >= 700) return 95;
    if (score >= 500) return 90;
    return 80;
  };

  // Handlers for Factoring (real on-chain writes)
  const handleFundInvoice = async (inv: InvoiceView) => {
    if (!isConnected || !address) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to fund invoices on the Creditcoin marketplace.');
      return;
    }
    setFundingId(inv.invoiceId);
    try {
      const profile = await fetchBorrowerProfile(inv.business);
      const rate = profile ? advanceRateFor(profile.creditScore) : 90;
      const estimate = (inv.faceValue * rate) / 100;
      addToast('info', 'Creditcoin L1 Underwriting', `Approving ~$${estimate.toLocaleString()} (est. ${rate}% of face) — the contract computes the exact fundedAmount from the business credit score.`);
      const hash = await fundInvoice(inv.invoiceId, estimate);
      addToast('success', 'Invoice Funded', `Invoice #${inv.invoiceId} funded on-chain — tx ${hash.slice(0, 12)}…`);
      await refreshInvoices();
    } catch (err: any) {
      addToast('error', 'Funding Failed', err?.reason || err?.shortMessage || err?.message || 'Transaction rejected.');
    } finally {
      setFundingId(null);
    }
  };

  const handleRepayInvoice = async (inv: InvoiceView) => {
    if (!isConnected || !address) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to repay invoice debt.');
      return;
    }
    setRepayingId(inv.invoiceId);
    try {
      const hash = await repayInvoice(inv.invoiceId);
      addToast('success', 'Invoice Repaid', `Repaid $${inv.faceValue.toLocaleString()} for invoice #${inv.invoiceId} — tx ${hash.slice(0, 12)}…`);
      await refreshInvoices();
    } catch (err: any) {
      addToast('error', 'Repayment Failed', err?.reason || err?.shortMessage || err?.message || 'Transaction rejected.');
    } finally {
      setRepayingId(null);
    }
  };

  const handleReclaimInvoice = async (inv: InvoiceView) => {
    if (!isConnected || !address) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to reclaim overdue funds.');
      return;
    }
    setReclaimingId(inv.invoiceId);
    try {
      const hash = await reclaimInvoice(inv.invoiceId);
      addToast('success', 'Overdue Funds Reclaimed', `Recovered funding for overdue invoice #${inv.invoiceId} — tx ${hash.slice(0, 12)}…`);
      await refreshInvoices();
    } catch (err: any) {
      addToast('error', 'Reclaim Failed', err?.reason || err?.shortMessage || err?.message || 'Transaction rejected.');
    } finally {
      setReclaimingId(null);
    }
  };

  // Tokenize New Invoice (tokenized for yourself as the business)
  const handleTokenizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const faceVal = parseFloat(tokenAmount);
    const durationBlocks = parseInt(tokenTerm);

    if (!isConnected || !address) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to tokenize an invoice.');
      return;
    }
    if (!faceVal || faceVal <= 0) {
      addToast('error', 'Invalid Sum', 'Enter a valid invoice face value.');
      return;
    }
    if (!durationBlocks || durationBlocks <= 0) {
      addToast('error', 'Invalid Term', 'Enter a valid repayment term in blocks.');
      return;
    }

    setIsTokenizing(true);
    try {
      const hash = await tokenizeInvoice(faceVal, durationBlocks);
      addToast('success', 'Invoice Tokenized', `Receivable of $${faceVal.toLocaleString()} published on Creditcoin testnet with a ${durationBlocks}-block term — tx ${hash.slice(0, 12)}…`);
      await refreshInvoices();
      setFactoringMode('marketplace');
    } catch (err: any) {
      addToast('error', 'Tokenization Failed', err?.reason || err?.shortMessage || err?.message || 'Transaction rejected.');
    } finally {
      setIsTokenizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Connected Wallet Institutional Portfolio Ribbon */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/70 to-teal-950/40 border border-emerald-500/20 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-emerald-400 tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Institutional RWA Treasury & Factoring Terminal
            </div>
            <div className="text-xl font-black font-mono text-white flex items-center gap-2 mt-0.5">
              ${userTotalPortfolioUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-xs text-white/50 font-normal">Total Net Asset Value</span>
            </div>
          </div>
        </div>

        {/* Portfolio Breakdown Metrics */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            <span className="text-[10px] text-white/40 block">Liquid Cash (cUSD)</span>
            <span className="font-bold text-white">${walletUSDC.toLocaleString()}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <span className="text-[10px] text-emerald-300/70 block">T-Bills Holdings (tbUSD)</span>
            <span className="font-bold text-emerald-300">
              {tbBalance.toFixed(2)} tbUSD (${totalPositionUSD.toFixed(2)})
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
            <span className="text-[10px] text-cyan-300/70 block">Creditcoin ($CTC)</span>
            <span className="font-bold text-cyan-300">{userWalletCTC.toLocaleString()} CTC</span>
          </div>

          {/* CTS Decentralized KYC Badge */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            isKycVerified
              ? isPremium
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <div>
              <div className="text-[10px] font-bold">
                CTS: {userScore} &bull; {isPremium ? `Premium Bonus (+${premiumBonusPct.toFixed(2)}%)` : 'Decentralized KYC'}
              </div>
              <div className="text-[9px] opacity-75">
                {isPremium ? `${effectiveApr.toFixed(2)}% APY (base + bonus)` : isKycVerified ? 'Verified Institutional Tier' : `Restricted (<${minScoreRequired} CTS)`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The RWA Profit vs. Risk Duality Banner */}
      <GlassCard className="p-5 relative overflow-hidden border-white/[0.08] bg-slate-950/60">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <Scale className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Institutional RWA Architecture: Balancing DeFi Yield with TradFi Risk Controls
              </h3>
              <p className="text-xs text-white/50">
                Solving the 2022 unsecured default problem through Creditcoin L1 verifiable credit scores and BNY Mellon custody
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono shrink-0">
            {treasuryState ? `Base ${baseAprPct.toFixed(2)}% APY` : 'Base APY 5.24%'}
          </span>
        </div>

        {/* 4 Risk Defense Columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Proof-of-Reserve (PoR)
            </div>
            <p className="text-[11px] text-white/60">
              Ring-fenced SPV bankruptcy remote custody at BNY Mellon. Verified CUSIP <code>912797HY7</code>.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Creditcoin 0x0FD2 Liens
            </div>
            <p className="text-[11px] text-white/60">
              Cross-chain credit freeze prevents default. Borrowers risk freezing their entire Web3 enterprise credit line.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> First-Loss Safety Pool
            </div>
            <p className="text-[11px] text-white/60">
              $1,250,000 USDC protocol-funded junior tranche absorbs unexpected delinquency before senior depositors.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-purple-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> Chainlink NAV Oracles
            </div>
            <p className="text-[11px] text-white/60">
              Real-time NAV pricing{treasuryState?.stablePrice ? ` ($${treasuryState.stablePrice.toFixed(4)} per tbUSD)` : ''} protected against flash-loan arbitrage and de-pegging exploits.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Sub-Sector Navigation Switcher */}
      <div className="flex items-center gap-2 p-1.5 bg-black/50 border border-white/[0.08] rounded-2xl">
        <button
          onClick={() => setActiveSubTab('tbills')}
          className={`flex-1 py-3 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 ${
            activeSubTab === 'tbills'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Landmark className="w-4 h-4" /> US T-Bills Treasury Fund (tbUSD &bull; Base {baseAprPct.toFixed(2)}% APY)
        </button>

        <button
          onClick={() => setActiveSubTab('factoring')}
          className={`flex-1 py-3 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 ${
            activeSubTab === 'factoring'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" /> Corporate Invoice Factoring (7.8% - 9.4% APR)
        </button>

        <button
          onClick={() => setActiveSubTab('por')}
          className={`flex-1 py-3 rounded-xl text-xs font-semibold font-mono transition flex items-center justify-center gap-2 ${
            activeSubTab === 'por'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Proof-of-Reserve & Collateral Audit
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: US T-BILLS TREASURY FUND (tbUSD)                               */}
      {/* ========================================================================= */}
      {activeSubTab === 'tbills' && (
        <div className="space-y-6">
          {/* Hero Feature Banner with 3D Vault Image */}
          <GlassCard className="p-6 relative overflow-hidden border-emerald-500/30">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-4 z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
                  <Landmark className="w-3.5 h-3.5" /> Franklin US Treasury Fund (cTBILL / tbUSD)
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight">
                  Sovereign US Debt Backed Yield with Daily Compounding NAV
                </h2>

                <p className="text-xs text-white/70 leading-relaxed max-w-xl">
                  Deposit USDC to mint <strong>Treasury-Backed USD (tbUSD)</strong>. Physical assets held in an SEC-registered bankruptcy-remote SPV custodied by BNY Mellon. Features instant T+0 redemptions on Creditcoin L1.
                </p>

                {/* Key Yield Badges */}
                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.08] rounded-xl">
                    <span className="text-[10px] text-white/40 uppercase block">Base Risk-Free APR</span>
                    <span className="text-xl font-bold font-mono text-white">{baseAprPct.toFixed(2)}%</span>
                    <span className="text-[10px] text-white/40 font-mono block">Pool-quoted base rate</span>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <span className="text-[10px] text-amber-300 uppercase block font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Premium Bonus (CTS)
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-400">+{premiumBonusPct.toFixed(2)}%</span>
                    <span className="text-[10px] text-amber-300/70 font-mono block">
                      {isPremium ? `${(vestProgress * 100).toFixed(0)}% vested` : `Requires ${premiumScoreThreshold} CTS`}
                    </span>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Effective APY</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">{effectiveApr.toFixed(2)}%</span>
                    <span className="text-[10px] text-emerald-400/70 font-mono block">Base + {vestedBonusPct.toFixed(2)}% vested bonus</span>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    onClick={() => setTreasuryOpen(true)}
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" /> Manage Position / Mint tbUSD &rarr;
                  </button>
                  <span className="text-[11px] font-mono text-white/50">T+0 Liquidity Pool &bull; No Lockup</span>
                </div>
              </div>

              {/* 3D Visual Asset Container */}
              <div className="lg:col-span-5 relative flex items-center justify-center">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-emerald-500/30 shadow-2xl shadow-emerald-500/20 group">
                  <img
                    src="/images/rwa-vault-gold.jpg"
                    alt="Institutional BNY Mellon Treasury Vault with Gold Bullion and US Treasury Bonds"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-emerald-500/30 text-emerald-300">
                      🏛️ BNY Mellon Custodial SPV
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-white/80">
                      CUSIP: 912797HY7
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* User's Active Position & Live Yield Ticker */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <GlassCard className="lg:col-span-7 p-6 space-y-4 border-emerald-500/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" /> Your Live Treasury Position
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    {treasuryMeta ? `Read from ${treasuryMeta.symbol} (${treasuryMeta.name}) on Creditcoin testnet` : 'Connect a wallet to read your real tbUSD position'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] font-mono text-emerald-400">
                    {treasuryLoading ? 'Loading…' : treasuryState ? `Block ${currentBlock}` : address ? 'Unavailable' : 'Not Connected'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Shares Held</span>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {tbBalance.toFixed(2)} <span className="text-xs text-white/50">tbUSD</span>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">on-chain balance acquired</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Current NAV Value</span>
                  <div className="text-lg font-bold font-mono text-emerald-300 mt-1">
                    ${totalPositionUSD.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-emerald-400/70 font-mono">1 tbUSD = {treasuryState?.stablePrice ? `$${navPrice.toFixed(4)}` : 'n/a'} (oracle)</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Premium Bonus Vesting</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                    {bonusEligible ? `${(vestProgress * 100).toFixed(0)}%` : '—'}
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">
                    {bonusEligible
                      ? `${currentBlock - lastDepositBlock}/${bonusVestBlocks} blocks`
                      : isPremium
                        ? 'Mint tbUSD to start vesting'
                        : `Requires premium (${premiumScoreThreshold} CTS)`}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-white/60 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Redeem tbUSD any time for cUSD via the fund</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setTreasuryOpen(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold font-mono transition"
                  >
                    + Mint More
                  </button>
                  <button
                    onClick={() => setTreasuryOpen(true)}
                    className="px-4 py-2 rounded-xl bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-xs font-semibold font-mono transition"
                  >
                    Redeem for cUSD
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Interactive Yield Calculator */}
            <GlassCard className="lg:col-span-5 p-6 space-y-4 border-white/[0.08]">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-cyan-400" /> Yield Projection Calculator
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">Estimate returns with CTS premium multiplier</p>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {effectiveApr.toFixed(2)}% APY
                </span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Simulated Allocation:</span>
                  <span className="font-mono font-bold text-white">${simAmount.toLocaleString()} USDC</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Number(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                />
                <div className="flex justify-between text-[10px] font-mono text-white/40">
                  <span>$1,000</span>
                  <span>$50,000</span>
                  <span>$100,000</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 text-center font-mono">
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-white/40 block">30 Days</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                    +${((simTotalAnnualReturn / 365) * 30).toFixed(1)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-white/40 block">90 Days</span>
                  <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                    +${((simTotalAnnualReturn / 365) * 90).toFixed(1)}
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[10px] text-white/40 block">1 Year</span>
                  <span className="text-sm font-bold text-emerald-300 mt-0.5 block">
                    +${simTotalAnnualReturn.toFixed(1)}
                  </span>
                </div>
              </div>

              {isPremium && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                  {bonusEligible ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Includes <strong>+${simAnnualBonusReturn.toFixed(0)}/yr</strong> premium bonus ({Math.round(vestProgress * 100)}% vested).</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Premium unlocked — mint tbUSD to begin the +{premiumBonusPct.toFixed(2)}% bonus vesting.</span>
                    </>
                  )}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CORPORATE INVOICE FACTORING EXCHANGE                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'factoring' && (
        <div className="space-y-6">
          {/* Factoring Mode Switcher */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
              <button
                onClick={() => setFactoringMode('marketplace')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-2 ${
                  factoringMode === 'marketplace'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" /> Investor Marketplace ({invoices.length} Invoices)
              </button>

              <button
                onClick={() => setFactoringMode('tokenize')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold font-mono transition flex items-center gap-2 ${
                  factoringMode === 'tokenize'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Send className="w-3.5 h-3.5" /> Enterprise Portal: Tokenize Your Invoice
              </button>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] font-mono text-white/40 block">Contract Status</span>
              <span className="text-xs font-mono font-bold text-amber-400">
                {invoicesLoading ? 'Loading invoices…' : `${invoices.length} invoices · live at 0x05D4…1Aa`}
              </span>
            </div>
          </div>

          {/* Hero Feature Banner with 3D Cargo Factoring Visual */}
          <GlassCard className="p-6 relative overflow-hidden border-amber-500/20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-3 z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
                  <Briefcase className="w-3.5 h-3.5" /> Corporate Accounts Receivable Trade Credit
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">LIVE ON-CHAIN</span>
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight">
                  High-Yield Trade Factoring Powered by Reputation-Based Advances
                </h2>

                <p className="text-xs text-white/70 leading-relaxed max-w-xl">
                  Underwrite short-duration trade credit against live receivables tokenized on RWAInvoiceFinancing. Businesses publish invoices and repay the full face value; funders receive an advance up to <strong>95%</strong> based on the business's Creditcoin Trust Score.
                </p>

                <div className="flex flex-wrap gap-4 pt-2">
                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <span className="text-[10px] text-white/40 uppercase block">Marketplace APR</span>
                    <span className="text-base font-bold font-mono text-amber-400">7.8% - 9.4% APR</span>
                  </div>

                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <span className="text-[10px] text-white/40 uppercase block">Average Duration</span>
                    <span className="text-base font-bold font-mono text-white">45 Days (Net 60)</span>
                  </div>

                  <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
                    <span className="text-[10px] text-white/40 uppercase block">Default Rate</span>
                    <span className="text-base font-bold font-mono text-emerald-400">0.00% (Protected)</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 relative flex items-center justify-center">
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-amber-500/30 shadow-2xl shadow-amber-500/20 group">
                  <img
                    src="/images/rwa-cargo-trade.jpg"
                    alt="Smart Contract Trade Credit Factoring with Global Container Cargo Ships"
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-80" />
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-mono">
                    <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-amber-500/30 text-amber-300">
                      🚢 Maritime & Industrial Factoring
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-black/75 backdrop-blur-md border border-white/10 text-white/80">
                      Dun & Bradstreet Audited
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* VIEW A: INVESTOR MARKETPLACE */}
          {factoringMode === 'marketplace' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    Invoice Marketplace ({invoices.length} Invoices)
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Live reads from RWAInvoiceFinancing on Creditcoin testnet — businesses tokenize receivables, investors fund them, and the business repays the full face value.
                  </p>
                </div>
                <button
                  onClick={() => setFactoringMode('tokenize')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs transition flex items-center gap-1.5"
                >
                  + Tokenize Business Invoice
                </button>
              </div>

              {invoicesLoading && invoices.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/[0.08] text-center">
                  <RefreshCw className="w-6 h-6 text-amber-400/60 mx-auto animate-spin mb-2" />
                  <p className="text-xs font-mono text-white/50">Reading RWAInvoiceFinancing on Creditcoin testnet…</p>
                </div>
              ) : invoices.length === 0 ? (
                <div className="p-8 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.12] text-center">
                  <FileSpreadsheet className="w-8 h-8 text-white/30 mx-auto mb-2" />
                  <p className="text-sm font-bold text-white">No invoices yet — tokenize the first one</p>
                  <p className="text-xs text-white/40 mt-1">Tokenized invoices published on RWAInvoiceFinancing appear here automatically.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {invoices.map((inv) => {
                    const isOverdue = liveBlock > inv.createdBlock + inv.durationBlocks;
                    const isBusiness = !!address && inv.business.toLowerCase() === address.toLowerCase();
                    const isFunder = !!address && inv.funder.toLowerCase() === address.toLowerCase();
                    const status = inv.isRepaid ? 'Repaid' : inv.isFunded ? (isOverdue ? 'Overdue' : 'Funded') : 'Open';
                    const statusClass =
                      status === 'Open'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : status === 'Funded'
                          ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                          : status === 'Overdue'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-white/[0.05] text-white/40 border border-white/[0.08]';
                    return (
                      <div
                        key={inv.invoiceId}
                        className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-amber-500/40 transition space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-amber-300/80 font-bold tracking-wider">
                              Invoice #{inv.invoiceId}
                            </span>
                            <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold ${statusClass}`}>
                              {status}
                            </span>
                          </div>

                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-white/50">Business:</span>
                              <span className="font-mono text-white/80 flex items-center gap-1.5">
                                {`${inv.business.slice(0, 6)}…${inv.business.slice(-4)}`}
                                {isBusiness && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-bold">YOU</span>}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-white/50">Funder:</span>
                              <span className="font-mono text-white/80 flex items-center gap-1.5">
                                {inv.isFunded ? `${inv.funder.slice(0, 6)}…${inv.funder.slice(-4)}` : '—'}
                                {isFunder && <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold">YOU</span>}
                              </span>
                            </div>
                          </div>

                          <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04] space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-white/50">Face Value:</span>
                              <span className="font-mono text-white font-semibold">${inv.faceValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Funded Amount:</span>
                              <span className="font-mono text-amber-300 font-semibold">
                                {inv.isFunded ? `$${inv.fundedAmount.toLocaleString()}` : '—'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Term:</span>
                              <span className="font-mono text-white/70">{inv.durationBlocks.toLocaleString()} blocks</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-white/50">Created At:</span>
                              <span className="font-mono text-white/70">Block {inv.createdBlock.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between gap-2">
                          {isOverdue && inv.isFunded && !inv.isRepaid ? (
                            <span className="text-[10px] font-mono text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Overdue
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-white/30">Term: {inv.durationBlocks} blocks</span>
                          )}

                          <div className="flex items-center gap-2">
                            {inv.isFunded && !inv.isRepaid && isBusiness && (
                              <button
                                onClick={() => handleRepayInvoice(inv)}
                                disabled={repayingId === inv.invoiceId}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold font-mono transition disabled:opacity-50"
                              >
                                {repayingId === inv.invoiceId ? 'Repaying…' : 'Repay'}
                              </button>
                            )}
                            {inv.isFunded && !inv.isRepaid && isFunder && (
                              <button
                                onClick={() => handleReclaimInvoice(inv)}
                                disabled={reclaimingId === inv.invoiceId || !isOverdue}
                                title={isOverdue ? 'Reclaim the overdue funded amount' : 'Available once the invoice is overdue'}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold font-mono transition disabled:opacity-40 ${
                                  isOverdue
                                    ? 'bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300'
                                    : 'bg-white/[0.04] border border-white/[0.08] text-white/30'
                                }`}
                              >
                                {reclaimingId === inv.invoiceId ? 'Reclaiming…' : 'Reclaim'}
                              </button>
                            )}
                            {!inv.isFunded && !inv.isRepaid && !isBusiness && isConnected && (
                              <button
                                onClick={() => handleFundInvoice(inv)}
                                disabled={fundingId === inv.invoiceId}
                                className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-[11px] shadow-md shadow-amber-500/20 transition disabled:opacity-50"
                              >
                                {fundingId === inv.invoiceId ? 'Funding…' : 'Fund'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW B: ENTERPRISE TOKENIZATION PORTAL */}
          {factoringMode === 'tokenize' && (
            <GlassCard className="p-6 space-y-5 border-cyan-500/30">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Send className="w-4 h-4 text-cyan-400" /> Tokenize Accounts Receivable Invoice
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Publish a real trade receivable on RWAInvoiceFinancing (Creditcoin testnet) — your wallet becomes the business and must repay the full face value at the end of the term.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/40 font-mono block">Your Estimated Advance Tier</span>
                  <span className="text-xs font-bold font-mono text-cyan-400">
                    {calculatedAdvanceRate}% of face (est., based on your CTS)
                  </span>
                </div>
              </div>

              <form onSubmit={handleTokenizeSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">
                      Invoice Face Value (USD)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={tokenAmount}
                        onChange={(e) => setTokenAmount(e.target.value)}
                        placeholder="85000"
                        className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none transition"
                        required
                      />
                      <span className="absolute right-3 top-2.5 text-xs text-white/40 font-mono">USD</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">
                      Payment Tenor (Blocks)
                    </label>
                    <select
                      value={tokenTerm}
                      onChange={(e) => setTokenTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none transition"
                    >
                      <option value="2880">2,880 blocks</option>
                      <option value="5760">5,760 blocks</option>
                      <option value="14400">14,400 blocks</option>
                      <option value="43200">43,200 blocks</option>
                    </select>
                  </div>
                </div>

                {/* Live Scoring Evaluation Box */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-emerald-950/30 border border-cyan-500/25 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-mono">Est. Advance to You</span>
                    <span className="text-base font-bold font-mono text-cyan-300 mt-0.5 block">
                      ${((parseFloat(tokenAmount || '0') * calculatedAdvanceRate) / 100).toLocaleString()} USD
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">est. {calculatedAdvanceRate}% — contract computes exact</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-mono">Repay at Maturity</span>
                    <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                      ${parseFloat(tokenAmount || '0').toLocaleString()} USD
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">Full face value due</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-mono">Term</span>
                    <span className="text-base font-bold font-mono text-white mt-0.5 block">
                      {tokenTerm} blocks
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">Reclaim only after overdue</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setFactoringMode('marketplace')}
                    className="px-4 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 text-xs font-mono transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isTokenizing}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-600 hover:from-cyan-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center gap-2 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {isTokenizing ? 'Tokenizing on Creditcoin L1...' : 'Tokenize & Publish Invoice'}
                  </button>
                </div>
              </form>
            </GlassCard>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: PROOF-OF-RESERVE & COLLATERAL AUDIT MONITOR                     */}
      {/* ========================================================================= */}
      {activeSubTab === 'por' && (
        <div className="space-y-6">
          <GlassCard className="p-6 space-y-5 border-cyan-500/25">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Cryptographic Proof-of-Reserve (PoR) Telemetry
                  <SimulationBadge label="ILLUSTRATIVE" note="Reserve readouts are local preview data — no PoR attestation contract is deployed on testnet." />
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Illustrative custody & collateral figures — connect a wallet for the live tbUSD balance and NAV oracle reads on Creditcoin testnet
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
                  Illustrative Ratio: 102.4% Over-Collateralized
                </span>
              </div>
            </div>

            {/* Collateral Bar Graph & Assets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">Total Collateral Backing</span>
                  <span className="font-mono font-bold text-emerald-400">$25,510,297 USD</span>
                </div>
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full w-[100%]" />
                </div>
                <span className="text-[10px] text-white/40 font-mono block">100% physically held in custody</span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">tbUSD Circulating Supply</span>
                  <span className="font-mono font-bold text-white">$24,912,400 tbUSD</span>
                </div>
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <div className="bg-cyan-400 h-full w-[97.6%]" />
                </div>
                <span className="text-[10px] text-white/40 font-mono block">Over-collateralization cushion: +$597,897</span>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/60">First-Loss Safety Pool</span>
                  <span className="font-mono font-bold text-amber-400">$1,250,000 USDC</span>
                </div>
                <div className="w-full bg-white/[0.06] h-2 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-[100%]" />
                </div>
                <span className="text-[10px] text-white/40 font-mono block">Protocol reserve for credit defaults</span>
              </div>
            </div>

            {/* Asset Allocation Breakdown */}
            <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-3">
              <span className="text-xs font-bold text-white tracking-wide block">
                Physical Asset Portfolio Allocation
              </span>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-400" />
                    US 3-Month Treasury Bills (CUSIP: 912797HY7 &bull; BNY Mellon)
                  </span>
                  <span className="font-mono font-bold text-white">68.0% ($17.34M)</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-cyan-400" />
                    Overnight Reverse Repurchase Agreements (Federal Reserve ON RRP)
                  </span>
                  <span className="font-mono font-bold text-white">22.0% ($5.61M)</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className="text-white/70 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                    First-Loss USDC Liquidity Buffer
                  </span>
                  <span className="font-mono font-bold text-white">10.0% ($2.55M)</span>
                </div>
              </div>
            </div>

            {/* Attestation Log Stream */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-white/70 block">
                Illustrative Attestation Stream (local preview)
              </span>
              <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] space-y-1.5 text-white/60">
                <div className="flex justify-between text-emerald-400">
                  <span>[PREVIEW] CUSIP 912797HY7 Reserve Attestation Validated (illustrative)</span>
                  <span>PREVIEW</span>
                </div>
                <div className="flex justify-between text-white/40">
                  <span>[ORACLE L1] NAV: {treasuryState?.stablePrice ? `$${treasuryState.stablePrice.toFixed(4)}` : 'unavailable'} per tbUSD</span>
                  <span>REAL</span>
                </div>
                <div className="flex justify-between text-cyan-300">
                  <span>[PREVIEW] Siemens Energy Net-45 Factoring Lien Registered (illustrative)</span>
                  <span>PREVIEW</span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modals */}
      <RWATreasuryModal
        isOpen={treasuryOpen}
        onClose={() => setTreasuryOpen(false)}
        userScore={userScore}
        userPosition={userPosition}
        onDeposit={handleDepositUSDC}
        onWithdraw={handleWithdrawShares}
        walletUSDC={walletUSDC}
      />
    </div>
  );
};

export default RWATab;

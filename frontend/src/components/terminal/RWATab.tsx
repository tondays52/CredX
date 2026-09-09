import React, { useState, useEffect, useMemo } from 'react';
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
import InvoiceFactoringModal from '../modals/InvoiceFactoringModal';
import { RWAInvoice, RWATreasuryPosition } from '../../types/tracks';

const RWATab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const { score } = useProtocol();
  const { addToast } = useToast();

  const userScore = score > 0 ? score : 785;
  const isKycVerified = userScore >= 600;
  const isSuperPrime = userScore >= 750;

  // Active sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'tbills' | 'factoring' | 'por'>('tbills');
  const [factoringMode, setFactoringMode] = useState<'marketplace' | 'tokenize'>('marketplace');

  // Modals
  const [treasuryOpen, setTreasuryOpen] = useState(false);
  const [factoringOpen, setFactoringOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<RWAInvoice | null>(null);

  // User Local Financial State
  const [walletUSDC, setWalletUSDC] = useState<number>(24500);
  const [userPosition, setUserPosition] = useState<RWATreasuryPosition>({
    shares: 49.79, // ~ $5,000 USD
    depositedUSDC: 5000,
    accumulatedYieldUSD: 64.28,
    entryTimestamp: Date.now() - 14 * 86400000, // 14 days ago
    lastClaimTimestamp: Date.now(),
    netApy: isSuperPrime ? 7.24 : 5.24,
    bonusUnlocked: isSuperPrime
  });

  // NAV Price Oracle Feed
  const [navPrice, setNavPrice] = useState<number>(100.42);

  // Live real-time yield ticking simulator
  const [liveYieldTicks, setLiveYieldTicks] = useState<number>(0);
  useEffect(() => {
    const timer = setInterval(() => {
      // Small yield tick every second
      const holdingValue = userPosition.shares * navPrice;
      const apy = isSuperPrime ? 0.0724 : 0.0524;
      const perSecYield = (holdingValue * apy) / (365 * 86400);
      setLiveYieldTicks((prev) => prev + perSecYield);
    }, 1000);
    return () => clearInterval(timer);
  }, [userPosition.shares, navPrice, isSuperPrime]);

  // Total Accumulated Yield
  const totalDisplayYield = userPosition.accumulatedYieldUSD + liveYieldTicks;
  const totalPositionUSD = userPosition.shares * navPrice + liveYieldTicks;

  // Wallet balances
  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userTotalPortfolioUSD = userWalletCTC * 2.0 + walletUSDC + totalPositionUSD;

  // Interactive Yield Calculator Simulator State
  const [simAmount, setSimAmount] = useState<number>(10000);
  const simAnnualBaseReturn = (simAmount * 0.0524);
  const simAnnualBonusReturn = isSuperPrime ? (simAmount * 0.02) : 0;
  const simTotalAnnualReturn = simAnnualBaseReturn + simAnnualBonusReturn;

  // Invoices State
  const [invoices, setInvoices] = useState<RWAInvoice[]>([
    {
      id: 'INV-7701',
      debtor: 'Siemens Energy AG',
      industry: 'Power Grid Infrastructure',
      amount: 145000,
      advanceRatePct: 90,
      advanceAmountUSD: 130500,
      discountRate: 8.9,
      termDays: 45,
      status: 'AVAILABLE',
      dnbRating: '1R2',
      goodsDescription: 'High-voltage GIS switchgear systems and transformer substations for North Sea Offshore Wind Grid.',
      repaymentDueDate: 'Oct 24, 2026',
      proofHash: '0x8f19...c31b'
    },
    {
      id: 'INV-7702',
      debtor: 'Maersk Global Cargo Fleet',
      industry: 'Maritime Logistics & Shipping',
      amount: 320000,
      advanceRatePct: 95,
      advanceAmountUSD: 304000,
      discountRate: 9.4,
      termDays: 60,
      status: 'AVAILABLE',
      dnbRating: '5A1',
      goodsDescription: 'Multi-modal containerized freight consignment from Port of Rotterdam to Long Beach Gateway.',
      repaymentDueDate: 'Nov 08, 2026',
      proofHash: '0x3a7e...912f'
    },
    {
      id: 'INV-7703',
      debtor: 'Samsung Heavy Industries',
      industry: 'Shipbuilding & Marine Engineering',
      amount: 580000,
      advanceRatePct: 95,
      advanceAmountUSD: 551000,
      discountRate: 7.8,
      termDays: 30,
      status: 'FINANCED',
      funder: '0x992B...F8A1',
      dnbRating: '1R1',
      goodsDescription: 'Cryogenic containment membrane insulation systems for LNG carrier vessels.',
      repaymentDueDate: 'Oct 10, 2026',
      proofHash: '0x5b41...e788'
    }
  ]);

  // Invoice Tokenization Form State
  const [tokenDebtor, setTokenDebtor] = useState('');
  const [tokenAmount, setTokenAmount] = useState('85000');
  const [tokenTerm, setTokenTerm] = useState('45');
  const [tokenDescription, setTokenDescription] = useState('Industrial machinery spares and turbine components.');
  const [tokenIndustry, setTokenIndustry] = useState('Aerospace & Advanced Manufacturing');
  const [isTokenizing, setIsTokenizing] = useState(false);

  // Dynamic CTS advance rate calculation for enterprise
  const calculatedAdvanceRate = useMemo(() => {
    if (userScore >= 700) return 95;
    if (userScore >= 500) return 90;
    return 80;
  }, [userScore]);

  const calculatedDiscountApr = useMemo(() => {
    if (userScore >= 700) return 6.8;
    if (userScore >= 500) return 8.9;
    return 12.5;
  }, [userScore]);

  // Handlers for Treasury Vault
  const handleDepositUSDC = (depositedAmount: number) => {
    const mintedShares = depositedAmount / navPrice;
    setWalletUSDC((prev) => prev - depositedAmount);
    setUserPosition((prev) => ({
      ...prev,
      shares: prev.shares + mintedShares,
      depositedUSDC: prev.depositedUSDC + depositedAmount,
      netApy: isSuperPrime ? 7.24 : 5.24,
      bonusUnlocked: isSuperPrime
    }));
  };

  const handleWithdrawShares = (sharesToBurn: number) => {
    const baseValue = sharesToBurn * navPrice;
    const bonus = isSuperPrime ? baseValue * 0.02 : 0;
    const totalDisbursed = baseValue + bonus;

    setWalletUSDC((prev) => prev + totalDisbursed);
    setUserPosition((prev) => ({
      ...prev,
      shares: Math.max(0, prev.shares - sharesToBurn)
    }));
  };

  // Handlers for Factoring
  const handleOpenFactoring = (inv: RWAInvoice) => {
    setSelectedInvoice(inv);
    setFactoringOpen(true);
  };

  const handleFundInvoice = (invoiceId: string, fundedAdvance: number) => {
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === invoiceId
          ? { ...inv, status: 'FINANCED', funder: address || '0xCredX...User' }
          : inv
      )
    );
  };

  // Tokenize New Invoice
  const handleTokenizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const faceVal = parseFloat(tokenAmount);
    const days = parseInt(tokenTerm);

    if (!tokenDebtor.trim()) {
      addToast('error', 'Missing Information', 'Enter the verified corporate debtor name.');
      return;
    }
    if (!faceVal || faceVal <= 0) {
      addToast('error', 'Invalid Sum', 'Enter a valid invoice face value.');
      return;
    }

    setIsTokenizing(true);
    addToast('info', 'Creditcoin L1 Proof Verification', 'Hashing ERP records and attaching 0x0FD2 lien contract...');

    setTimeout(() => {
      const advanceVal = (faceVal * calculatedAdvanceRate) / 100;
      const newInvId = `INV-${Math.floor(8000 + Math.random() * 1999)}`;
      const randomHash = `0x${Math.random().toString(16).substring(2, 10)}...${Math.random().toString(16).substring(2, 6)}`;

      const newInvoice: RWAInvoice = {
        id: newInvId,
        debtor: tokenDebtor,
        industry: tokenIndustry,
        amount: faceVal,
        advanceRatePct: calculatedAdvanceRate,
        advanceAmountUSD: advanceVal,
        discountRate: calculatedDiscountApr,
        termDays: days,
        status: 'AVAILABLE',
        dnbRating: userScore >= 750 ? '1R1 (Prime)' : '2R2',
        goodsDescription: tokenDescription,
        repaymentDueDate: `In ${days} Days`,
        proofHash: randomHash
      };

      setInvoices((prev) => [newInvoice, ...prev]);
      setIsTokenizing(false);
      setFactoringMode('marketplace');
      addToast(
        'success',
        'Invoice Tokenized on Creditcoin L1',
        `${newInvId} tokenized with ${calculatedAdvanceRate}% Advance Rate ($${advanceVal.toLocaleString()} USD).`
      );
    }, 1500);
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
            <span className="text-[10px] text-white/40 block">Liquid Cash (USDC)</span>
            <span className="font-bold text-white">${walletUSDC.toLocaleString()}</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <span className="text-[10px] text-emerald-300/70 block">T-Bills Holdings (tbUSD)</span>
            <span className="font-bold text-emerald-300">
              {userPosition.shares.toFixed(2)} tbUSD (${totalPositionUSD.toFixed(2)})
            </span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25">
            <span className="text-[10px] text-cyan-300/70 block">Creditcoin ($CTC)</span>
            <span className="font-bold text-cyan-300">{userWalletCTC.toLocaleString()} CTC</span>
          </div>

          {/* CTS Decentralized KYC Badge */}
          <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
            isKycVerified
              ? isSuperPrime
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <div>
              <div className="text-[10px] font-bold">
                CTS: {userScore} &bull; {isSuperPrime ? 'Super-Prime (+200 BPS)' : 'Decentralized KYC'}
              </div>
              <div className="text-[9px] opacity-75">
                {isSuperPrime ? '7.24% Max Yield Active' : isKycVerified ? 'Verified Institutional Tier' : 'Restricted (<600 CTS)'}
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
            102.4% Over-Collateralized
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
              Real-time daily NAV pricing ($100.42) protected against flash-loan arbitrage and de-pegging exploits.
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
          <Landmark className="w-4 h-4" /> US T-Bills Treasury Fund (tbUSD &bull; 5.24% - 7.24%)
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
                    <span className="text-xl font-bold font-mono text-white">5.24%</span>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <span className="text-[10px] text-amber-300 uppercase block font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> CTS Super-Prime
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-400">+2.00% Bonus</span>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Net Super-Prime APY</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">7.24%</span>
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
                  <p className="text-xs text-white/40 mt-0.5">Accruing real-time yield on Creditcoin L1</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[10px] font-mono text-emerald-400">Live Yield Ticking</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Shares Held</span>
                  <div className="text-lg font-bold font-mono text-white mt-1">
                    {userPosition.shares.toFixed(2)} <span className="text-xs text-white/50">tbUSD</span>
                  </div>
                  <span className="text-[10px] text-white/40 font-mono">Principal: ${userPosition.depositedUSDC.toLocaleString()} USDC</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Current NAV Value</span>
                  <div className="text-lg font-bold font-mono text-emerald-300 mt-1">
                    ${totalPositionUSD.toFixed(2)}
                  </div>
                  <span className="text-[10px] text-emerald-400/70 font-mono">1 tbUSD = ${navPrice.toFixed(2)}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-white/40 block">Yield Earned to Date</span>
                  <div className="text-lg font-bold font-mono text-emerald-400 mt-1">
                    +${totalDisplayYield.toFixed(4)}
                  </div>
                  <span className="text-[10px] text-amber-300 font-mono">
                    {isSuperPrime ? '7.24% Net APY' : '5.24% Base APY'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-white/60 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>No lockup period &bull; Redeem any time for USDC</span>
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
                    Redeem for USDC
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
                  <p className="text-xs text-white/40 mt-0.5">Estimate returns with CTS bonus multiplier</p>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {isSuperPrime ? '7.24% APY' : '5.24% APY'}
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

              {isSuperPrime && (
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>Includes <strong>+${simAnnualBonusReturn.toFixed(0)}/yr</strong> Super-Prime loyalty bonus subsidy!</span>
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
              <span className="text-[10px] font-mono text-white/40 block">Creditcoin Legal Shield</span>
              <span className="text-xs font-mono font-bold text-amber-400">0x0FD2 Automated Lien Settlement</span>
            </div>
          </div>

          {/* Hero Feature Banner with 3D Cargo Factoring Visual */}
          <GlassCard className="p-6 relative overflow-hidden border-amber-500/20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-7 space-y-3 z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono">
                  <Briefcase className="w-3.5 h-3.5" /> Corporate Accounts Receivable Trade Credit
                </div>

                <h2 className="text-2xl font-black text-white tracking-tight">
                  High-Yield Trade Factoring Powered by Reputation-Based Advances
                </h2>

                <p className="text-xs text-white/70 leading-relaxed max-w-xl">
                  Underwrite short-duration trade credit for verified global supply chain conglomerates (Siemens Energy, Maersk, Samsung Heavy). Borrowers receive cash advances up to <strong>95%</strong> based on their Creditcoin Trust Score.
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
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Live Verified Invoices for Factoring
                  </h3>
                  <p className="text-xs text-white/40 mt-0.5">
                    Select an invoice to finance the advance and receive principal + discount yield on maturity
                  </p>
                </div>
                <button
                  onClick={() => setFactoringMode('tokenize')}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 font-mono text-xs transition flex items-center gap-1.5"
                >
                  + Tokenize Business Invoice
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.08] hover:border-amber-500/40 transition space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-amber-300/80 font-bold tracking-wider">
                          {inv.id}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full font-semibold ${
                            inv.status === 'AVAILABLE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-white/[0.05] text-white/40 border border-white/[0.08]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-white font-bold text-sm">{inv.debtor}</h4>
                        <span className="text-[10px] text-white/50 block mt-0.5">{inv.industry}</span>
                      </div>

                      <div className="p-3 rounded-xl bg-black/30 border border-white/[0.04] space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-white/50">Face Value:</span>
                          <span className="font-mono text-white font-semibold">${inv.amount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Advance Rate:</span>
                          <span className="font-mono text-amber-300 font-semibold">
                            {inv.advanceRatePct || 90}% (${(inv.advanceAmountUSD || (inv.amount * 0.9)).toLocaleString()})
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Funder APY:</span>
                          <span className="font-mono text-emerald-400 font-bold">{inv.discountRate}% APR</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/50">Tenor / Term:</span>
                          <span className="font-mono text-white/70">{inv.termDays} Days</span>
                        </div>
                      </div>

                      <p className="text-[11px] text-white/60 line-clamp-2 leading-relaxed">
                        {inv.goodsDescription}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-white/40 block font-mono">D&B Rating</span>
                        <span className="text-xs font-bold text-white font-mono">{inv.dnbRating || '1R2'}</span>
                      </div>

                      {inv.status === 'AVAILABLE' ? (
                        <button
                          onClick={() => handleOpenFactoring(inv)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs shadow-md shadow-amber-500/20 transition flex items-center gap-1.5"
                        >
                          Finance &rarr;
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Funded
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                    Connect verified enterprise billing and disburse immediate cash advance based on Creditcoin Trust Score
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-white/40 font-mono block">Your Enterprise Advance Tier</span>
                  <span className="text-xs font-bold font-mono text-cyan-400">
                    {calculatedAdvanceRate}% Advance &bull; {calculatedDiscountApr}% Financing Cost
                  </span>
                </div>
              </div>

              <form onSubmit={handleTokenizeSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">
                      Debtor Enterprise Name
                    </label>
                    <input
                      type="text"
                      value={tokenDebtor}
                      onChange={(e) => setTokenDebtor(e.target.value)}
                      placeholder="e.g. Caterpillar Inc., ABB Power, Tesla Energy"
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none transition"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-white/70 block mb-1">
                      Industry Sector
                    </label>
                    <input
                      type="text"
                      value={tokenIndustry}
                      onChange={(e) => setTokenIndustry(e.target.value)}
                      placeholder="e.g. Heavy Equipment & Logistics"
                      className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none transition"
                    />
                  </div>

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
                      Payment Tenor (Days)
                    </label>
                    <select
                      value={tokenTerm}
                      onChange={(e) => setTokenTerm(e.target.value)}
                      className="w-full bg-slate-900 border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs outline-none transition"
                    >
                      <option value="30">30 Days (Net 30)</option>
                      <option value="45">45 Days (Net 45)</option>
                      <option value="60">60 Days (Net 60)</option>
                      <option value="90">90 Days (Net 90)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-white/70 block mb-1">
                    Consignment Description / Bill of Lading
                  </label>
                  <textarea
                    rows={2}
                    value={tokenDescription}
                    onChange={(e) => setTokenDescription(e.target.value)}
                    placeholder="Describe goods, parts, shipment origin, and buyer PO number..."
                    className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2 text-white font-mono text-xs outline-none transition"
                  />
                </div>

                {/* Live Scoring Evaluation Box */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/30 via-slate-900/60 to-emerald-950/30 border border-cyan-500/25 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-mono">Calculated Advance</span>
                    <span className="text-base font-bold font-mono text-cyan-300 mt-0.5 block">
                      ${((parseFloat(tokenAmount || '0') * calculatedAdvanceRate) / 100).toLocaleString()} USD
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">({calculatedAdvanceRate}% of Face Value)</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-mono">Financing Cost</span>
                    <span className="text-base font-bold font-mono text-emerald-400 mt-0.5 block">
                      {calculatedDiscountApr}% APR
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">Best-in-class rate</span>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase text-white/40 block font-mono">Lien Mechanism</span>
                    <span className="text-base font-bold font-mono text-white mt-0.5 block">
                      0x0FD2 Proof
                    </span>
                    <span className="text-[10px] text-white/50 font-mono">Cross-chain secured</span>
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
                </h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Audited by BNY Mellon & Chainlink Oracles with Creditcoin L1 precompile 0x0FD2 attestations
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs">
                  Ratio: 102.4% Over-Collateralized
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
                Live Attestation Stream (Creditcoin L1 Precompile 0x0FD2)
              </span>
              <div className="p-3 rounded-xl bg-black/60 border border-white/[0.06] font-mono text-[11px] space-y-1.5 text-white/60">
                <div className="flex justify-between text-emerald-400">
                  <span>[BLOCK #3,491,012] CUSIP 912797HY7 Reserve Attestation Validated</span>
                  <span>CONFIRMED</span>
                </div>
                <div className="flex justify-between text-white/40">
                  <span>[BLOCK #3,490,980] NAV Oracle Update: $100.4200 (+0.0142 Daily Rebase)</span>
                  <span>SETTLED</span>
                </div>
                <div className="flex justify-between text-cyan-300">
                  <span>[BLOCK #3,490,945] Siemens Energy Net-45 Factoring Lien Registered</span>
                  <span>ENFORCED</span>
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

      <InvoiceFactoringModal
        isOpen={factoringOpen}
        onClose={() => setFactoringOpen(false)}
        invoice={selectedInvoice}
        onFund={handleFundInvoice}
      />
    </div>
  );
};

export default RWATab;

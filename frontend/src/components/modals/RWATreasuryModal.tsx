import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Landmark,
  ShieldCheck,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { RWATreasuryPosition } from '../../types/tracks';

interface RWATreasuryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userScore: number;
  userPosition: RWATreasuryPosition;
  onDeposit: (amountUSDC: number) => void;
  onWithdraw: (shares: number) => void;
  walletUSDC?: number;
}

const RWATreasuryModal: React.FC<RWATreasuryModalProps> = ({
  isOpen,
  onClose,
  userScore,
  userPosition,
  onDeposit,
  onWithdraw,
  walletUSDC = 25000
}) => {
  const { addToast } = useToast();
  const [tab, setTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('5000');
  const [loading, setLoading] = useState(false);

  const navPrice = 100.42; // Real-time NAV price per tbUSD share
  const minScoreRequired = 600;
  const isKycVerified = userScore >= minScoreRequired;
  const isSuperPrime = userScore >= 750;

  const parsedAmount = parseFloat(amount) || 0;
  const estimatedShares = parsedAmount > 0 ? parsedAmount / navPrice : 0;

  // Withdrawal calculations
  const parsedWithdrawShares = parseFloat(amount) || 0;
  const baseWithdrawUSD = parsedWithdrawShares * navPrice;
  const superPrimeBonusUSD = isSuperPrime ? (baseWithdrawUSD * 0.02) : 0;
  const totalWithdrawReturn = baseWithdrawUSD + superPrimeBonusUSD;

  const handleDeposit = () => {
    if (!isKycVerified) {
      addToast('error', 'Decentralized KYC Failed', `Your Creditcoin Trust Score (${userScore}) is below the required 600 threshold.`);
      return;
    }
    if (parsedAmount <= 0) {
      addToast('error', 'Invalid Sum', 'Specify a valid USDC amount to allocate.');
      return;
    }
    if (parsedAmount > walletUSDC) {
      addToast('error', 'Insufficient Balance', `You only have $${walletUSDC.toLocaleString()} USDC available.`);
      return;
    }

    setLoading(true);
    addToast('info', 'Creditcoin L1 Interaction', `Minting ${estimatedShares.toFixed(2)} tbUSD shares at NAV $${navPrice}...`);

    setTimeout(() => {
      onDeposit(parsedAmount);
      setLoading(false);
      addToast('success', 'Treasury Position Minted', `Allocated $${parsedAmount.toLocaleString()} USDC to Franklin US T-Bills.`);
      onClose();
    }, 1200);
  };

  const handleWithdraw = () => {
    if (parsedWithdrawShares <= 0) {
      addToast('error', 'Invalid Shares', 'Enter valid tbUSD shares to redeem.');
      return;
    }
    if (parsedWithdrawShares > userPosition.shares) {
      addToast('error', 'Insufficient Shares', `You hold ${userPosition.shares.toFixed(2)} tbUSD shares.`);
      return;
    }

    setLoading(true);
    addToast('info', 'Executing Redemption', `Burning ${parsedWithdrawShares.toFixed(2)} tbUSD via T+0 Liquidity Pool...`);

    setTimeout(() => {
      onWithdraw(parsedWithdrawShares);
      setLoading(false);
      addToast(
        'success',
        'Redemption Settled',
        `Disbursed $${totalWithdrawReturn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC ${
          isSuperPrime ? '(incl. +2% Super-Prime Bonus)' : ''
        }.`
      );
      onClose();
    }, 1200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Franklin US T-Bill Fund (tbUSD / cTBILL)"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs text-white/80">
        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 border border-white/[0.08] rounded-xl">
          <button
            onClick={() => { setTab('deposit'); setAmount('5000'); }}
            className={`py-2 rounded-lg font-mono font-bold text-xs transition flex items-center justify-center gap-1.5 ${
              tab === 'deposit'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Deposit / Mint tbUSD
          </button>
          <button
            onClick={() => { setTab('withdraw'); setAmount(userPosition.shares > 0 ? userPosition.shares.toFixed(2) : '10'); }}
            className={`py-2 rounded-lg font-mono font-bold text-xs transition flex items-center justify-center gap-1.5 ${
              tab === 'withdraw'
                ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40 shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" /> Redeem / Burn tbUSD
          </button>
        </div>

        {/* Creditcoin KYC & Score Assessment Banner */}
        <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
          isKycVerified
            ? isSuperPrime
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-center gap-2.5">
            {isKycVerified ? (
              <CheckCircle2 className={`w-4 h-4 ${isSuperPrime ? 'text-amber-400' : 'text-emerald-400'}`} />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            )}
            <div>
              <div className="font-semibold text-white text-xs flex items-center gap-1.5">
                CTS: {userScore} &bull; {isKycVerified ? (isSuperPrime ? 'Super-Prime Tier' : 'Prime KYC Approved') : 'Under-Collateralized KYC'}
              </div>
              <div className="text-[10px] text-white/60">
                {isKycVerified
                  ? isSuperPrime
                    ? 'Unlocks +2.00% Loyalty Yield Bonus upon redemption (7.24% Net APY)'
                    : 'Permitted access to institutional treasury vault (Min CTS 600 required)'
                  : 'Requires Creditcoin Trust Score ≥ 600 for decentralized KYC verification'}
              </div>
            </div>
          </div>
          {isSuperPrime && (
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold">
              +200 BPS
            </span>
          )}
        </div>

        {/* Metric Overview Grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <span className="text-[10px] uppercase text-white/40 tracking-wider block">Current NAV</span>
            <div className="text-sm font-bold font-mono text-white mt-0.5">${navPrice.toFixed(2)}</div>
            <span className="text-[9px] text-emerald-400 font-mono">1 tbUSD = 1.0042 USD</span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <span className="text-[10px] uppercase text-white/40 tracking-wider block">Net APY</span>
            <div className="text-sm font-bold font-mono text-emerald-400 mt-0.5">
              {isSuperPrime ? '7.24%' : '5.24%'}
            </div>
            <span className="text-[9px] text-white/40 font-mono">{isSuperPrime ? '5.24% + 2.0% Bonus' : 'Daily Rebase'}</span>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <span className="text-[10px] uppercase text-white/40 tracking-wider block">Your Holdings</span>
            <div className="text-sm font-bold font-mono text-white mt-0.5">
              {userPosition.shares.toFixed(2)} <span className="text-[10px] text-white/50">tbUSD</span>
            </div>
            <span className="text-[9px] text-teal-300 font-mono">
              ${(userPosition.shares * navPrice).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </span>
          </div>
        </div>

        {/* Form Input Section */}
        {tab === 'deposit' ? (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-medium text-white/70">USDC Deposit Amount</label>
              <span className="text-[10px] text-white/40 font-mono">
                Avail: ${walletUSDC.toLocaleString()} USDC
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm outline-none transition"
                placeholder="5000"
              />
              <button
                type="button"
                onClick={() => setAmount(walletUSDC.toString())}
                className="absolute right-14 top-2 px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-[10px] font-mono text-emerald-300"
              >
                MAX
              </button>
              <span className="absolute right-3 top-2.5 text-xs text-white/40 font-mono">USDC</span>
            </div>

            <div className="mt-2.5 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5 text-[11px]">
              <div className="flex justify-between text-white/60">
                <span>You will receive:</span>
                <span className="font-mono text-white font-semibold">
                  ~{estimatedShares.toFixed(3)} tbUSD
                </span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Projected 1Y Net Return:</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  +${(parsedAmount * (isSuperPrime ? 0.0724 : 0.0524)).toFixed(2)} USD
                </span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Custody & Clearing:</span>
                <span className="font-mono text-white/80">BNY Mellon &bull; SEC Registered CUSIP 912797HY7</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-medium text-white/70">Shares to Redeem (tbUSD)</label>
              <span className="text-[10px] text-white/40 font-mono">
                Holdings: {userPosition.shares.toFixed(2)} tbUSD
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-teal-500/60 rounded-xl px-3.5 py-2.5 text-white font-mono text-sm outline-none transition"
                placeholder="10"
              />
              <button
                type="button"
                onClick={() => setAmount(userPosition.shares.toFixed(4))}
                className="absolute right-16 top-2 px-2 py-1 rounded bg-white/[0.06] hover:bg-white/[0.12] text-[10px] font-mono text-teal-300"
              >
                MAX
              </button>
              <span className="absolute right-3 top-2.5 text-xs text-white/40 font-mono">tbUSD</span>
            </div>

            <div className="mt-2.5 p-2.5 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5 text-[11px]">
              <div className="flex justify-between text-white/60">
                <span>Base Redemption Value:</span>
                <span className="font-mono text-white">${baseWithdrawUSD.toFixed(2)} USDC</span>
              </div>
              {isSuperPrime ? (
                <div className="flex justify-between text-amber-300">
                  <span>+2% Super-Prime Loyalty Bonus:</span>
                  <span className="font-mono font-bold">+${superPrimeBonusUSD.toFixed(2)} USDC</span>
                </div>
              ) : (
                <div className="flex justify-between text-white/40 text-[10px]">
                  <span>Super-Prime Bonus (&ge;750 CTS):</span>
                  <span>Locked (Reach 750 for +2% boost)</span>
                </div>
              )}
              <div className="pt-1.5 border-t border-white/[0.06] flex justify-between font-bold text-white">
                <span>Total Payout:</span>
                <span className="font-mono text-emerald-400 text-xs">
                  ${totalWithdrawReturn.toFixed(2)} USDC
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 text-xs font-medium transition"
          >
            Cancel
          </button>
          {tab === 'deposit' ? (
            <button
              onClick={handleDeposit}
              disabled={loading || !isKycVerified || parsedAmount <= 0}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              {loading ? 'Minting tbUSD...' : 'Mint tbUSD (Deposit)'}
            </button>
          ) : (
            <button
              onClick={handleWithdraw}
              disabled={loading || parsedWithdrawShares <= 0 || parsedWithdrawShares > userPosition.shares}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white font-semibold text-xs shadow-lg shadow-teal-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              {loading ? 'Redeeming Funds...' : 'Redeem for USDC'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default RWATreasuryModal;

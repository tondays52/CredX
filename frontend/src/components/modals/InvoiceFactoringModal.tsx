import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Building,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { RWAInvoice } from '../../types/tracks';

interface InvoiceFactoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: RWAInvoice | null;
  onFund?: (invoiceId: string, fundedAmount: number) => void;
}

const InvoiceFactoringModal: React.FC<InvoiceFactoringModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onFund
}) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;

  const faceValue = invoice.amount || 150000;
  const advanceRate = invoice.advanceRatePct || 90;
  const advanceAmount = invoice.advanceAmountUSD || (faceValue * advanceRate) / 100;
  const apr = invoice.discountRate || 8.9;
  const termDays = invoice.termDays || 45;

  // Expected profit = Face value - Advance amount (at settlement)
  const expectedProfit = faceValue - advanceAmount;

  const handleFund = () => {
    setLoading(true);
    addToast('info', 'Creditcoin L1 Underwriting', `Disbursing $${advanceAmount.toLocaleString()} advance for ${invoice.debtor}...`);

    setTimeout(() => {
      if (onFund) {
        onFund(invoice.id, advanceAmount);
      }
      setLoading(false);
      addToast(
        'success',
        'Invoice Factored Successfully',
        `Disbursed $${advanceAmount.toLocaleString()} advance. 0x0FD2 lien proof recorded on Creditcoin L1.`
      );
      onClose();
    }, 1300);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Institutional Invoice Factoring Underwriting"
      maxWidth="max-w-lg"
    >
      <div className="space-y-4 text-xs text-white/80">
        {/* Debtor Info Header Card */}
        <div className="flex items-center gap-3.5 p-3.5 bg-gradient-to-r from-amber-500/10 via-slate-900/60 to-slate-900/40 border border-amber-500/20 rounded-xl">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-amber-300 font-semibold tracking-wider uppercase">
                {invoice.id} &bull; {invoice.industry || 'Global Industrial Supply'}
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px]">
                ERP Verified
              </span>
            </div>
            <div className="font-bold text-white text-base truncate mt-0.5">{invoice.debtor}</div>
            <div className="text-[11px] text-white/50 flex items-center gap-2 mt-0.5">
              <span>D&B Rating: <strong className="text-white">{invoice.dnbRating || '1R2'}</strong></span>
              <span>&bull;</span>
              <span>Payment Terms: <strong className="text-white">Net {termDays} Days</strong></span>
            </div>
          </div>
        </div>

        {/* Factoring Economics Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <span className="text-[10px] uppercase text-white/40 tracking-wider block">Face Value</span>
            <div className="text-base font-bold font-mono text-white mt-0.5">
              ${faceValue.toLocaleString()}
            </div>
            <span className="text-[10px] text-white/50 font-mono">100% Maturity</span>
          </div>

          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <span className="text-[10px] uppercase text-white/40 tracking-wider block">Advance Rate</span>
            <div className="text-base font-bold font-mono text-amber-400 mt-0.5">
              {advanceRate}%
            </div>
            <span className="text-[10px] text-amber-300/80 font-mono">
              ${advanceAmount.toLocaleString()} USD
            </span>
          </div>

          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-center">
            <span className="text-[10px] uppercase text-white/40 tracking-wider block">Funder Return</span>
            <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
              {apr}% APR
            </div>
            <span className="text-[10px] text-emerald-300/80 font-mono">
              +${expectedProfit.toLocaleString()} Profit
            </span>
          </div>
        </div>

        {/* Goods / Consignment Detail */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-1.5">
          <div className="text-[10px] uppercase font-mono text-white/40 tracking-wider">
            Consignment & Accounts Receivable Schedule
          </div>
          <div className="text-white text-xs font-mono">
            {invoice.goodsDescription || 'Shipment of heavy industrial switchgear, high-voltage transformers and power grid components.'}
          </div>
          <div className="flex items-center justify-between text-[11px] text-white/60 pt-1 border-t border-white/[0.06]">
            <span>Expected Settlement Date:</span>
            <span className="text-white font-mono">{invoice.repaymentDueDate || 'Within 45 Days'}</span>
          </div>
        </div>

        {/* Risk Mitigation & Creditcoin L1 Gating */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-2">
          <div className="text-[11px] font-semibold text-white/90 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Underwriting Safeguards & Legal Lien Enforcement
          </div>
          <div className="space-y-1 text-[11px] text-white/60">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Attested via Creditcoin L1 Precompile <code>0x0000000000000000000000000000000000000FD2</code></span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Multi-chain collateral freeze: If debtor defaults, global CTS freezes cross-chain credit lines</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>First-loss capital tranche covered by $1.2M USDC Creditcoin Protocol Safety Pool</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleFund}
            disabled={loading || invoice.status !== 'AVAILABLE'}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs shadow-lg shadow-amber-500/25 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {loading ? 'Disbursing Advance...' : `Finance $${advanceAmount.toLocaleString()} Advance`}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceFactoringModal;

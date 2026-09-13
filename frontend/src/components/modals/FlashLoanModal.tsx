import React, { useCallback, useEffect, useState } from 'react';
import { Modal } from '../common/Modal';
import { ExternalLink, RefreshCw, Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { DEMO_WALLET_VAULT } from '../../config/demoWallets';
import { CREDITCOIN_BLOCKSCOUT } from '../../config/contracts';
import {
  demoWalletSigner,
  executeFlashLoan,
  fetchFlashLoanState,
  type FlashLoanState,
} from '../../services/credXService';

interface FlashLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ROOT_WALLET = DEMO_WALLET_VAULT.find((w) => w.id === 'credx-root');
const fmtNum = (v: number | null | undefined, maxDig = 2): string =>
  v == null || !isFinite(v) ? '—' : v.toLocaleString('en-US', { maximumFractionDigits: maxDig });

export const FlashLoanModal: React.FC<FlashLoanModalProps> = ({ isOpen, onClose }) => {
  const [amount, setAmount] = useState(10000);
  const [executing, setExecuting] = useState(false);
  const [done, setDone] = useState<{ ok: boolean; txHash: string; fee: number; message: string } | null>(null);
  const [state, setState] = useState<FlashLoanState | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast, playSound } = useToast();

  const load = useCallback(async () => {
    if (!ROOT_WALLET) return;
    setLoading(true);
    try {
      setState(await fetchFlashLoanState(ROOT_WALLET.address));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setDone(null);
      load();
    }
  }, [isOpen, load]);

  const fee = state ? (amount * state.feeBps) / 10000 : 0;
  const overCap = state ? amount > state.capacity : false;

  const handleExecute = async () => {
    if (!ROOT_WALLET || amount <= 0 || overCap) return;
    setExecuting(true);
    setDone(null);
    try {
      const res = await executeFlashLoan(amount, 0, ROOT_WALLET.address, demoWalletSigner(ROOT_WALLET.privateKey));
      playSound('success');
      setDone({
        ok: true,
        txHash: res.txHash,
        fee: res.fee,
        message: `Real FlashLoan broadcast — borrowed ${fmtNum(res.amount, 4)} cUSD on CC3, live fee ${fmtNum(res.fee, 4)} cUSD repaid in the same block (score ${res.score}, ${state?.feeBps ?? '?'} bps).`,
      });
      showToast('Real Flash Loan Settled', `Borrowed ${fmtNum(amount, 4)} cUSD — real on-chain fee ${fmtNum(res.fee, 4)} cUSD.`, 'success');
      load();
    } catch (err: any) {
      playSound('ping');
      setDone({
        ok: false,
        txHash: '',
        fee: 0,
        message: String(err?.shortMessage || err?.reason || err?.message || 'execution reverted'),
      });
    } finally {
      setExecuting(false);
    }
  };

  if (!ROOT_WALLET) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reputation Flash Loan"
      subtitle="Real zero-collateral atomic borrowing on Creditcoin Testnet"
      icon={<Zap className="w-5 h-5 text-cyan-400" />}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="p-3 rounded-2xl bg-cyan-950/30 border border-cyan-500/20 flex items-center justify-between text-xs font-mono flex-1">
            <div>
              <span className="text-slate-400">Live Credit Fee:</span>
              <span className="text-emerald-400 font-bold ml-1">
                {state ? `${state.feeBps} bps (${tier(state)})` : 'loading…'}
              </span>
            </div>
          </div>
          <div className="p-3 rounded-2xl bg-black/40 border border-white/5 text-xs font-mono text-slate-400 ml-2">
            Capacity: <strong className="text-white">{state ? fmtNum(state.capacity, 0) : '…'} cUSD</strong>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">Flash Loan Principal (cUSD):</label>
          <div className="grid grid-cols-4 gap-2">
            {[5000, 10000, 25000, 50000].map((val) => (
              <button
                key={val}
                onClick={() => setAmount(val)}
                className={`py-2 px-3 rounded-xl border text-xs font-mono font-bold transition-all ${
                  amount === val
                    ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                    : 'bg-white/5 hover:bg-cyan-500/20 border-white/10 text-white'
                }`}
              >
                ${(val / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-cyan-500/50"
          />
          {overCap && <div className="text-[10px] font-mono text-rose-400">Exceeds the lender&apos;s live cUSD balance.</div>}
        </div>

        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Principal Borrowed:</span>
            <span className="text-white font-bold">{fmtNum(amount, 2)} cUSD</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Live Flash Fee ({state?.feeBps ?? '—'} bps):</span>
            <span className="text-emerald-400 font-bold">${fmtNum(fee, 4)} cUSD</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Borrower Wallet:</span>
            <span className="text-white font-bold">{ROOT_WALLET.address.slice(0, 10)}…</span>
          </div>
          <div className="text-[10px] text-slate-500 leading-relaxed pt-1 border-t border-white/5">
            Mode: Audit &amp; Return — liquidity parked and repaid in one block; the executor sponsor float pays the
            fee, so nothing is taken from the borrower&apos;s wallet. All-state reads are live RPC; execution is a real tx.
          </div>
        </div>

        {done && (
          <div className={`p-3 rounded-xl border font-mono text-[11px] space-y-1.5 ${done.ok ? 'bg-emerald-500/[0.06] border-emerald-500/30 text-emerald-200' : 'bg-amber-500/[0.06] border-amber-500/30 text-amber-200'}`}>
            <div className="font-bold">{done.ok ? 'SETTLED IN 1 BLOCK' : 'REVERTED'}</div>
            <div className="text-slate-300">{done.message}</div>
            {done.txHash && (
              <a href={CREDITCOIN_BLOCKSCOUT + '/tx/' + done.txHash} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2 inline-flex items-center gap-1 cursor-pointer">
                {done.txHash.slice(0, 18)}… <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <button
          onClick={handleExecute}
          disabled={executing || loading || amount <= 0 || overCap}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-extrabold text-xs transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50"
        >
          {executing ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Broadcasting Real Flash Loan…</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Execute Real Flash Loan ({fmtNum(amount, 0)} cUSD)</span>
            </>
          )}
        </button>
      </div>
    </Modal>
  );
};

function tier(s: FlashLoanState): string {
  if (s.tier === 'SUPER_PRIME') return 'Super-Prime';
  if (s.tier === 'PRIME') return 'Prime';
  if (s.tier === 'NEAR_PRIME') return 'Near-Prime';
  return 'Standard';
}

export default FlashLoanModal;
import React from 'react';
import { Wallet, ChevronRight, KeyRound, CircleCheck, RefreshCw, ExternalLink } from 'lucide-react';
import { Modal } from '../common/Modal';
import { useWalletPicker } from '../../context/WalletPickerContext';
import { useWeb3 } from '../../context/Web3Context';

interface WalletPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const WalletPickerModal: React.FC<WalletPickerModalProps> = ({ isOpen, onClose }) => {
  const { wallets, active, balances, selectWallet, refreshBalances, isConnected } = useWalletPicker();
  const { toggleConnect } = useWeb3();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Signing Wallet"
      subtitle="Choose which on-chain identity signs this creditcoin testnet transaction"
      maxWidth="max-w-lg"
      icon={<Wallet className="w-5 h-5" />}
    >
      <div className="space-y-4 font-sans">
        {/* External wallet */}
        <div>
          <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 block mb-2 flex items-center gap-1.5">
            <ExternalLink className="w-3 h-3" /> External wallet
          </span>
          <button
            onClick={() => {
              if (!isConnected) toggleConnect();
              else selectWallet('injected');
            }}
            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition ${
              active?.kind === 'injected'
                ? 'bg-cyan-500/15 border-cyan-500/40'
                : 'bg-white/[0.03] border-white/[0.1] hover:border-white/25'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isConnected ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/[0.06] text-slate-400'}`}>
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-white font-bold text-sm block">
                  {isConnected ? 'External EVM Wallet' : 'Connect external wallet…'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {isConnected ? shortAddr(wallets.find((w) => w.id === 'injected')?.address ?? '') : 'MetaMask / injected EVM provider'}
                </span>
              </div>
            </div>
            {active?.kind === 'injected' ? (
              <CircleCheck className="w-4 h-4 text-cyan-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500" />
            )}
          </button>
        </div>

        {/* Demo vault */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-wider font-mono text-slate-400 flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" /> Demo testnet wallets (CC3)
            </span>
            <button
              onClick={refreshBalances}
              className="text-[10px] font-mono text-slate-500 hover:text-cyan-400 transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" /> refresh
            </button>
          </div>
          <div className="space-y-2">
            {wallets
              .filter((w) => w.kind === 'demo')
              .map((w) => {
                const isActive = active?.id === w.id;
                return (
                  <button
                    key={w.id}
                    onClick={() => selectWallet(w.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl border transition text-left ${
                      isActive
                        ? 'bg-emerald-500/10 border-emerald-500/40'
                        : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.06] text-slate-400'}`}>
                        {w.label.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="text-white font-bold text-xs block truncate">{w.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono block">{shortAddr(w.address)} · {w.role}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-right">
                      <span className="text-[10px] font-mono text-slate-400">{balances[w.id] ?? '…'} CTC</span>
                      {isActive ? <CircleCheck className="w-4 h-4 text-emerald-400 shrink-0" /> : null}
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-slate-500 font-mono pt-1 border-t border-white/[0.06]">
          Demo wallets hold CC3 testnet tokens only (faucet). Signatures are real on-chain transactions.
          External accounts sign via your installed wallet on the Creditcoin Testnet chain (102031).
        </p>
      </div>
    </Modal>
  );
};

export default WalletPickerModal;
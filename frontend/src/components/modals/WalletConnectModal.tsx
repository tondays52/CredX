import React, { useState } from 'react';
import { X, Wallet, ArrowUpRight, Copy, Check, LogOut, RefreshCw, AlertCircle, Sparkles, Shield } from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({ isOpen, onClose }) => {
  const {
    isConnected,
    address,
    balanceCTC,
    chainId,
    connectWithProvider,
    disconnect,
    switchNetwork,
    copyAddress,
    isConnecting,
    error,
    discoveredProviders
  } = useWeb3();

  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    copyAddress();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async (type: 'metamask' | 'injected' | 'node' | 'sandbox', customProvider?: any) => {
    await connectWithProvider(type, customProvider);
    if (!error) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md rounded-3xl bg-[#031117] border border-cyan-500/30 shadow-[0_0_50px_rgba(34,211,238,0.15)] overflow-hidden text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Top Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="p-6 border-b border-cyan-500/15 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-black border border-cyan-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)] overflow-hidden">
              <img
                src="/images/credx-butterfly-logo.png"
                alt="CredX Logo"
                className="w-full h-full object-cover scale-125"
              />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isConnected ? 'Connected Account' : 'Connect Wallet'}
              </h3>
              <p className="text-[11px] text-cyan-300/60 font-mono">
                {isConnected ? 'Creditcoin Testnet (102031)' : 'Select your Web3 wallet provider'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {isConnected ? (
            /* Connected Account View */
            <div className="space-y-5">
              {/* Wallet Info Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-950/40 to-black/60 border border-cyan-500/25 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
                    <span className="text-slate-300 font-medium">Status: Connected</span>
                  </div>
                  <span className="font-mono text-[11px] text-teal-300 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/30">
                    Chain ID {chainId}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono text-cyan-400/70 tracking-wider">Address</span>
                  <div className="flex items-center justify-between font-mono text-xs bg-black/50 p-2.5 rounded-xl border border-cyan-500/20">
                    <span className="text-cyan-200 truncate mr-2">{address}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors cursor-pointer"
                        title="Copy address"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                      <a
                        href={`https://creditcoin-testnet.blockscout.com/address/${address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 transition-colors"
                        title="View on Explorer"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* Balance Display */}
                <div className="pt-2 flex items-center justify-between border-t border-cyan-500/15">
                  <span className="text-xs text-slate-400">Available CTC Balance:</span>
                  <span className="text-sm font-extrabold text-white font-mono">
                    {balanceCTC.toLocaleString()} <span className="text-cyan-400">CTC</span>
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {chainId !== 102031 && (
                  <button
                    onClick={switchNetwork}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Switch to Creditcoin Testnet (102031)
                  </button>
                )}

                <button
                  onClick={() => {
                    disconnect();
                    onClose();
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-500/30 hover:border-rose-500/50 text-rose-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Disconnect Wallet
                </button>
              </div>
            </div>
          ) : (
            /* Wallet Provider Selection List */
            <div className="space-y-3">
              {error && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div className="space-y-1">
                    <p className="font-semibold">Connection Notice</p>
                    <p className="text-[11px] text-amber-300/80">{error}</p>
                  </div>
                </div>
              )}

              {/* Dynamically List EIP-6963 Providers if discovered */}
              {discoveredProviders.map((prov) => (
                <button
                  key={prov.info.uuid}
                  disabled={isConnecting}
                  onClick={() => handleConnect('metamask', prov.provider)}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#041a22] to-[#021319] hover:from-[#062c3a] hover:to-[#041e26] border border-cyan-500/30 hover:border-cyan-400 text-left flex items-center justify-between transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3.5">
                    <img src={prov.info.icon} alt={prov.info.name} className="w-10 h-10 rounded-xl p-1 bg-black/40 border border-cyan-500/20" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                          {prov.info.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Direct EIP-6963
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono">{prov.info.rdns}</p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 transition-all" />
                </button>
              ))}

              {/* Standard MetaMask Option */}
              {discoveredProviders.length === 0 && (
                <button
                  disabled={isConnecting}
                  onClick={() => handleConnect('metamask')}
                  className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#041a22] to-[#021319] hover:from-[#062c3a] hover:to-[#041e26] border border-cyan-500/25 hover:border-cyan-400/50 text-left flex items-center justify-between transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#e2761b]/10 border border-[#e2761b]/30 flex items-center justify-center text-xl shadow-md">
                      🦊
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                          MetaMask
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          Browser Extension
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Connect directly via MetaMask extension
                      </p>
                    </div>
                  </div>
                  <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
                </button>
              )}

              {/* 2. Injected EVM Wallet */}
              <button
                disabled={isConnecting}
                onClick={() => handleConnect('injected')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#041a22] to-[#021319] hover:from-[#062c3a] hover:to-[#041e26] border border-cyan-500/25 hover:border-cyan-400/50 text-left flex items-center justify-between transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl shadow-md">
                    🌐
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-cyan-300 transition-colors">
                        Browser Injected Provider
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                        EVM
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Coinbase, Rabby, Brave, or generic Web3
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 3. CredX Virtual Node / Passport */}
              <button
                disabled={isConnecting}
                onClick={() => handleConnect('node')}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-[#041a22] to-[#021319] hover:from-[#062c3a] hover:to-[#041e26] border border-teal-500/25 hover:border-teal-400/50 text-left flex items-center justify-between transition-all group cursor-pointer disabled:opacity-50"
              >
                <div className="flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-xl shadow-md text-teal-300">
                    ⚡
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white group-hover:text-teal-300 transition-colors">
                        CredX Node & Credit Passport
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                        DePIN
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Link active Chrome DePIN Node extension
                    </p>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-teal-300 group-hover:translate-x-0.5 transition-all" />
              </button>

              {/* 4. Testnet Sandbox Account */}
              <div className="pt-2 border-t border-cyan-500/15">
                <button
                  disabled={isConnecting}
                  onClick={() => handleConnect('sandbox')}
                  className="w-full p-3.5 rounded-xl bg-black/40 hover:bg-black/60 border border-cyan-500/20 hover:border-cyan-400/40 text-left flex items-center justify-between transition-all group cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 text-sm">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-200 group-hover:text-white">
                          Testnet Demo Wallet (10,000 CTC)
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-mono bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          Instant
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-mono">
                        0x9afB...8f07 &bull; Instant uncollateralized test access
                      </p>
                    </div>
                  </div>
                  <Check className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-300 transition-colors" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-4 bg-black/60 border-t border-cyan-500/15 text-center text-[10px] text-slate-500 font-mono">
          Creditcoin Testnet &bull; Chain ID 102031 &bull; Zero-Knowledge Sovereign Attestations
        </div>
      </div>
    </div>
  );
};

export default WalletConnectModal;

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ethers, BrowserProvider } from 'ethers';
import { useWeb3 } from './Web3Context';
import { DEMO_WALLET_VAULT } from '../config/demoWallets';
import { demoWalletSigner } from '../services/credXService';
import { CREDITCOIN_RPC } from '../config/contracts';
import WalletPickerModal from '../components/modals/WalletPickerModal';

export type WalletKind = 'injected' | 'demo';

export interface PickerWallet {
  id: string;
  kind: WalletKind;
  label: string;
  role: string;
  address: string;
  privateKey?: string;
}

export interface WalletPickerContextType {
  wallets: PickerWallet[];
  active: PickerWallet | null;
  activeSignerLabel: string;
  isPickerOpen: boolean;
  openPicker: () => void;
  closePicker: () => void;
  selectWallet: (id: string) => void;
  getSigner: () => Promise<ethers.Signer | null>;
  refreshBalances: () => void;
  balances: Record<string, number>;
  injectedDetected: boolean;
  isConnected: boolean;
}

const WalletPickerContext = createContext<WalletPickerContextType | undefined>(undefined);

const DEFAULT_ACTIVE_ID = 'credx-root';

const buildWallets = (web3Address: string, web3Connected: boolean): PickerWallet[] => {
  const demo: PickerWallet[] = DEMO_WALLET_VAULT.map((v) => ({
    id: v.id,
    kind: 'demo',
    label: v.label,
    role: v.role,
    address: v.address,
    privateKey: v.privateKey,
  }));
  const win = typeof window !== 'undefined' ? (window as any) : null;
  const injectedDetected = Boolean(win?.ethereum);
  if (!injectedDetected && !web3Connected) return demo;
  const injected: PickerWallet = {
    id: 'injected',
    kind: 'injected',
    label: web3Connected ? 'External EVM Wallet' : 'Connect external wallet…',
    role: web3Connected ? `connected account ${web3Address.slice(0, 6)}…${web3Address.slice(-4)}` : 'MetaMask / injected EVM provider',
    address: web3Connected ? web3Address : '',
  };
  return [injected, ...demo];
};

export const WalletPickerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected, address, openConnectModal } = useWeb3();
  const [activeId, setActiveId] = useState<string>(DEFAULT_ACTIVE_ID);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [balances, setBalances] = useState<Record<string, number>>({});

  const wallets = useMemo(() => buildWallets(isConnected ? address : '', isConnected), [isConnected, address]);

  const active = useMemo(() => wallets.find((w) => w.id === activeId) ?? null, [wallets, activeId]);

  // Auto-follow the connected external account once a user connects a real wallet,
  // but only if the previous active was the default demo wallet (never yank a
  // deliberately chosen demo signing identity).
  useEffect(() => {
    if (isConnected && activeId === DEFAULT_ACTIVE_ID) {
      setActiveId('injected');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address]);

  const refreshBalances = useCallback(async () => {
    const provider = new ethers.JsonRpcProvider(CREDITCOIN_RPC);
    const next: Record<string, number> = {};
    await Promise.all(
      wallets.map(async (w) => {
        if (!w.address) return;
        try {
          const bal = await provider.getBalance(w.address);
          next[w.id] = parseFloat(parseFloat(ethers.formatEther(bal)).toFixed(4));
        } catch {
          next[w.id] = 0;
        }
      })
    );
    setBalances(next);
  }, [wallets, isConnected]);

  useEffect(() => {
    refreshBalances();
    const t = setInterval(refreshBalances, 30000);
    return () => clearInterval(t);
  }, [refreshBalances]);

  const openPicker = useCallback(() => setIsPickerOpen(true), []);
  const closePicker = useCallback(() => setIsPickerOpen(false), []);

  const selectWallet = useCallback(
    (id: string) => {
      const target = wallets.find((w) => w.id === id);
      if (!target) return;
      if (target.kind === 'injected') {
        if (isConnected) {
          setActiveId('injected');
        } else {
          // No external account yet — route to the standard connect modal.
          openConnectModal();
          return;
        }
      } else {
        setActiveId(id);
      }
      setIsPickerOpen(false);
    },
    [wallets, isConnected, openConnectModal]
  );

  const getSigner = useCallback(async (): Promise<ethers.Signer | null> => {
    if (!active) return null;
    if (active.kind === 'demo' && active.privateKey) {
      try {
        return demoWalletSigner(active.privateKey);
      } catch {
        return null;
      }
    }
    if (active.kind === 'injected') {
      const win = window as any;
      if (win?.ethereum) {
        try {
          return new BrowserProvider(win.ethereum).getSigner();
        } catch {
          return null;
        }
      }
      // Sandbox/node connectors expose an address without an injected provider;
      // fall back to the demo root wallet so the demo still signs for real.
      const root = DEMO_WALLET_VAULT.find((v) => v.id === 'credx-root');
      if (root && root.address.toLowerCase() === active.address.toLowerCase()) {
        try {
          return demoWalletSigner(root.privateKey);
        } catch {
          return null;
        }
      }
    }
    return null;
  }, [active]);

  const activeSignerLabel = active
    ? active.kind === 'demo'
      ? active.label
      : `External · ${active.address.slice(0, 6)}…${active.address.slice(-4)}`
    : 'No wallet';

  const value = useMemo(
    () => ({
      wallets,
      active,
      activeSignerLabel,
      isPickerOpen,
      openPicker,
      closePicker,
      selectWallet,
      getSigner,
      refreshBalances,
      balances,
      injectedDetected: wallets.some((w) => w.kind === 'injected'),
      isConnected,
    }),
    [wallets, active, activeSignerLabel, isPickerOpen, openPicker, closePicker, selectWallet, getSigner, refreshBalances, balances, isConnected]
  );

  return (
    <WalletPickerContext.Provider value={value}>
      {children}
      <WalletPickerModal isOpen={isPickerOpen} onClose={closePicker} />
    </WalletPickerContext.Provider>
  );
};

export const useWalletPicker = () => {
  const ctx = useContext(WalletPickerContext);
  if (!ctx) throw new Error('useWalletPicker must be used within WalletPickerProvider');
  return ctx;
};
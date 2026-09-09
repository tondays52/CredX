import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useToast } from './ToastContext';
import WalletConnectModal from '../components/modals/WalletConnectModal';
import posthog, { isPostHogEnabled } from '../posthog';

export type WalletProviderType = 'metamask' | 'injected' | 'node' | 'sandbox';

export interface EIP6963ProviderDetail {
  info: {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
  };
  provider: any;
}

interface Web3ContextType {
  isConnected: boolean;
  address: string;
  balanceCTC: number;
  chainId: number;
  isConnecting: boolean;
  error: string | null;
  isConnectModalOpen: boolean;
  discoveredProviders: EIP6963ProviderDetail[];
  openConnectModal: () => void;
  closeConnectModal: () => void;
  toggleConnect: () => void;
  connectWithProvider: (type: WalletProviderType, customProvider?: any) => Promise<void>;
  disconnect: () => void;
  copyAddress: () => void;
  switchNetwork: () => Promise<void>;
}

const CREDITCOIN_TESTNET_CHAIN_ID = 102031;
const CREDITCOIN_CHAIN_HEX = '0x18e8f'; // 102031 in hex
const CREDITCOIN_RPC_URL = 'https://rpc.cc3-testnet.creditcoin.network';
const DEFAULT_TESTNET_ACCOUNT = '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07';

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState('');
  const [balanceCTC, setBalanceCTC] = useState(0);
  const [chainId, setChainId] = useState<number>(CREDITCOIN_TESTNET_CHAIN_ID);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [discoveredProviders, setDiscoveredProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [activeProvider, setActiveProvider] = useState<any>(null);
  const { showToast, playSound } = useToast();

  const identifyWallet = useCallback((walletAddress: string) => {
    if (isPostHogEnabled) posthog.identify(walletAddress);
  }, []);

  const resetAnalyticsIdentity = useCallback(() => {
    if (isPostHogEnabled) posthog.reset();
  }, []);

  // 1. EIP-6963 Provider Discovery (Bypasses non-EVM wallet injection conflicts)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleAnnounce = (event: any) => {
      const detail: EIP6963ProviderDetail = event.detail;
      if (!detail || !detail.info || !detail.provider) return;

      setDiscoveredProviders((prev) => {
        if (prev.some((p) => p.info.uuid === detail.info.uuid || p.info.rdns === detail.info.rdns)) {
          return prev;
        }
        return [...prev, detail];
      });
    };

    window.addEventListener('eip6963:announceProvider', handleAnnounce);
    window.dispatchEvent(new Event('eip6963:requestProvider'));

    return () => {
      window.removeEventListener('eip6963:announceProvider', handleAnnounce);
    };
  }, []);

  // Locate the true MetaMask / EVM provider safely
  const resolveTargetProvider = useCallback((type: WalletProviderType, customProvider?: any): any => {
    if (customProvider) return customProvider;

    // A. Check EIP-6963 discovered providers first (Cleanest standard)
    if (type === 'metamask') {
      const mmDetail = discoveredProviders.find(
        (p) => p.info.rdns === 'io.metamask' || p.info.name.toLowerCase().includes('metamask')
      );
      if (mmDetail) return mmDetail.provider;
    }

    if (typeof window === 'undefined') return null;
    const win = window as any;
    if (!win.ethereum) return null;

    // B. Check if window.ethereum has a providers array
    if (Array.isArray(win.ethereum.providers)) {
      if (type === 'metamask') {
        const mm = win.ethereum.providers.find(
          (p: any) => p.isMetaMask && !p.isPhantom && !p.isPetra && !p.isMartian && !p.isBraveWallet
        );
        if (mm) return mm;
      }
      const generic = win.ethereum.providers.find((p: any) => typeof p.request === 'function');
      if (generic) return generic;
    }

    // C. Check direct window.ethereum
    return win.ethereum;
  }, [discoveredProviders]);

  const openConnectModal = useCallback(() => {
    setIsConnectModalOpen(true);
    setError(null);
  }, []);

  const closeConnectModal = useCallback(() => {
    setIsConnectModalOpen(false);
    setError(null);
  }, []);

  // Helper to fetch live CTC balance
  const fetchBalance = useCallback(async (account: string) => {
    try {
      const fallbackProvider = new ethers.JsonRpcProvider(CREDITCOIN_RPC_URL);
      const balWei = await fallbackProvider.getBalance(account);
      const balFormatted = parseFloat(ethers.formatEther(balWei));
      setBalanceCTC(Number(balFormatted.toFixed(4)));
    } catch (err) {
      console.warn('Could not fetch real-time CTC balance:', err);
    }
  }, []);

  // Switch or Add Creditcoin Testnet
  const switchNetwork = useCallback(async () => {
    const provider = activeProvider || resolveTargetProvider('metamask');
    if (!provider || typeof provider.request !== 'function') return;

    try {
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: CREDITCOIN_CHAIN_HEX }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902 || switchError.message?.includes('4902')) {
        try {
          await provider.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: CREDITCOIN_CHAIN_HEX,
                chainName: 'Creditcoin Testnet',
                nativeCurrency: {
                  name: 'Creditcoin',
                  symbol: 'CTC',
                  decimals: 18,
                },
                rpcUrls: [CREDITCOIN_RPC_URL],
                blockExplorerUrls: ['https://creditcoin-testnet.blockscout.com'],
              },
            ],
          });
        } catch (addErr) {
          console.warn('Failed to add Creditcoin Testnet:', addErr);
        }
      }
    }
  }, [activeProvider, resolveTargetProvider]);

  // Connect specific provider
  const connectWithProvider = useCallback(async (type: WalletProviderType, customProvider?: any) => {
    setIsConnecting(true);
    setError(null);

    try {
      if (type === 'sandbox') {
        if (!isConnected || address !== DEFAULT_TESTNET_ACCOUNT) {
          if (address) resetAnalyticsIdentity();
          identifyWallet(DEFAULT_TESTNET_ACCOUNT);
        }
        setAddress(DEFAULT_TESTNET_ACCOUNT);
        setIsConnected(true);
        setActiveProvider(null);
        await fetchBalance(DEFAULT_TESTNET_ACCOUNT);
        playSound('success');
        showToast(
          'Connected Testnet Wallet',
          `Demo Wallet: ${DEFAULT_TESTNET_ACCOUNT.slice(0, 6)}...${DEFAULT_TESTNET_ACCOUNT.slice(-4)} (10,000 CTC)`,
          'success',
          3500
        );
        setIsConnectModalOpen(false);
        return;
      }

      if (type === 'node') {
        const nodeAccount = DEFAULT_TESTNET_ACCOUNT;
        if (!isConnected || address !== nodeAccount) {
          if (address) resetAnalyticsIdentity();
          identifyWallet(nodeAccount);
        }
        setAddress(nodeAccount);
        setIsConnected(true);
        setActiveProvider(null);
        await fetchBalance(nodeAccount);
        playSound('success');
        showToast(
          'CredX Node Linked',
          `DePIN Operator: ${nodeAccount.slice(0, 6)}...${nodeAccount.slice(-4)} connected`,
          'success',
          3500
        );
        setIsConnectModalOpen(false);
        return;
      }

      // MetaMask or Injected EVM
      const provider = resolveTargetProvider(type, customProvider);

      if (!provider || typeof provider.request !== 'function') {
        const msg = type === 'metamask'
          ? 'MetaMask extension not detected. Please unlock MetaMask or select another connector.'
          : 'No injected EVM browser wallet found.';
        setError(msg);
        showToast('Wallet Not Found', msg, 'error');
        return;
      }

      playSound('click');

      // Request accounts from provider
      let accounts: string[] = [];
      try {
        accounts = await provider.request({ method: 'eth_requestAccounts' });
      } catch (reqErr: any) {
        // If non-EVM conflict threw "Unable to find any account for 60"
        if (reqErr.message && reqErr.message.includes('60')) {
          console.warn('Non-EVM wallet intercepted eth_requestAccounts. Trying direct eth_accounts...');
          accounts = await provider.request({ method: 'eth_accounts' });
        } else {
          throw reqErr;
        }
      }

      if (accounts && accounts.length > 0) {
        const userAccount = ethers.getAddress(accounts[0]);
        if (!isConnected || address !== userAccount) {
          if (address) resetAnalyticsIdentity();
          identifyWallet(userAccount);
        }
        setAddress(userAccount);
        setIsConnected(true);
        setActiveProvider(provider);

        try {
          const currentChainHex = await provider.request({ method: 'eth_chainId' });
          const currentChainNum = parseInt(currentChainHex, 16);
          setChainId(currentChainNum);

          if (currentChainNum !== CREDITCOIN_TESTNET_CHAIN_ID) {
            await switchNetwork();
          }
        } catch (chainErr) {
          console.warn('Chain check warning:', chainErr);
        }

        await fetchBalance(userAccount);
        playSound('success');
        showToast(
          'Wallet Connected',
          `Connected: ${userAccount.slice(0, 6)}...${userAccount.slice(-4)} on Creditcoin Testnet`,
          'success',
          3500
        );
        setIsConnectModalOpen(false);
      }
    } catch (err: any) {
      console.warn('Wallet connection error:', err);
      let errMsg = err.message || 'Connection request was cancelled by user';
      if (errMsg.includes('60')) {
        errMsg = 'A multi-chain extension intercepted the connection. Please unlock MetaMask and click connect again.';
      }
      setError(errMsg);
      showToast('Connection Info', errMsg, 'error', 3500);
    } finally {
      setIsConnecting(false);
    }
  }, [resolveTargetProvider, fetchBalance, switchNetwork, showToast, playSound, isConnected, address, identifyWallet, resetAnalyticsIdentity]);

  const disconnect = useCallback(() => {
    if (address) resetAnalyticsIdentity();
    setIsConnected(false);
    setAddress('');
    setBalanceCTC(0);
    setActiveProvider(null);
    playSound('click');
    showToast('Wallet Disconnected', 'Switched to Public Read-Only Mode', 'info', 2500);
  }, [address, showToast, playSound, resetAnalyticsIdentity]);

  const toggleConnect = useCallback(() => {
    openConnectModal();
  }, [openConnectModal]);

  // Clean listeners on active provider
  useEffect(() => {
    const provider = activeProvider || resolveTargetProvider('metamask');
    if (!provider || typeof provider.on !== 'function') return;

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts && accounts.length > 0) {
        const userAccount = ethers.getAddress(accounts[0]);
        if (address && address !== userAccount) resetAnalyticsIdentity();
        if (address !== userAccount) identifyWallet(userAccount);
        setAddress(userAccount);
        setIsConnected(true);
        fetchBalance(userAccount);
      } else {
        if (address) resetAnalyticsIdentity();
        setIsConnected(false);
        setAddress('');
        setBalanceCTC(0);
      }
    };

    const handleChainChanged = (chainHex: string) => {
      const newChain = parseInt(chainHex, 16);
      setChainId(newChain);
      if (address) fetchBalance(address);
    };

    provider.on('accountsChanged', handleAccountsChanged);
    provider.on('chainChanged', handleChainChanged);

    return () => {
      if (provider.removeListener) {
        provider.removeListener('accountsChanged', handleAccountsChanged);
        provider.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [activeProvider, resolveTargetProvider, address, fetchBalance, identifyWallet, resetAnalyticsIdentity]);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      playSound('click');
      showToast('Address Copied', `${address.slice(0, 10)}...${address.slice(-6)} copied to clipboard`, 'success', 2000);
    });
  }, [address, showToast, playSound]);

  return (
    <Web3Context.Provider
      value={{
        isConnected,
        address,
        balanceCTC,
        chainId,
        isConnecting,
        error,
        isConnectModalOpen,
        discoveredProviders,
        openConnectModal,
        closeConnectModal,
        toggleConnect,
        connectWithProvider,
        disconnect,
        copyAddress,
        switchNetwork,
      }}
    >
      {children}
      {/* Global Web3 Connect & Account Modal */}
      <WalletConnectModal isOpen={isConnectModalOpen} onClose={closeConnectModal} />
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) throw new Error('useWeb3 must be used within Web3Provider');
  return context;
};

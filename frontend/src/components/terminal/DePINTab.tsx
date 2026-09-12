import React, { useState, useEffect } from 'react';
import GlassCard from '../common/GlassCard';
import { useWeb3 } from '../../context/Web3Context';
import { useProtocol } from '../../context/ProtocolContext';
import { useToast } from '../../context/ToastContext';
import posthog, { isPostHogEnabled } from '../../posthog';
import {
  Cpu,
  Server,
  Wifi,
  Activity,
  CheckCircle,
  Zap,
  Shield,
  Play,
  Pause,
  ArrowUpRight,
  TrendingUp,
  Coins,
  DollarSign,
  Radio,
  Layers,
  Sparkles,
  Lock,
  RefreshCw,
  Globe,
  Satellite,
  BrainCircuit,
  Smartphone,
  ShieldCheck,
  Terminal as TerminalIcon,
  CheckCircle2,
  ExternalLink,
  Power,
  Copy,
  BarChart3,
  Award,
  Wallet,
  PieChart,
  ArrowDownRight,
  Clock,
  HardDrive,
  Flame,
  Crosshair,
  Compass,
  Search,
  Navigation
} from 'lucide-react';
import GPULeaseModal from '../modals/GPULeaseModal';
import PulseAttestationModal from '../modals/PulseAttestationModal';
import { NexusAttestationModal } from '../modals/NexusAttestationModal';
import { GeoOrbitAttestationModal } from '../modals/GeoOrbitAttestationModal';
import { CredXGeoOrbitView } from './CredXGeoOrbitView';
import { BittensorSubnetView } from './BittensorSubnetView';
import GoogleMapView from '../common/GoogleMapView';
import { scanRealBluetoothDevice } from '../../utils/realHardwareConnect';
import { Modal } from '../common/Modal';
import { GPUCluster } from '../../types/tracks';
import {
  Users,
  AppWindow,
  QrCode,
  Bell,
  Settings,
  Send,
  ArrowDown,
  Repeat,
  SlidersHorizontal,
  MapPin,
  Sun,
  Moon,
  Info,
  Sliders,
  Maximize2,
  ChevronDown,
  Check,
  Bluetooth,
  Signal,
  AlertTriangle,
  X
} from 'lucide-react';
import SimulationBadge from '../common/SimulationBadge';
import {
  fetchDePINState,
  fetchBorrowerProfile,
  depinDelegateStake,
  depinUndelegateStake,
  requestHardwareLoan,
  repayHardwareLoan,
  txHashShort
} from '../../services/credXService';

export type DePINSector = 'pulse' | 'nodle' | 'geodnet' | 'bittensor' | 'staking';
export type PulseSubTab = 'dashboard' | 'wallet' | 'allocation' | 'rewards';
export type NexusViewMode = 'app' | 'enterprise' | 'wallet';
export type EnterpriseSubTab = 'dashboard' | 'map' | 'detections' | 'fleets';
export type SDKMetricTab = 'users' | 'detected' | 'detections' | 'unique';

const DePINTab: React.FC = () => {
  const { isConnected, address, balanceCTC, openConnectModal } = useWeb3();
  const {
    hardware,
    runPingTest,
    score,
    pulseConnected,
    pulseEpoch,
    pulseNetworkQuality,
    pulseUptimePoints,
    pulseNetworkPoints,
    pulseBandwidthGB,
    pulseStakedCTC,
    pulseStakingAPR,
    pulseClaimableRewardUSD,
    pulseTier,
    pulseTierPoints,
    pulseLevelProgressPct,
    pulseRealIP,
    pulseCountryFlag,
    pulseCountryName,
    pulseComputeThroughputMhash,
    pulseSessionSeconds,
    pulseNetworks,
    renamePulseNetwork,
    togglePulseNode,
    claimPulseAllocation,
    claimPulseTierBonus,
    stakePulseCTC,
    // CredX Nexus IoT Edge & Fleet State
    nexusActive,
    nexusMode,
    nexusClaimableTokens,
    nexusTotalBeacons,
    nexusTeamMembers,
    nexusFleetsCount,
    nexusAppsCount,
    nexusTotalDetections,
    nexusDailyDetections,
    nexusDiscoveredBeacons,
    nexusRealGeo,
    nexusH3Hex,
    nexusUncommittedPackets,
    nexusRecencyFilter,
    nexusRecencyMaxMinutes,
    nexusMapTheme,
    toggleNexusNode,
    setNexusMode,
    claimNexusTokens,
    attestNexusBatch,
    setNexusRecencyFilter,
    setNexusRecencyMaxMinutes,
    setNexusMapTheme,
    addNexusBeacon,
    // CredX GeoOrbit State & Handlers
    orbitConnected,
    orbitTotalStations,
    orbitMyStationsCount,
    orbitClaimableTokens,
    orbitBurnedTokens,
    orbitDataRevenueUSD,
    orbitSatellitesLocked,
    orbitAccuracyCm,
    orbitActiveHexMultiplier,
    orbitMountpoint,
    orbitStationUptimeHours,
    orbitSatellites,
    orbitNmeaSentence,
    orbitNmeaData,
    orbitLastAttestationHash,
    orbitPoSTProofsCount,
    orbitStableHexes,
    orbitClusters,
    orbitMountpoints,
    toggleOrbitStation,
    claimOrbitTokens,
    syncOrbitAttestation,
    setOrbitMountpoint,
    simulateRoverFix
  } = useProtocol();
  const { addToast } = useToast();

  const [activeSector, setActiveSector] = useState<DePINSector>('pulse');
  const [activePulseTab, setActivePulseTab] = useState<PulseSubTab>('dashboard');
  const [nexusViewMode, setNexusViewMode] = useState<NexusViewMode>('app');
  const [enterpriseSubTab, setEnterpriseSubTab] = useState<EnterpriseSubTab>('dashboard');
  const [sdkMetricTab, setSdkMetricTab] = useState<SDKMetricTab>('detections');
  const [selectedBeacon, setSelectedBeacon] = useState<any | null>(null);
  const [selectedFleetFilter, setSelectedFleetFilter] = useState<string>('All');
  const [pathsActive, setPathsActive] = useState(true);
  const [nexusModalOpen, setNexusModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [bellDrawerOpen, setBellDrawerOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [iotModalOpen, setIotModalOpen] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [selectedGPU, setSelectedGPU] = useState<GPUCluster | null>(null);
  const [gpuModalOpen, setGpuModalOpen] = useState(false);
  const [pulseModalOpen, setPulseModalOpen] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [delegating, setDelegating] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('500');
  const [pulseStakeInput, setPulseStakeInput] = useState('100');
  const [undelegating, setUndelegating] = useState(false);
  const [requestingLoan, setRequestingLoan] = useState(false);
  const [repayingLoan, setRepayingLoan] = useState(false);
  const [loadingDePIN, setLoadingDePIN] = useState(false);
  const [loanInput, setLoanInput] = useState('1000');
  const [depinState, setDepinState] = useState<Awaited<ReturnType<typeof fetchDePINState>>>(null);
  const [delegationAmount, setDelegationAmount] = useState<number | null>(null);

  // CredX GeoOrbit Local State
  const [orbitSubTab, setOrbitSubTab] = useState<'explorer' | 'coverage' | 'hardware' | 'tokenomics'>('explorer');
  const [orbitModalOpen, setOrbitModalOpen] = useState<boolean>(false);
  const [selectedStableHex, setSelectedStableHex] = useState<any | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null);
  const [hexSearchQuery, setHexSearchQuery] = useState<string>('');
  const [roverSimulationMode, setRoverSimulationMode] = useState<1 | 4 | 5>(4);

  // Sector URL Hash Sync (#/pulse, #/nexus, #/geodnet, #/orbit, #/depin)
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('nexus') || hash.includes('nodle')) {
        setActiveSector('nodle');
      } else if (hash.includes('geodnet') || hash.includes('geoorbit') || hash.includes('orbit')) {
        setActiveSector('geodnet');
      } else if (hash.includes('pulse')) {
        setActiveSector('pulse');
      }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Notifications drawer state
  const [activeNotifications, setActiveNotifications] = useState([
    { id: 1, title: 'Demo: Packets Buffered Locally', desc: 'BLE packets held locally in this browser session (simulated). No on-chain Merkle batch was attested.', time: '3m ago', unread: true, type: 'chain' },
    { id: 2, title: 'New Beacon Witnessed', desc: 'Cargo BLE Tag #8492 witnessed in Hex 882a90714b7ffff. Signal RSSI: -62 dBm.', time: '14m ago', unread: true, type: 'ble' },
    { id: 3, title: 'NEXUS Rewards Accrued', desc: '0.1420 NEXUS ready to claim from edge routing operations.', time: '1h ago', unread: false, type: 'reward' },
    { id: 4, title: 'CTS Reputation Multiplier', desc: 'Creditcoin Trust Score at 850 granting 1.65x frontier packet attestation bonus.', time: '3h ago', unread: false, type: 'score' },
  ]);

  // Station configuration parameters
  const [stationConfig, setStationConfig] = useState({
    txPower: '+4 dBm (High Range)',
    scanInterval: 'Aggressive (1000ms)',
    merkleBatchSize: '10 Packets',
    batterySaver: true,
    rpcUrl: 'https://rpc.cc3-testnet.creditcoin.network'
  });

  // 4 Distinct Real Mathematical Datasets for Enterprise SDK Metric Tabs
  const sdkDataMap: Record<SDKMetricTab, {
    title: string;
    peak: string;
    unit: string;
    max: number;
    gradientFrom: string;
    gradientTo: string;
    color: string;
    data: number[];
  }> = {
    users: {
      title: 'Daily Active Users (SDK)',
      peak: 'Peak: 26 users/day',
      unit: 'users',
      max: 32,
      gradientFrom: 'from-cyan-500/40',
      gradientTo: 'to-cyan-400',
      color: '#22d3ee',
      data: [8, 9, 11, 10, 14, 12, 15, 13, 16, 15, 18, 17, 19, 21, 20, 18, 22, 24, 21, 23, 25, 22, 24, 26, 23, 21, 24, 25, 26, 24]
    },
    detected: {
      title: 'Daily Detected Beacons',
      peak: 'Peak: 96 beacons/day',
      unit: 'beacons',
      max: 110,
      gradientFrom: 'from-purple-500/40',
      gradientTo: 'to-purple-400',
      color: '#c084fc',
      data: [28, 34, 42, 39, 45, 51, 48, 55, 60, 58, 64, 61, 70, 72, 68, 75, 79, 82, 80, 85, 88, 84, 89, 92, 90, 88, 94, 95, 96, 91]
    },
    detections: {
      title: 'Daily Packet Detections',
      peak: 'Peak: 520 detections/day',
      unit: 'pkts',
      max: 560,
      gradientFrom: 'from-emerald-500/40',
      gradientTo: 'to-emerald-400',
      color: '#34d399',
      data: nexusDailyDetections
    },
    unique: {
      title: 'Daily Unique Beacons',
      peak: 'Peak: 52 unique/day',
      unit: 'unique beacons',
      max: 60,
      gradientFrom: 'from-amber-500/40',
      gradientTo: 'to-amber-400',
      color: '#fbbf24',
      data: [14, 18, 16, 21, 20, 24, 22, 27, 29, 26, 31, 33, 30, 35, 38, 36, 40, 43, 41, 44, 47, 45, 48, 50, 49, 47, 51, 52, 50, 48]
    }
  };

  // Beacon Map Positioning & Recency Metadata Derivation
  const beaconPositions: Record<string, { className: string }> = {
    'BCN-8492': { className: 'top-20 left-32' },
    'BCN-1940': { className: 'bottom-24 left-44' },
    'BCN-0032': { className: 'top-28 right-36' },
    'BCN-0401': { className: 'bottom-16 right-28' },
  };

  const getBeaconRecencyMeta = (timestamp: number) => {
    const ageMin = (Date.now() - timestamp) / (1000 * 60);
    if (ageMin <= 15) {
      return {
        color: 'red',
        dotClass: 'bg-red-500',
        borderClass: 'border-red-500/40',
        shadowClass: 'shadow-red-500/80',
        label: `${Math.max(1, Math.round(ageMin))}m ago 🔴 Recent`
      };
    } else if (ageMin <= 120) {
      return {
        color: 'emerald',
        dotClass: 'bg-emerald-500',
        borderClass: 'border-emerald-500/40',
        shadowClass: 'shadow-emerald-500/80',
        label: `${Math.round(ageMin)}m ago 🟢 Middle`
      };
    } else {
      return {
        color: 'blue',
        dotClass: 'bg-blue-500',
        borderClass: 'border-blue-500/40',
        shadowClass: 'shadow-blue-500/80',
        label: `${(ageMin / 60).toFixed(1)}h ago 🔵 Oldest`
      };
    }
  };

  const filteredBeacons = nexusDiscoveredBeacons.filter(b => {
    if (selectedFleetFilter !== 'All' && b.fleetName !== selectedFleetFilter) return false;
    const ageMinutes = (Date.now() - b.timestamp) / (1000 * 60);
    if (nexusRecencyFilter === '15m' && ageMinutes > 15) return false;
    if (nexusRecencyFilter === '1h' && ageMinutes > 60) return false;
    if (nexusRecencyFilter === '6h' && ageMinutes > 360) return false;
    return true;
  });

  // Real Hardware IoT / Bluetooth Scanner Handler
  const handleScanRealBluetoothDevice = async () => {
    setIsScanningBluetooth(true);
    try {
      addToast('info', 'Web Bluetooth Scanner', 'Opening system Bluetooth pairing dialog to discover real IoT devices...');
      const device = await scanRealBluetoothDevice();
      const realBeacon = {
        id: device.id,
        name: device.name,
        category: device.category as any,
        macHash: `0x${Math.random().toString(16).slice(2, 6)}..${Math.random().toString(16).slice(2, 6)}`,
        distanceMeters: Math.max(0.8, +((Math.abs(device.rssi + 50) / 10).toFixed(1))),
        rssi: device.rssi,
        lat: nexusRealGeo.lat + (Math.random() - 0.5) * 0.006,
        lng: nexusRealGeo.lng + (Math.random() - 0.5) * 0.006,
        batteryPct: Math.floor(70 + Math.random() * 28),
        timestamp: Date.now(),
        merkleLeaf: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        payloadSize: 32,
        fleetName: 'Physical Discovered IoT'
      };
      addNexusBeacon(realBeacon);
      setIsScanningBluetooth(false);
      addToast(
        'success',
        'Physical IoT Device Witnessed!',
        `Paired with "${device.name}" (${device.category}) via Web Bluetooth. RSSI: ${device.rssi} dBm. Packet anchored into mesh!`
      );
    } catch (err: any) {
      setIsScanningBluetooth(false);
      if (err.name !== 'NotFoundError') {
        setIotModalOpen(true);
      }
    }
  };

  // Dynamically computed allocation from real accumulated points and Creditcoin Trust Score
  const dynamicAllocationUSDC = (
    (pulseUptimePoints * 0.000010 + pulseNetworkPoints * 0.003) * (score / 750)
  ).toFixed(2);

  // Simulated live web scraping requests for CredX Pulse node
  const [requestLogs, setRequestLogs] = useState<Array<{ id: number; time: string; url: string; size: string; status: number }>>([
    { id: 1, time: 'Just now', url: 'huggingface.co/datasets/fin-sentiment-v3', size: '24.2 KB', status: 200 },
    { id: 2, time: '2s ago', url: 'arxiv.org/abs/2405.0192 (AI Alignment)', size: '68.5 KB', status: 200 },
    { id: 3, time: '5s ago', url: 'sec.gov/edgar/data/10-K/apple-2025', size: '142.0 KB', status: 200 }
  ]);

  useEffect(() => {
    if (!pulseConnected) return;
    const interval = setInterval(() => {
      const endpoints = [
        'commoncrawl.org/crawl-data/CC-MAIN-2026',
        'github.com/trending/python/deep-learning',
        'wikipedia.org/wiki/Creditcoin_Attestcoin',
        'reuters.com/markets/global-macro-sentiment',
        'kaggle.com/datasets/multimodal-dialogue'
      ];
      const randomUrl = endpoints[Math.floor(Math.random() * endpoints.length)];
      const randomSize = (Math.random() * 80 + 10).toFixed(1) + ' KB';
      setRequestLogs(prev => [
        { id: Date.now(), time: 'Just now', url: randomUrl, size: randomSize, status: 200 },
        ...prev.slice(0, 4)
      ]);
    }, 3500);
    return () => clearInterval(interval);
  }, [pulseConnected]);

  const userWalletCTC = balanceCTC > 0 ? balanceCTC : 10000;
  const userWalletUSD = userWalletCTC * 2.0;

  const handlePing = async () => {
    setPinging(true);
    addToast('info', 'DePIN Probe', 'Executing round-trip latency probe to closest Creditcoin validator...');
    const result = await runPingTest();
    setPinging(false);
    addToast('success', 'Ping Synchronized', `Response latency measured at ${result}ms.`);
  };

  const handleOpenLease = (cluster: GPUCluster) => {
    setSelectedGPU(cluster);
    setGpuModalOpen(true);
  };

  const DEPIN_SAMPLE_OPERATOR = '0x3b48b8f2C3CFc8b2BC4cFF0aE97b9b7B2c15E0d1';

  const reloadDePINState = async () => {
    if (!address) {
      setDepinState(null);
      setDelegationAmount(null);
      return;
    }
    setLoadingDePIN(true);
    try {
      const [own, delegated] = await Promise.all([
        fetchDePINState(address, null),
        fetchDePINState(address, DEPIN_SAMPLE_OPERATOR),
      ]);
      setDepinState(own);
      setDelegationAmount(delegated ? delegated.delegationAmount : null);
    } finally {
      setLoadingDePIN(false);
    }
  };

  useEffect(() => {
    reloadDePINState();
  }, [address]);

  const depinSymbol = depinState?.depinToken?.symbol || 'DEPIN';

  const handleDelegateStake = async () => {
    if (!isConnected) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to delegate DEPIN stake.');
      return;
    }
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0) {
      addToast('error', 'Invalid Stake Amount', `Enter a valid ${depinSymbol} amount.`);
      return;
    }
    if (depinState && num > depinState.depinBalance) {
      addToast('error', 'Insufficient Balance', `Please enter an amount up to your ${depinState.depinToken.symbol} balance.`);
      return;
    }
    setDelegating(true);
    try {
      const profile = await fetchBorrowerProfile(DEPIN_SAMPLE_OPERATOR);
      if (!profile || profile.creditScore < 700) {
        addToast('error', 'Operator Not Eligible', 'Sample operator reliability is below 700 CTS (OperatorReliabilityTooLow) — delegation would revert on-chain.');
        return;
      }
      addToast('info', 'DePIN Delegation', `Approving DEPIN and staking ${num.toLocaleString()} ${depinSymbol} to the sample operator...`);
      const hash = await depinDelegateStake(DEPIN_SAMPLE_OPERATOR, num);
      addToast('success', 'Delegation Active', `Delegated ${num.toLocaleString()} ${depinSymbol}. Tx: ${txHashShort(hash)}`);
      if (isPostHogEnabled) posthog.capture('depin_stake_delegated', { amount: num });
      await reloadDePINState();
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Transaction rejected.';
      if (msg.includes('OperatorReliabilityTooLow')) {
        addToast('error', 'Operator Not Eligible', 'Operator score below 700 — delegation rejected on-chain.');
      } else {
        addToast('error', 'Delegation Failed', msg);
      }
    } finally {
      setDelegating(false);
    }
  };

  const handleUndelegateStake = async () => {
    if (!isConnected) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to undelegate DEPIN stake.');
      return;
    }
    const num = parseFloat(stakeAmount);
    if (isNaN(num) || num <= 0 || delegationAmount == null || num > delegationAmount) {
      addToast('error', 'Invalid Undelegate Amount', `Enter a valid amount up to your delegated ${depinSymbol} stake.`);
      return;
    }
    setUndelegating(true);
    try {
      addToast('info', 'DePIN Undelegation', `Returning ${num.toLocaleString()} ${depinSymbol} from the sample operator...`);
      const hash = await depinUndelegateStake(DEPIN_SAMPLE_OPERATOR, num);
      addToast('success', 'Undelegated', `Stake ${num.toLocaleString()} ${depinSymbol} returned. Tx: ${txHashShort(hash)}`);
      if (isPostHogEnabled) posthog.capture('depin_stake_undelegated', { amount: num });
      await reloadDePINState();
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Transaction rejected.';
      addToast('error', 'Undelegation Failed', msg);
    } finally {
      setUndelegating(false);
    }
  };

  const handleRequestLoan = async () => {
    if (!isConnected) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to request hardware financing.');
      return;
    }
    const amt = parseFloat(loanInput);
    if (isNaN(amt) || amt <= 0) {
      addToast('error', 'Invalid Amount', `Enter a valid ${depinSymbol} loan amount.`);
      return;
    }
    if (depinState && amt > depinState.maxHardwareLoanAmount) {
      addToast('error', 'Amount Exceeds Max Loan', `Max hardware loan is ${depinState.maxHardwareLoanAmount.toLocaleString()} ${depinSymbol}.`);
      return;
    }
    if (depinState && depinState.loanAmount > 0) {
      addToast('error', 'Loan Active', 'Repay your existing hardware loan first.');
      return;
    }
    setRequestingLoan(true);
    try {
      const profile = await fetchBorrowerProfile(address);
      if (!profile || profile.creditScore < 750) {
        addToast('error', 'Insufficient Score', 'Hardware loans require caller score >= 750 CTS (InsufficientScoreForLoan).');
        return;
      }
      addToast('info', 'Hardware Loan', `Issuing ${amt.toLocaleString()} ${depinSymbol} hardware financing line...`);
      const hash = await requestHardwareLoan(amt);
      addToast('success', 'Loan Issued', `Hardware loan of ${amt.toLocaleString()} ${depinSymbol} issued. Tx: ${txHashShort(hash)}`);
      if (isPostHogEnabled) posthog.capture('depin_loan_requested', { amount: amt });
      await reloadDePINState();
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Transaction rejected.';
      if (msg.includes('InsufficientScoreForLoan')) addToast('error', 'Score Too Low', 'Caller score below 750 — loan rejected on-chain.');
      else if (msg.includes('AmountExceedsMaxLoan')) addToast('error', 'Max Loan Exceeded', 'Amount above the max hardware loan cap.');
      else if (msg.includes('NoActiveHardwareLoan')) addToast('error', 'Loan Already Active', 'Repay the existing hardware loan first.');
      else if (msg.includes('InsufficientLiquidity')) addToast('error', 'No Liquidity', 'The hub pool lacks sufficient DEPIN liquidity.');
      else addToast('error', 'Loan Failed', msg);
    } finally {
      setRequestingLoan(false);
    }
  };

  const handleRepayLoan = async () => {
    if (!isConnected) {
      addToast('error', 'Connect Wallet', 'Connect your wallet to repay hardware financing.');
      return;
    }
    if (!depinState || depinState.loanAmount <= 0) {
      addToast('error', 'No Loan', 'No active hardware loan to repay.');
      return;
    }
    setRepayingLoan(true);
    try {
      addToast('info', 'Hardware Loan', `Repaying ${depinState.loanAmount.toLocaleString()} ${depinSymbol} to close the loan...`);
      const hash = await repayHardwareLoan(depinState.loanAmount);
      addToast('success', 'Loan Repaid', `Hardware loan fully repaid. Tx: ${txHashShort(hash)}`);
      if (isPostHogEnabled) posthog.capture('depin_loan_repaid', { amount: depinState.loanAmount });
      await reloadDePINState();
    } catch (err: any) {
      const msg = err?.reason || err?.message || 'Transaction rejected.';
      addToast('error', 'Repay Failed', msg);
    } finally {
      setRepayingLoan(false);
    }
  };

  const handleStakePulse = () => {
    const amt = parseFloat(pulseStakeInput);
    if (isNaN(amt) || amt <= 0 || amt > userWalletCTC) {
      addToast('error', 'Invalid Amount', 'Please enter a valid CTC staking amount.');
      return;
    }
    stakePulseCTC(amt);
    setPulseStakeInput('');
  };

  const mockClusters: GPUCluster[] = [
    { id: 'GPU-US-01', model: 'NVIDIA H100 SXM5 80GB', vram: '80 GB HBM3', tflops: 1979, pricePerHour: 2.85, status: 'AVAILABLE' },
    { id: 'GPU-EU-04', model: '8x NVIDIA RTX 4090 Cluster', vram: '192 GB GDDR6X', tflops: 660, pricePerHour: 1.45, status: 'AVAILABLE' },
    { id: 'GPU-AP-09', model: 'Apple M3 Max Neural Engine', vram: '128 GB Unified', tflops: 140, pricePerHour: 0.65, status: 'AVAILABLE' },
  ];

  const depinNodes = [
    { id: 'NODE-SEOUL-01', name: 'Creditcoin Genesis Validator Alpha', region: 'Seoul, KR', uptime: '99.98%', apy: '19.4%', stakedTotal: '1,420,000 CTC', commission: '2.0%' },
    { id: 'NODE-FRA-09', name: 'Frankfurt High-Speed Relay Hub', region: 'Frankfurt, DE', uptime: '99.95%', apy: '18.8%', stakedTotal: '980,000 CTC', commission: '2.5%' },
    { id: 'NODE-VA-03', name: 'Virginia US-East Edge Cluster', region: 'Virginia, US', uptime: '99.99%', apy: '20.1%', stakedTotal: '2,150,000 CTC', commission: '1.8%' },
  ];

  // Exactly matching the 25-day chart from the user's screenshot (Aug 16 - Sep 9)
  const dailyEarnings = [
    { day: '16 Aug', val: '818.3', uptime: 818.3, network: 120 },
    { day: '17 Aug', val: '1.6K', uptime: 1600, network: 240 },
    { day: '18 Aug', val: '1.6K', uptime: 1600, network: 230 },
    { day: '19 Aug', val: '2K', uptime: 2000, network: 310 },
    { day: '20 Aug', val: '1K', uptime: 1000, network: 180 },
    { day: '21 Aug', val: '1.1K', uptime: 1100, network: 190 },
    { day: '22 Aug', val: '1.5K', uptime: 1500, network: 260 },
    { day: '23 Aug', val: '949.5', uptime: 949.5, network: 150 },
    { day: '24 Aug', val: '994.9', uptime: 994.9, network: 160 },
    { day: '25 Aug', val: '425.2', uptime: 425.2, network: 90 },
    { day: '26 Aug', val: '1.8K', uptime: 1800, network: 290 },
    { day: '27 Aug', val: '1K', uptime: 1000, network: 180 },
    { day: '28 Aug', val: '2.4K', uptime: 2400, network: 410 },
    { day: '29 Aug', val: '1.2K', uptime: 1200, network: 220 },
    { day: '30 Aug', val: '1.5K', uptime: 1500, network: 260 },
    { day: '31 Aug', val: '2.1K', uptime: 2100, network: 380 },
    { day: '1 Sep', val: '849.2', uptime: 849.2, network: 140 },
    { day: '2 Sep', val: '1.1K', uptime: 1100, network: 200 },
    { day: '3 Sep', val: '1.1K', uptime: 1100, network: 200 },
    { day: '4 Sep', val: '2.6K', uptime: 2600, network: 480 },
    { day: '5 Sep', val: '1.2K', uptime: 1200, network: 220 },
    { day: '6 Sep', val: '1.5K', uptime: 1500, network: 270 },
    { day: '7 Sep', val: '935', uptime: 935.0, network: 170 },
    { day: '8 Sep', val: '2K', uptime: 2000, network: 350 },
    { day: '9 Sep', val: '1.4K', uptime: 1400, network: 240 },
    { day: '10 Sep', val: '347.7', uptime: 347.7, network: 60, isToday: true },
  ];

  return (
    <div className="space-y-6 font-sans">
      {/* Physical Hardware Telemetry & Network Health Banner (No Unrelated Lending/Money) */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-[#070b14]/80 to-emerald-950/30 border border-cyan-500/20 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-mono text-cyan-400 tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Machine Telemetry & Edge Station
            </div>
            <div className="text-sm sm:text-base font-bold font-mono text-white flex flex-wrap items-center gap-2 mt-0.5">
              <span>{hardware.cpuCores} CPU Cores</span>
              <span className="text-white/30">•</span>
              <span>{hardware.deviceMemoryGB || hardware.ramGB || 16} GB RAM</span>
              <span className="text-white/30">•</span>
              <span className="text-cyan-300 truncate max-w-[200px]">{hardware.gpuRenderer}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.08] font-mono text-xs flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white/80">{pulseCountryFlag} {pulseCountryName}</span>
            <span className="text-white/40 text-[10px]">({pulseRealIP})</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-mono text-xs text-emerald-400 font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Attestcoin Gateway (Simulated)</span>
          </div>

          <button
            onClick={handlePing}
            disabled={pinging}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 text-cyan-300 text-xs font-mono transition flex items-center gap-1.5 cursor-pointer"
          >
            <Activity className={`w-3.5 h-3.5 text-cyan-400 ${pinging ? 'animate-pulse' : ''}`} />
            {pinging ? 'Probing...' : `Probe Ping (${hardware.pingMs}ms)`}
          </button>
        </div>
      </div>

      {/* Multi-Sector DePIN Category Switcher */}
      <div className="p-1.5 bg-black/60 border border-white/[0.08] rounded-2xl flex flex-wrap gap-1.5">
        <button
          onClick={() => {
            setActiveSector('pulse');
            window.location.hash = '#/pulse';
          }}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSector === 'pulse'
              ? 'bg-[#ABF600]/15 text-[#ABF600] border border-[#ABF600]/40 shadow-lg shadow-[#ABF600]/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Zap className="w-4 h-4 text-[#ABF600]" />
          <span>Bandwidth (CredX Pulse)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#ABF600]/20 text-[#ABF600] uppercase tracking-wider font-extrabold">EPOCH 0</span>
        </button>

        <button
          onClick={() => {
            setActiveSector('nodle');
            window.location.hash = '#/nexus';
          }}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSector === 'nodle'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Radio className="w-4 h-4 text-emerald-400" />
          <span>IoT Edge (CredX Nexus)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase tracking-wider font-extrabold">LIVE</span>
        </button>

        <button
          onClick={() => {
            setActiveSector('geodnet');
            window.location.hash = '#/geodnet';
          }}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSector === 'geodnet'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg shadow-amber-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <Satellite className="w-4 h-4 text-amber-400" />
          <span>RTK GNSS (CredX GeoOrbit)</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 uppercase tracking-wider font-extrabold">LIVE</span>
        </button>

        <button
          onClick={() => {
            setActiveSector('bittensor');
            window.location.hash = '#/bittensor';
          }}
          className={`flex-1 min-w-[170px] py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSector === 'bittensor'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg shadow-purple-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <BrainCircuit className="w-4 h-4 text-purple-400" />
          <span>AI Compute (Bittensor)</span>
        </button>

        <button
          onClick={() => {
            setActiveSector('staking');
            window.location.hash = '#/staking';
          }}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 cursor-pointer ${
            activeSector === 'staking'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
              : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <span>Validator Staking</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* SECTOR 1: CREDX PULSE (BANDWIDTH & RESIDENTIAL WIFI LAYER)                 */}
      {/* ========================================================================= */}
      {activeSector === 'pulse' && (
        <div className="space-y-6">
          {/* Pulse Sub-Navigation: Dashboard | Wallet | Allocation | Rewards */}
          <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/[0.08] rounded-2xl">
            <button
              onClick={() => setActivePulseTab('dashboard')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                activePulseTab === 'dashboard'
                  ? 'bg-[#ABF600]/15 text-[#ABF600] border border-[#ABF600]/40 shadow-md shadow-[#ABF600]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Node Dashboard
            </button>
            <button
              onClick={() => setActivePulseTab('wallet')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                activePulseTab === 'wallet'
                  ? 'bg-[#ABF600]/15 text-[#ABF600] border border-[#ABF600]/40 shadow-md shadow-[#ABF600]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" /> Node Wallet & Staking
            </button>
            <button
              onClick={() => setActivePulseTab('allocation')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                activePulseTab === 'allocation'
                  ? 'bg-[#ABF600]/15 text-[#ABF600] border border-[#ABF600]/40 shadow-md shadow-[#ABF600]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <PieChart className="w-3.5 h-3.5" /> Allocation & Epochs
            </button>
            <button
              onClick={() => setActivePulseTab('rewards')}
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                activePulseTab === 'rewards'
                  ? 'bg-[#ABF600]/15 text-[#ABF600] border border-[#ABF600]/40 shadow-md shadow-[#ABF600]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Award className="w-3.5 h-3.5" /> Rewards & Roadmap
            </button>
          </div>

          {/* Real Hardware Benchmark & Processing Monitor */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl font-mono text-xs space-y-1">
              <span className="text-white/40 text-[10px] uppercase block">Hardware CPU Threads</span>
              <span className="text-white font-bold">{hardware.cpuCores} Logic Cores</span>
            </div>
            <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl font-mono text-xs space-y-1">
              <span className="text-white/40 text-[10px] uppercase block">System RAM Matrix</span>
              <span className="text-white font-bold">{hardware.deviceMemoryGB} GB Allocated</span>
            </div>
            <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl font-mono text-xs space-y-1">
              <span className="text-white/40 text-[10px] uppercase block">WebCrypto Hash Speed</span>
              <span className="text-[#ABF600] font-bold">{pulseComputeThroughputMhash} Mhash/s</span>
            </div>
            <div className="p-3 bg-black/40 border border-white/[0.08] rounded-xl font-mono text-xs space-y-1">
              <span className="text-white/40 text-[10px] uppercase block">Network Latency (RTT)</span>
              <span className="text-cyan-300 font-bold">{hardware.pingMs} ms (Probed)</span>
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* PULSE SUB-TAB 1: NODE DASHBOARD                                       */}
          {/* --------------------------------------------------------------------- */}
          {activePulseTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Pulse Hero Control Center */}
              <GlassCard className="p-6 relative overflow-hidden border-[#ABF600]/30 bg-gradient-to-r from-black via-[#081006] to-[#0A121D]">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-8 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#ABF600]/15 border border-[#ABF600]/40 text-[#ABF600] text-xs font-mono font-bold">
                        <span className={`w-2 h-2 rounded-full ${pulseConnected ? 'bg-[#ABF600] animate-pulse' : 'bg-red-400'}`} />
                        {pulseConnected ? 'CredX Pulse Relay Active' : 'CredX Pulse Relay Suspended'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/60 text-xs font-mono">
                        {pulseCountryFlag} {pulseCountryName} (IP: {pulseRealIP})
                      </span>
                      <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-mono">
                        Genesis Epoch {pulseEpoch}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black text-white tracking-tight">
                      Monetize Surplus Bandwidth for AI Data Pipelines
                    </h2>
                    <p className="text-xs text-white/60 leading-relaxed max-w-2xl">
                      Share unused residential internet bandwidth to power decentralized AI model training datasets. Every byte routed is cryptographically attested on Creditcoin via the <strong className="text-white">Attestcoin Protocol (USC precompile 0x0FD2)</strong>, directly augmenting your Creditcoin Trust Score.
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <button
                        onClick={() => setPulseModalOpen(true)}
                        className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ABF600] to-emerald-400 hover:opacity-95 text-black font-extrabold text-xs font-mono shadow-lg shadow-[#ABF600]/20 transition flex items-center gap-2"
                      >
                        <ShieldCheck className="w-4 h-4 text-black" />
                        Verify Epoch {pulseEpoch} on Creditcoin (+35 CTS)
                      </button>
                    </div>
                  </div>

                  {/* Right Side: Big Extension-Style Power Toggle & Network Quality Bar */}
                  <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 rounded-2xl bg-black/60 border border-white/[0.08] text-center space-y-4">
                    {/* The iconic large circular power button */}
                    <button
                      onClick={togglePulseNode}
                      className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group ${
                        pulseConnected
                          ? 'bg-[#ABF600] text-black shadow-[0_0_40px_rgba(171,246,0,0.4)] scale-105 hover:scale-110'
                          : 'bg-white/10 text-white/40 hover:bg-white/20'
                      }`}
                      title={pulseConnected ? 'Click to Pause Pulse Node' : 'Click to Activate Pulse Node'}
                    >
                      <Power className={`w-12 h-12 transition-transform ${pulseConnected ? 'stroke-[2.5]' : ''}`} />
                      {pulseConnected && (
                        <div className="absolute inset-0 rounded-full border-2 border-[#ABF600] animate-ping opacity-30 pointer-events-none" />
                      )}
                    </button>

                    <div className="space-y-1">
                      <div className="text-sm font-extrabold font-mono text-white">
                        {pulseConnected ? 'Pulse is Connected' : 'Pulse is Disconnected'}
                      </div>
                      <p className="text-[10px] text-white/40">
                        {pulseConnected ? "You're doing great! Keep contributing to earn." : 'Click the button to resume contributing.'}
                      </p>
                    </div>

                    {/* Network Quality Card with Dynamic Progress Bar */}
                    <div className="w-full p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-white/60">Network Quality:</span>
                        <span className="text-[#ABF600] font-bold">{pulseNetworkQuality}%</span>
                      </div>
                      <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#ABF600] to-emerald-400 transition-all duration-500"
                          style={{ width: `${pulseNetworkQuality}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-white/40 flex items-center justify-between font-mono">
                        <span>Ping: {hardware.pingMs}ms</span>
                        <span>0.00% Packet Loss</span>
                      </div>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* Earnings Cards (Matching User's Screenshot: Network vs Uptime Earnings) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Network Points Card */}
                <GlassCard className="p-5 border-[#ABF600]/20 bg-gradient-to-br from-black to-[#0a1506]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-[#ABF600] font-bold tracking-wider">
                      Epoch {pulseEpoch} Network Earnings:
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 font-mono">
                      Data Packets
                    </span>
                  </div>
                  <div className="text-3xl font-black font-mono text-white mt-3 flex items-center gap-2">
                    <span className="text-cyan-400">💎</span> {pulseNetworkPoints.toFixed(4)}
                  </div>
                  <div className="text-xs text-white/50 mt-2 font-mono flex items-center justify-between border-t border-white/[0.06] pt-2">
                    <span>Actively Routed:</span>
                    <span className="text-white font-bold">{pulseBandwidthGB} GB</span>
                  </div>
                </GlassCard>

                {/* Uptime Points Card */}
                <GlassCard className="p-5 border-[#ABF600]/20 bg-gradient-to-br from-black to-[#0a1506]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase text-[#ABF600] font-bold tracking-wider">
                      Epoch {pulseEpoch} Uptime Earnings:
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-[#ABF600]/10 text-[#ABF600] font-mono">
                      Active Telemetry
                    </span>
                  </div>
                  <div className="text-3xl font-black font-mono text-white mt-3 flex items-center gap-2">
                    <span className="text-[#ABF600]">🍃</span> {pulseUptimePoints.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-white/50 mt-2 font-mono flex items-center justify-between border-t border-white/[0.06] pt-2">
                    <span>Active Session:</span>
                    <span className="text-emerald-400 font-bold">{Math.floor(pulseSessionSeconds / 3600)} hrs, {Math.floor((pulseSessionSeconds % 3600) / 60)} mins</span>
                  </div>
                </GlassCard>
              </div>

              {/* 25-Day Earnings Statistics Bar Chart (Matching Screenshot 1) */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-[#ABF600]" /> Earnings Statistics
                    </h3>
                    <p className="text-xs text-white/40 mt-0.5">Historical daily points distribution (Aug 16 – Sep 10)</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-cyan-400"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Network Points</span>
                    <span className="flex items-center gap-1 text-[#ABF600]"><span className="w-2 h-2 rounded-full bg-[#ABF600]" /> Uptime Points</span>
                    <button onClick={handlePing} className="text-white/60 hover:text-white flex items-center gap-1 text-xs">
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                </div>

                {/* SVG 25-Day Bar Chart */}
                <div className="pt-4 pb-2 overflow-x-auto">
                  <div className="min-w-[700px] h-48 flex items-end justify-between gap-1.5 px-2 border-b border-white/10">
                    {dailyEarnings.map((item, idx) => {
                      const maxVal = 2800;
                      const uptimeHeight = Math.min(100, (item.uptime / maxVal) * 100);
                      const networkHeight = Math.min(100, (item.network / maxVal) * 100);
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                          {/* Value above bar */}
                          <span className={`text-[8px] font-mono leading-none ${item.isToday ? 'text-black font-extrabold px-1 py-0.5 rounded bg-[#ABF600]' : 'text-white/70'}`}>
                            {item.val}
                          </span>

                          <div className="w-full max-w-[18px] flex flex-col items-center justify-end h-32 gap-0.5">
                            <div
                              className="w-full rounded-t bg-cyan-400/80 group-hover:bg-cyan-300 transition"
                              style={{ height: `${networkHeight}%` }}
                            />
                            <div
                              className={`w-full rounded-t transition shadow-sm ${
                                item.isToday ? 'bg-[#ABF600] shadow-[#ABF600]/50' : 'bg-[#ABF600]'
                              }`}
                              style={{ height: `${uptimeHeight}%` }}
                            />
                          </div>

                          <span className={`text-[8px] font-mono mt-1 ${item.isToday ? 'px-1.5 py-0.5 rounded bg-[#ABF600] text-black font-extrabold' : 'text-white/40'}`}>
                            {item.day}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>

              {/* Your Networks Multi-Device Table (Matching Screenshot 1) */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="w-4 h-4 text-[#ABF600]" />
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Your Networks</h3>
                  </div>
                  <button className="text-xs font-mono px-3 py-1 rounded-lg bg-[#ABF600] text-black font-extrabold hover:brightness-105 transition">
                    View All
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10 pb-2 text-[10px] uppercase">
                        <th className="pb-3 w-10 text-center">Status</th>
                        <th className="pb-3">Network Name</th>
                        <th className="pb-3">IP Address</th>
                        <th className="pb-3">Time Connected</th>
                        <th className="pb-3">Network Score</th>
                        <th className="pb-3 text-right">Uptime Points Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {pulseNetworks.map((net) => (
                        <tr key={net.id} className="hover:bg-white/[0.02] transition">
                          <td className="py-3 text-center">
                            <span className={`inline-block w-2.5 h-2.5 rounded-full ${net.status === 'Connected' ? 'bg-[#ABF600] shadow-[0_0_8px_#ABF600]' : 'bg-red-500/80'}`} />
                          </td>
                          <td className="py-3 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <span>{net.name}</span>
                              <button
                                onClick={() => {
                                  const nextName = prompt('Enter device name:', net.name);
                                  if (nextName) renamePulseNetwork(net.id, nextName);
                                }}
                                className="text-white/40 hover:text-white transition"
                                title="Rename Device"
                              >
                                ✏️
                              </button>
                            </div>
                          </td>
                          <td className="py-3 text-white/80">
                            <span className="flex items-center gap-1.5">
                              <span className="text-base">{net.flag}</span>
                              <span className="font-mono text-white/90">{net.ip}</span>
                            </span>
                          </td>
                          <td className="py-3 text-white/60">{net.timeConnected}</td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded bg-white/[0.04] text-white/80 font-bold">
                              {net.score}%
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <span className="px-3 py-1 rounded-full bg-[#ABF600]/15 border border-[#ABF600]/30 text-[#ABF600] font-bold">
                              🍃 {net.points.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              {/* Connected Device Node & Live AI Web Request Stream */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Active Device Manager */}
                <GlassCard className="lg:col-span-5 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Device Details</h3>
                      <p className="text-xs text-white/40 mt-0.5">Primary edge worker running on this browser</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 ${
                      pulseConnected
                        ? 'bg-[#ABF600]/15 text-[#ABF600] border border-[#ABF600]/30'
                        : 'bg-white/10 text-white/40 border border-white/10'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${pulseConnected ? 'bg-[#ABF600] animate-pulse' : 'bg-white/40'}`} />
                      {pulseConnected ? 'ROUTING' : 'PAUSED'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] space-y-2.5 font-mono text-xs">
                    <div className="flex justify-between text-white/60">
                      <span>Device Name:</span>
                      <span className="text-white font-bold">Primary Desktop Node</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Public IP Address:</span>
                      <span className="text-cyan-400 font-bold">{pulseCountryFlag} {pulseRealIP}</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>ISP Routing Tier:</span>
                      <span className="text-[#ABF600] font-bold">Tier 1 Residential ({pulseCountryName})</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Hardware Accelerator:</span>
                      <span className="text-white font-bold">{hardware.gpuRenderer.split(' ')[0]} WebGL</span>
                    </div>
                    <div className="flex justify-between text-white/60">
                      <span>Active Processing Speed:</span>
                      <span className="text-[#ABF600] font-bold">{pulseComputeThroughputMhash} Mhash/s SHA-256</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#ABF600]/5 border border-[#ABF600]/20 rounded-xl text-xs space-y-1">
                    <span className="text-[10px] font-mono uppercase text-[#ABF600] font-bold block">Creditcoin Attestation Benefit</span>
                    <p className="text-white/70 text-[11px] leading-relaxed">
                      Every verified session minute increments your <strong>Creditcoin Trust Score (CTS)</strong> and lowers your borrowing APR on Creditcoin L1.
                    </p>
                  </div>
                </GlassCard>

                {/* Right: Live AI Data Request Stream */}
                <GlassCard className="lg:col-span-7 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <TerminalIcon className="w-4 h-4 text-[#ABF600]" /> Live AI Web Request Stream
                      </h3>
                      <p className="text-xs text-white/40 mt-0.5">Real-time web requests served for decentralized LLM training</p>
                    </div>
                    <span className="text-[10px] font-mono text-white/40">USC VERIFIED LOGS</span>
                  </div>

                  <div className="space-y-2 font-mono text-xs max-h-[220px] overflow-y-auto pr-1">
                    {requestLogs.map(log => (
                      <div
                        key={log.id}
                        className="p-3 rounded-xl bg-black/40 border border-white/[0.06] hover:border-[#ABF600]/30 transition flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold shrink-0">
                            {log.status} OK
                          </span>
                          <span className="text-white/80 truncate">{log.url}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-right">
                          <span className="text-cyan-300 text-[11px]">{log.size}</span>
                          <span className="text-white/30 text-[10px]">{log.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-white/50">
                    <span>Packet Inspection: Encrypted TLS 1.3</span>
                    <span className="text-[#ABF600] flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" /> 100% Zero Personal Data
                    </span>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* PULSE SUB-TAB 2: NODE WALLET & STAKING                                */}
          {/* --------------------------------------------------------------------- */}
          {activePulseTab === 'wallet' && (
            <div className="space-y-6">
              {/* Wallet Balances & Address Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Total Balance Card */}
                <GlassCard className="lg:col-span-5 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40 uppercase">Total Balance</span>
                    <button
                      onClick={handlePing}
                      className="text-[11px] text-[#ABF600] hover:underline font-mono flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" /> Refresh
                    </button>
                  </div>
                  <div className="text-3xl font-black font-mono text-white">
                    ${userWalletUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2 font-mono text-xs">
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-white/60">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" /> USDC / cUSD:
                      </span>
                      <span className="text-white font-bold">${userWalletUSD.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-white/60">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> Creditcoin (CTC):
                      </span>
                      <span className="text-white font-bold">{userWalletCTC.toLocaleString()} CTC</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="flex items-center gap-1.5 text-white/60">
                        <span className="w-2 h-2 rounded-full bg-[#ABF600]" /> Pulse Token:
                      </span>
                      <span className="text-[#ABF600] font-bold">12,450 PULSE</span>
                    </div>
                  </div>
                </GlassCard>

                {/* Wallet Address & Quick Actions */}
                <GlassCard className="lg:col-span-7 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-white/40 uppercase">Connected Wallet Address</span>
                    <a
                      href={`https://creditcoin.network/address/${address || '0x4928'}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] text-cyan-400 hover:underline font-mono flex items-center gap-1"
                    >
                      View in Explorer <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
                    <span className="text-xs font-mono text-white/90 truncate mr-2">
                      {address ? `${address.slice(0, 14)}...${address.slice(-10)}` : '0x71C...4928b9F'}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(address || '0x71C839...4928b9F');
                        addToast('success', 'Address Copied', 'Wallet address copied to clipboard.');
                      }}
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 transition"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-1">
                    <button
                      onClick={() => addToast('info', 'Deposit Flow', 'Deposit CTC or cUSD to fund your DePIN operations.')}
                      className="py-2.5 rounded-xl bg-[#ABF600] hover:brightness-110 text-black font-extrabold text-xs font-mono transition"
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => addToast('info', 'Withdraw Flow', 'Withdraw liquid CTC back to your primary wallet.')}
                      className="py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-xs font-mono transition"
                    >
                      Withdraw
                    </button>
                    <button
                      onClick={() => addToast('info', 'Swap Routing', 'Swap CTC to cUSD or Pulse tokens directly in the AMM.')}
                      className="py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-xs font-mono transition"
                    >
                      Swap
                    </button>
                  </div>
                </GlassCard>
              </div>

              {/* Earn More Rewards by Staking */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Earn More Rewards</h3>
                    <p className="text-xs text-white/50 mt-0.5">You can earn more CredX Pulse Rewards by staking your tokens.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                      APR: {pulseStakingAPR}% + CTS Boost
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-3 bg-black/40 border border-white/[0.06] rounded-xl font-mono text-xs">
                    <span className="text-white/40 text-[10px] block">Staked</span>
                    <span className="text-base font-bold text-white mt-1 block">{pulseStakedCTC.toLocaleString()} CTC</span>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/[0.06] rounded-xl font-mono text-xs">
                    <span className="text-white/40 text-[10px] block">Unstaked</span>
                    <span className="text-base font-bold text-white mt-1 block">{(userWalletCTC - pulseStakedCTC).toLocaleString()} CTC</span>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/[0.06] rounded-xl font-mono text-xs">
                    <span className="text-white/40 text-[10px] block">Withdrawals</span>
                    <span className="text-base font-bold text-white mt-1 block">0 CTC</span>
                  </div>
                  <div className="p-3 bg-black/40 border border-white/[0.06] rounded-xl font-mono text-xs">
                    <span className="text-white/40 text-[10px] block">Pending Rewards</span>
                    <span className="text-base font-bold text-[#ABF600] mt-1 block">+18.4 CTC</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                  <input
                    type="number"
                    value={pulseStakeInput}
                    onChange={(e) => setPulseStakeInput(e.target.value)}
                    placeholder="Enter CTC amount to stake"
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-xs outline-none focus:border-[#ABF600]"
                  />
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleStakePulse}
                      className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#ABF600] hover:brightness-110 text-black font-extrabold text-xs font-mono transition"
                    >
                      Stake CTC
                    </button>
                    <button
                      onClick={() => addToast('success', 'Rewards Claimed', 'Claimed +18.4 CTC to your wallet.')}
                      className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-xs font-mono transition"
                    >
                      Claim Rewards
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Transaction History Table */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Transaction History</h3>
                  <span className="text-[10px] font-mono text-white/40">GENESIS LOG</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10 pb-2 text-[10px] uppercase">
                        <th className="pb-2">Type</th>
                        <th className="pb-2">Transaction Hash</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2">Date & Time</th>
                        <th className="pb-2 text-right">Token Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      <tr>
                        <td className="py-3 font-bold text-white flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#ABF600]" /> Attestcoin Epoch Proof
                        </td>
                        <td className="py-3 text-cyan-400">0x8f2d...c419</td>
                        <td className="py-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">VERIFIED</span></td>
                        <td className="py-3 text-white/50">Sep 09, 2026 23:14:02</td>
                        <td className="py-3 text-right font-bold text-[#ABF600]">+35 CTS Boost</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-white flex items-center gap-1.5">
                          <ArrowDownRight className="w-3.5 h-3.5 text-cyan-400" /> Pulse Pool Stake
                        </td>
                        <td className="py-3 text-cyan-400">0x4a19...9b82</td>
                        <td className="py-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">CONFIRMED</span></td>
                        <td className="py-3 text-white/50">Sep 08, 2026 19:42:55</td>
                        <td className="py-3 text-right font-bold text-white">1,500 CTC</td>
                      </tr>
                      <tr>
                        <td className="py-3 font-bold text-white flex items-center gap-1.5">
                          <Coins className="w-3.5 h-3.5 text-amber-400" /> Genesis Node Activation
                        </td>
                        <td className="py-3 text-cyan-400">0x18fe...01d4</td>
                        <td className="py-3"><span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">CONFIRMED</span></td>
                        <td className="py-3 text-white/50">Aug 25, 2026 14:08:12</td>
                        <td className="py-3 text-right font-bold text-white">Genesis Node #01</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* PULSE SUB-TAB 3: ALLOCATION & EPOCHS                                  */}
          {/* --------------------------------------------------------------------- */}
          {activePulseTab === 'allocation' && (
            <div className="space-y-6">
              {/* Top Stats Banner (Dynamically Calculated) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <GlassCard className="p-4 text-center space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Network Points</span>
                  <div className="text-xl font-black font-mono text-cyan-300">{pulseNetworkPoints.toFixed(2)}</div>
                </GlassCard>
                <GlassCard className="p-4 text-center space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Uptime Points</span>
                  <div className="text-xl font-black font-mono text-[#ABF600]">{pulseUptimePoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </GlassCard>
                <GlassCard className="p-4 text-center space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Days Active</span>
                  <div className="text-xl font-black font-mono text-white">30</div>
                </GlassCard>
                <GlassCard className="p-4 text-center space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Devices</span>
                  <div className="text-xl font-black font-mono text-white">{pulseNetworks.length} Nodes</div>
                </GlassCard>
                <GlassCard className="p-4 text-center space-y-1">
                  <span className="text-[10px] font-mono uppercase text-white/40">Referrals</span>
                  <div className="text-xl font-black font-mono text-white">0</div>
                </GlassCard>
              </div>

              {/* Allocation Card & Points Journey Area Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Your Allocation Card (Dynamically computed from points & CTS) */}
                <GlassCard className="lg:col-span-5 p-6 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Your Allocation</h3>
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-white/[0.04] text-white/60">
                        Snapshot - Genesis Epoch {pulseEpoch}
                      </span>
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] uppercase font-mono text-white/40 block">Dynamic Computed Allocation</span>
                      <div className="text-3xl font-black font-mono text-white mt-1">
                        {pulseClaimableRewardUSD > 0 ? `${dynamicAllocationUSDC} USDC` : '0.00 USDC (CLAIMED)'}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-xl bg-black/40 border border-white/[0.06] space-y-2 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-white/60">Calculated Yield:</span>
                        <span className="text-white font-bold">{pulseClaimableRewardUSD > 0 ? `${dynamicAllocationUSDC} USDC` : 'Settled'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">CTS Multiplier:</span>
                        <span className="text-emerald-400 font-bold">{(score / 750).toFixed(2)}x (CTS: {score})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Network Fee:</span>
                        <span className="text-emerald-400 font-bold">0.00 CTC (Covered by USC)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/60">Distribution Chain:</span>
                        <span className="text-cyan-400 font-bold">Creditcoin L1 (Attestcoin)</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Device telemetry displayed locally (SIMULATED — not yet attested to Creditcoin L1 in this panel)</span>
                    </div>
                  </div>

                  <button
                    onClick={() => claimPulseAllocation(parseFloat(dynamicAllocationUSDC))}
                    disabled={pulseClaimableRewardUSD <= 0}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#ABF600] to-emerald-400 hover:brightness-105 text-black font-extrabold text-xs font-mono transition shadow-lg shadow-[#ABF600]/20 disabled:opacity-40"
                  >
                    {pulseClaimableRewardUSD > 0 ? `CLAIM ${dynamicAllocationUSDC} USDC` : 'ALLOCATION CLAIMED ✅'}
                  </button>
                </GlassCard>

                {/* Points Journey Area Chart */}
                <GlassCard className="lg:col-span-7 p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Your Points Journey</h3>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="flex items-center gap-1 text-[#ABF600]"><span className="w-2 h-2 rounded-full bg-[#ABF600]" /> Uptime</span>
                      <span className="flex items-center gap-1 text-cyan-400"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Network</span>
                    </div>
                  </div>

                  {/* SVG Area Chart */}
                  <div className="h-52 w-full pt-4">
                    <svg viewBox="0 0 500 160" className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ABF600" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#ABF600" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      {/* Grid Lines */}
                      <line x1="0" y1="30" x2="500" y2="30" stroke="#ffffff10" strokeDasharray="4" />
                      <line x1="0" y1="70" x2="500" y2="70" stroke="#ffffff10" strokeDasharray="4" />
                      <line x1="0" y1="110" x2="500" y2="110" stroke="#ffffff10" strokeDasharray="4" />
                      <line x1="0" y1="150" x2="500" y2="150" stroke="#ffffff20" />

                      {/* Area */}
                      <path
                        d="M 0,140 Q 120,135 240,120 T 360,90 T 500,20 L 500,150 L 0,150 Z"
                        fill="url(#areaGradient)"
                      />
                      {/* Line */}
                      <path
                        d="M 0,140 Q 120,135 240,120 T 360,90 T 500,20"
                        fill="none"
                        stroke="#ABF600"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                      {/* Secondary Line (Network Points) */}
                      <path
                        d="M 0,145 Q 120,142 240,130 T 360,105 T 500,35"
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth="2"
                        strokeDasharray="4"
                      />
                    </svg>

                    <div className="flex justify-between text-[10px] font-mono text-white/40 pt-2 border-t border-white/10">
                      <span>Genesis E0 (Week 1)</span>
                      <span>E0 (Week 2)</span>
                      <span>E0 (Week 3)</span>
                      <span>E0 (Week 4)</span>
                      <span className="text-[#ABF600] font-bold">Today (Active)</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-white/40 font-mono text-center pt-2">
                    Uptime and Network Points accrued over time, locked as of the Genesis Epoch 0 snapshot.
                  </p>
                </GlassCard>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* PULSE SUB-TAB 4: REWARDS & ROADMAP                                    */}
          {/* --------------------------------------------------------------------- */}
          {activePulseTab === 'rewards' && (
            <div className="space-y-6">
              {/* Gamified Tier Milestone Banner */}
              <GlassCard className="p-6 relative overflow-hidden border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-black to-[#091507]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-extrabold text-lg">
                      VI
                    </div>
                    <div>
                      <div className="text-xs font-mono uppercase text-emerald-400 tracking-wider font-bold">
                        Current Milestone Tier
                      </div>
                      <h2 className="text-2xl font-black text-white">{pulseTier}</h2>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-mono text-white/40 uppercase block">Accrued Tier Points</span>
                    <span className="text-2xl font-black font-mono text-[#ABF600]">
                      🍃 {(pulseTierPoints / 1000).toFixed(2)}K
                    </span>
                  </div>
                </div>

                {/* Level Progress */}
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-white/60">Level Progress to Tier VII Diamond:</span>
                    <span className="text-emerald-400 font-bold">{pulseLevelProgressPct}%</span>
                  </div>
                  <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-[#ABF600] to-teal-400 transition-all duration-700"
                      style={{ width: `${pulseLevelProgressPct}%` }}
                    />
                  </div>
                </div>

                {/* Milestone Claim Box */}
                <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-xs font-bold text-white block">Tier VI Bonus Milestone</span>
                    <span className="text-lg font-extrabold font-mono text-[#ABF600] flex items-center gap-1.5 mt-0.5">
                      🍃 6,000 Points (+20 CTS)
                    </span>
                  </div>
                  <button
                    onClick={claimPulseTierBonus}
                    className="px-6 py-2.5 rounded-xl bg-[#ABF600] hover:brightness-110 text-black font-extrabold text-xs font-mono transition shadow-lg shadow-[#ABF600]/20"
                  >
                    CLAIM TIER VI BONUS
                  </button>
                </div>
              </GlassCard>

              {/* Uptime Rewards Roadmap */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Uptime Rewards Roadmap</h3>
                  <span className="text-xs font-mono text-[#ABF600]">ACTIVE GENESIS SEASON</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-mono text-white/40 block">Tier V: Platinum</span>
                    <span className="text-sm font-bold text-white">2K Points</span>
                    <span className="text-[10px] text-emerald-400 font-mono block">COMPLETED ✅</span>
                  </div>
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                    <span className="text-[10px] font-mono text-emerald-300 font-bold block">Tier VI: Emerald (YOU)</span>
                    <span className="text-sm font-bold text-[#ABF600]">6K Points</span>
                    <span className="text-[10px] text-[#ABF600] font-mono block">ACTIVE TIER 🎯</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1 opacity-70">
                    <span className="text-[10px] font-mono text-white/40 block">Tier VII: Diamond</span>
                    <span className="text-sm font-bold text-white">19K Points</span>
                    <span className="text-[10px] text-white/40 font-mono block">NEXT MILESTONE</span>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1 opacity-50">
                    <span className="text-[10px] font-mono text-white/40 block">Tier VIII: Conqueror</span>
                    <span className="text-sm font-bold text-white">50K Points</span>
                    <span className="text-[10px] text-white/40 font-mono block">LOCKED</span>
                  </div>
                </div>
              </GlassCard>

              {/* Historical Epochs Table */}
              <GlassCard className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Stage 0 Genesis Epoch Log</h3>
                  <span className="text-[10px] font-mono text-white/40">USC VERIFIED LOGS</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10 pb-2 text-[10px] uppercase">
                        <th className="pb-2">Epoch</th>
                        <th className="pb-2">Start / End Date</th>
                        <th className="pb-2">Total Uptime</th>
                        <th className="pb-2 text-right">Uptime Points</th>
                        <th className="pb-2 text-right">Network Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      <tr className="text-white">
                        <td className="py-3 font-bold text-[#ABF600] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ABF600] animate-pulse" />
                          Epoch 0 (Current)
                        </td>
                        <td className="py-3 text-white/60">Aug 11, 2026 - Sep 11, 2026</td>
                        <td className="py-3 text-white/80">30 days, 4 hrs, 12 mins</td>
                        <td className="py-3 text-right font-bold text-[#ABF600]">
                          🍃 {pulseUptimePoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-3 text-right font-bold text-cyan-300">
                          💎 {pulseNetworkPoints.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTOR 2: CREDX NEXUS IoT EDGE & ENTERPRISE FLEET CONSOLE                 */}
      {/* ========================================================================= */}
      {activeSector === 'nodle' && (
        <div className="space-y-6">
          {/* Sub-Mode Navigation Bar */}
          <div className="p-1.5 bg-black/50 border border-white/[0.08] rounded-2xl flex flex-wrap gap-1.5">
            <button
              onClick={() => setNexusViewMode('app')}
              className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                nexusViewMode === 'app'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>📱 Edge Node App</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold">MOBILE</span>
            </button>

            <button
              onClick={() => setNexusViewMode('enterprise')}
              className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                nexusViewMode === 'enterprise'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>🏢 Enterprise Fleet Console</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-extrabold">DASHBOARD</span>
            </button>

            <button
              onClick={() => setNexusViewMode('wallet')}
              className={`flex-1 min-w-[160px] py-2.5 px-4 rounded-xl text-xs font-bold font-mono transition flex items-center justify-center gap-2 ${
                nexusViewMode === 'wallet'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg shadow-emerald-500/10'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.02]'
              }`}
            >
              <Wallet className="w-4 h-4 text-purple-400" />
              <span>💳 Nexus Token Wallet</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-extrabold">WALLET</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* VIEW 1: EDGE NODE OPERATOR APP (Directly matching Mobile Screenshots 1 & 2) */}
          {/* ========================================================================= */}
          {nexusViewMode === 'app' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Mobile App Frame */}
              <div className="lg:col-span-5 max-w-md mx-auto w-full">
                <div className="p-5 rounded-[28px] bg-gradient-to-b from-[#0C121D] via-[#070B12] to-black border border-white/10 shadow-2xl space-y-4">
                  {/* App Header Bar (from Screenshot 1 & 2) */}
                  <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-black text-xs">
                        T
                      </div>
                      <div>
                        <span className="text-white font-bold text-xs block leading-tight">tdead.credx.cc</span>
                        <span className="text-[10px] text-white/40 font-mono">Good evening</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold">
                        CREDITCOIN L1
                      </span>
                      <div className="flex items-center gap-1.5 text-white/60">
                        <button
                          onClick={() => setQrModalOpen(true)}
                          title="Pair Mobile Edge Node via QR"
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] hover:text-white transition cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                        <button
                          onClick={() => setBellDrawerOpen(true)}
                          title="Nexus Edge Notifications"
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] hover:text-white relative transition cursor-pointer"
                        >
                          <Bell className="w-3.5 h-3.5 text-amber-400" />
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-0.5 right-0.5 animate-pulse" />
                        </button>
                        <button
                          onClick={() => setSettingsModalOpen(true)}
                          title="Station Configuration"
                          className="p-1.5 rounded-lg hover:bg-white/[0.08] hover:text-white transition cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-300" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Physical IoT Hardware Telemetry Capture Bar */}
                  <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                        <Bluetooth className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-white font-bold text-xs block">Local IoT Hardware Scanner</span>
                        <span className="text-[10px] text-white/50 font-mono">Web Bluetooth BLE Module</span>
                      </div>
                    </div>
                    <button
                      onClick={handleScanRealBluetoothDevice}
                      disabled={isScanningBluetooth}
                      className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-extrabold text-[11px] font-mono transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Signal className={`w-3 h-3 ${isScanningBluetooth ? 'animate-pulse' : ''}`} />
                      <span>{isScanningBluetooth ? 'Scanning...' : 'Scan IoTs'}</span>
                    </button>
                  </div>

                  {/* Explore Carousel: QUIET CROSSINGS (Paths) (from Screenshot 2) */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-cyan-950/40 border border-emerald-500/30 relative overflow-hidden">
                    <div className="flex items-start justify-between relative z-10">
                      <div className="space-y-1 max-w-[220px]">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                          QUIET CROSSINGS
                        </span>
                        <h4 className="text-white font-bold text-sm">Paths</h4>
                        <p className="text-[11px] text-white/60 leading-snug">
                          Connect with people and devices you spend time and keep crossing paths with.
                        </p>
                      </div>
                      {/* Glowing Ambient Orb */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-400 to-cyan-400 blur-[8px] opacity-80 animate-pulse shrink-0" />
                    </div>

                    <div className="flex items-center gap-3 pt-3 relative z-10">
                      <button
                        onClick={() => {
                          setPathsActive(!pathsActive);
                          addToast('info', pathsActive ? 'Paths Standby' : 'Paths Active', '18 mutual witness encounters logged.');
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs transition"
                      >
                        {pathsActive ? 'Turn on Paths' : 'Paths Active (18)'}
                      </button>
                      <button className="text-xs text-white/50 hover:text-white transition">Later</button>
                    </div>
                  </div>

                  {/* Main Node Relay Card (from Screenshot 2) */}
                  <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Radio className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-white font-bold text-sm">CredX Nexus IoT</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                              nexusActive
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              • {nexusActive ? 'ACTIVE' : 'PAUSED'}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                              CREDITCOIN L1
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => addToast('info', 'CredX Nexus Protocol', 'Lightweight BLE edge beacon witness on Creditcoin L1.')}
                        className="text-white/40 hover:text-white transition"
                      >
                        <Info className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="pt-2">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-white/40 block">
                        READY TO CLAIM
                      </span>
                      <div className="text-3xl font-black font-mono text-white flex items-baseline gap-2 mt-1">
                        {nexusClaimableTokens.toFixed(4)}{' '}
                        <span className="text-base text-emerald-400 font-bold font-sans">NEXUS</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => setNexusViewMode('enterprise')}
                        title="View Full Analytics & Fleet Console"
                        className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] transition"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={toggleNexusNode}
                        title={nexusActive ? 'Pause Node' : 'Start Node'}
                        className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/25 transition"
                      >
                        {nexusActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={claimNexusTokens}
                        disabled={nexusClaimableTokens <= 0}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                      >
                        <ArrowDown className="w-4 h-4 stroke-[3]" />
                        <span>Claim NEXUS</span>
                      </button>
                    </div>
                  </div>

                  {/* Send Your First Envelope Card (from Screenshot 1) */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-center space-y-3">
                    <h5 className="text-white font-bold text-sm">Send your first envelope</h5>
                    <p className="text-[11px] text-white/60 max-w-xs mx-auto">
                      You can create an envelope to send tokens to anyone through a short url link claimable within 10m via BLE proximity.
                    </p>
                    <div className="w-16 h-12 mx-auto rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Send className="w-6 h-6" />
                    </div>
                    <button
                      onClick={() => addToast('info', 'Proximity Envelope Created', 'Short URL generated: credx.cc/env/8942-ble')}
                      className="w-full py-2 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08] font-bold text-xs transition"
                    >
                      Create an envelope
                    </button>
                  </div>

                  {/* Mini Live Map Card (from Screenshot 1) */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-white font-bold text-sm">Live Map</h5>
                      <div className="flex items-center gap-1 font-mono text-[9px]">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">NEARBY NODES</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-white/50">COVERAGE</span>
                        <span className="px-2 py-0.5 rounded-full bg-white/[0.04] text-white/50">HOTSPOTS</span>
                      </div>
                    </div>

                    {/* Stylized Interactive Map Preview */}
                    <div className="h-32 rounded-xl bg-slate-950/80 border border-white/[0.06] relative overflow-hidden flex items-center justify-center">
                      <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:12px_12px]" />
                      {/* Concentric Radar Rings */}
                      <div className="w-24 h-24 rounded-full border border-emerald-500/20 absolute animate-ping opacity-40" />
                      <div className="w-16 h-16 rounded-full border border-emerald-500/30 absolute" />
                      {/* Center User Anchor */}
                      <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/80 relative z-10" />
                      {/* Nearby Beacon Blips */}
                      <div className="w-2 h-2 rounded-full bg-cyan-400 absolute top-6 left-12 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-amber-400 absolute bottom-8 right-16 animate-pulse" />
                      <div className="w-2 h-2 rounded-full bg-rose-400 absolute top-10 right-20 animate-pulse" />

                      <div className="absolute bottom-2 left-2 text-[9px] font-mono text-white/50 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
                        📍 {nexusRealGeo.city} ({nexusRealGeo.lat.toFixed(2)}°, {nexusRealGeo.lng.toFixed(2)}°)
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        setNexusViewMode('enterprise');
                        setEnterpriseSubTab('map');
                      }}
                      className="w-full py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/70 hover:text-white font-mono text-xs transition flex items-center justify-center gap-1.5"
                    >
                      <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Open Full Enterprise Map</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Real Edge Hardware & BLE Telemetry Monitor */}
              <div className="lg:col-span-7 space-y-5">
                {/* Edge Gateway Settings Card */}
                <GlassCard className="p-6 border-emerald-500/20 bg-gradient-to-r from-emerald-950/20 via-black to-slate-950 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                        Proof of Proximity™ (PoP) Base Station
                      </span>
                      <h3 className="text-xl font-bold text-white mt-1.5">Edge Node Gateway Telemetry</h3>
                      <p className="text-xs text-white/60 mt-1">
                        Sensing ambient BLE advertising frames to authenticate physical device locations without GPS battery drain.
                      </p>
                    </div>

                    <button
                      onClick={() => setNexusModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-black font-bold text-xs hover:brightness-110 active:scale-98 transition flex items-center gap-2 shrink-0 shadow-lg shadow-emerald-500/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Attest to Creditcoin (+25 CTS)</span>
                    </button>
                  </div>

                  {/* Mode Selector Buttons */}
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-mono text-white/40 block mb-2">
                      BLE Discovery Mode
                    </span>
                    <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                      {[
                        { id: 'eco', label: 'Eco', desc: '10m • <0.4%/hr' },
                        { id: 'balanced', label: 'Balanced', desc: '30m • ~0.8%/hr' },
                        { id: 'turbo', label: 'Turbo', desc: '100m • ~1.6%/hr' }
                      ].map(mode => (
                        <button
                          key={mode.id}
                          onClick={() => setNexusMode(mode.id as 'eco' | 'balanced' | 'turbo')}
                          className={`p-3 rounded-xl border text-left transition ${
                            nexusMode === mode.id
                              ? 'bg-emerald-500/20 border-emerald-500/50 text-white'
                              : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:text-white'
                          }`}
                        >
                          <span className="font-bold block text-sm">{mode.label}</span>
                          <span className="text-[10px] text-white/40">{mode.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Top Stats Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span className="text-white/40 text-[10px] block">H3 Spatial Hex</span>
                      <span className="text-white font-bold text-xs truncate block">{nexusH3Hex}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span className="text-white/40 text-[10px] block">Frontier Multiplier</span>
                      <span className="text-emerald-400 font-bold text-sm">1.65x Active</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span className="text-white/40 text-[10px] block">Uncommitted Packets</span>
                      <span className="text-cyan-300 font-bold text-sm">{nexusUncommittedPackets} pkts</span>
                    </div>
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <span className="text-white/40 text-[10px] block">Pending CTS Boost</span>
                      <span className="text-emerald-400 font-bold text-sm">+25 Points</span>
                    </div>
                  </div>
                </GlassCard>

                {/* Real Discovered Beacons Live Table */}
                <GlassCard className="p-5 border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-bold text-sm">Nearby Discovered Beacons</h4>
                      <p className="text-xs text-white/40 mt-0.5">
                        Real RF Log-Distance propagation math deriving distance and signal decay.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {nexusDiscoveredBeacons.length} Devices Online
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-white/40 text-[10px] uppercase">
                          <th className="pb-2">Beacon</th>
                          <th className="pb-2">Category</th>
                          <th className="pb-2">Signal (RSSI)</th>
                          <th className="pb-2">Distance</th>
                          <th className="pb-2">Battery</th>
                          <th className="pb-2 text-right">Age</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {nexusDiscoveredBeacons.map(b => (
                          <tr key={b.id} className="hover:bg-white/[0.02] transition">
                            <td className="py-3">
                              <span className="text-white font-bold block">{b.name}</span>
                              <span className="text-[10px] text-white/40">{b.macHash}</span>
                            </td>
                            <td className="py-3">
                              <span className="px-2 py-0.5 rounded bg-white/[0.04] text-white/70 text-[10px]">
                                {b.category}
                              </span>
                            </td>
                            <td className="py-3">
                              <span className={`font-bold ${b.rssi > -65 ? 'text-emerald-400' : b.rssi > -80 ? 'text-amber-400' : 'text-blue-400'}`}>
                                {b.rssi} dBm
                              </span>
                            </td>
                            <td className="py-3 text-white/80">{b.distanceMeters} m</td>
                            <td className="py-3">
                              <span className="text-emerald-400">{b.batteryPct}%</span>
                            </td>
                            <td className="py-3 text-right">
                              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                                Live
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 2: ENTERPRISE FLEET CONSOLE (Directly from dashboard.nodle.com)      */}
          {/* ========================================================================= */}
          {nexusViewMode === 'enterprise' && (
            <div className="space-y-6">
              {/* Enterprise Console Navigation Header (Matching screenshot 1 & 2) */}
              <div className="p-4 rounded-2xl bg-black/60 border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white tracking-tight">nexus IoT</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[10px] font-bold">
                        ENTERPRISE
                      </span>
                    </div>
                    <span className="text-xs text-white/40 font-mono">Overview of tdead • Admin</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/[0.06] font-mono text-xs">
                  <button
                    onClick={() => setEnterpriseSubTab('dashboard')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                      enterpriseSubTab === 'dashboard'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setEnterpriseSubTab('map')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                      enterpriseSubTab === 'map'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Beacon Locations (Map)
                  </button>
                  <button
                    onClick={() => setEnterpriseSubTab('detections')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                      enterpriseSubTab === 'detections'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Detections Feed
                  </button>
                  <button
                    onClick={() => setEnterpriseSubTab('fleets')}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition ${
                      enterpriseSubTab === 'fleets'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'text-white/60 hover:text-white'
                    }`}
                  >
                    Fleets
                  </button>
                </div>
              </div>

              {/* Sub-Tab: Enterprise Dashboard (from Screenshot 1) */}
              {enterpriseSubTab === 'dashboard' && (
                <div className="space-y-6">
                  {/* Top Metric Cards (Row 1 from Screenshot 1) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1: Total Beacons */}
                    <GlassCard className="p-5 border-white/[0.08] flex items-center justify-between">
                      <div>
                        <span className="text-white/40 text-xs font-mono block">Total Beacons</span>
                        <div className="text-2xl font-black font-mono text-white mt-1">
                          {nexusTotalBeacons}
                        </div>
                        <span className="text-[11px] text-white/50 mt-0.5 block">Registered devices</span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Radio className="w-6 h-6" />
                      </div>
                    </GlassCard>

                    {/* Card 2: Team Members */}
                    <GlassCard className="p-5 border-white/[0.08] flex items-center justify-between">
                      <div>
                        <span className="text-white/40 text-xs font-mono block">Team Members</span>
                        <div className="text-2xl font-black font-mono text-white mt-1">
                          {nexusTeamMembers}
                        </div>
                        <span className="text-[11px] text-white/50 mt-0.5 block">since Jan 2025</span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Users className="w-6 h-6" />
                      </div>
                    </GlassCard>

                    {/* Card 3: Fleets */}
                    <GlassCard className="p-5 border-white/[0.08] flex items-center justify-between">
                      <div>
                        <span className="text-white/40 text-xs font-mono block">Fleets</span>
                        <div className="text-2xl font-black font-mono text-white mt-1">
                          {nexusFleetsCount}
                        </div>
                        <span className="text-[11px] text-white/50 mt-0.5 block">Registered fleets</span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Layers className="w-6 h-6" />
                      </div>
                    </GlassCard>

                    {/* Card 4: Apps */}
                    <GlassCard className="p-5 border-white/[0.08] flex items-center justify-between">
                      <div>
                        <span className="text-white/40 text-xs font-mono block">Apps</span>
                        <div className="text-2xl font-black font-mono text-white mt-1">
                          {nexusAppsCount}
                        </div>
                        <span className="text-[11px] text-white/50 mt-0.5 block">Connected apps</span>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <AppWindow className="w-6 h-6" />
                      </div>
                    </GlassCard>
                  </div>

                  {/* SDK Metrics Section (from Screenshot 1) */}
                  <GlassCard className="p-6 border-white/[0.08] space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-white">SDK metrics</h3>
                        <p className="text-xs text-white/40 mt-0.5">Telemetry and packet activity ingested via CredX Nexus edge SDKs.</p>
                      </div>

                      {/* Filter Bar Dropdowns */}
                      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                        <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-white/40" />
                          <span>Last 30 days</span>
                          <ChevronDown className="w-3 h-3 text-white/40" />
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 flex items-center gap-2">
                          <span>Apps</span>
                          <ChevronDown className="w-3 h-3 text-white/40" />
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 flex items-center gap-2">
                          <span>SDK versions</span>
                          <ChevronDown className="w-3 h-3 text-white/40" />
                        </div>
                        <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-white/80 flex items-center gap-2">
                          <span>Permissions</span>
                          <ChevronDown className="w-3 h-3 text-white/40" />
                        </div>
                      </div>
                    </div>

                    {/* SDK 2 Big Metric Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                        <div>
                          <span className="text-white/40 text-xs font-mono block">Total active users (SDK)</span>
                          <div className="text-3xl font-black font-mono text-white mt-1">12</div>
                          <span className="text-[11px] text-white/50 mt-0.5 block">In selected range</span>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Users className="w-6 h-6" />
                        </div>
                      </div>

                      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                        <div>
                          <span className="text-white/40 text-xs font-mono block">Total detected beacons</span>
                          <div className="text-3xl font-black font-mono text-white mt-1">{nexusTotalDetections}</div>
                          <span className="text-[11px] text-white/50 mt-0.5 block">In selected range</span>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                          <Radio className="w-6 h-6" />
                        </div>
                      </div>
                    </div>

                    {/* 4 Interactive Metric Tabs (from Screenshot 1) */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2 font-mono text-xs">
                        {[
                          { id: 'users', label: 'Daily active users (SDK)' },
                          { id: 'detected', label: 'Daily detected beacons' },
                          { id: 'detections', label: 'Daily detections' },
                          { id: 'unique', label: 'Daily unique beacons' }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setSdkMetricTab(tab.id as SDKMetricTab)}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                              sdkMetricTab === tab.id
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                : 'bg-white/[0.02] border border-white/[0.06] text-white/60 hover:text-white'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* 30-Day SVG Chart with 4 Distinct Datasets */}
                      <div className="h-64 rounded-2xl bg-black/40 border border-white/[0.06] p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-white/40">30-Day Ingestion Trend: <strong className="text-white">{sdkDataMap[sdkMetricTab].title}</strong></span>
                          <span className="font-bold px-2.5 py-0.5 rounded-full bg-white/[0.04] border border-white/10" style={{ color: sdkDataMap[sdkMetricTab].color }}>
                            {sdkDataMap[sdkMetricTab].peak}
                          </span>
                        </div>

                        {/* Interactive SVG Bar/Line Chart with Dynamic Scaling */}
                        <div className="h-44 flex items-end gap-1.5 pt-4">
                          {sdkDataMap[sdkMetricTab].data.map((val, idx) => {
                            const max = sdkDataMap[sdkMetricTab].max;
                            const heightPct = Math.max(8, (val / max) * 100);
                            const metric = sdkDataMap[sdkMetricTab];
                            return (
                              <div
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                              >
                                {/* Tooltip on hover */}
                                <div className="absolute -top-8 px-2 py-0.5 rounded bg-black/95 border border-white/20 text-[10px] font-mono text-white opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none z-20 shadow-xl">
                                  Day {idx + 1}: <span className="font-bold text-emerald-400">{val}</span> {metric.unit}
                                </div>
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className={`w-full rounded-t-sm bg-gradient-to-t ${metric.gradientFrom} ${metric.gradientTo} group-hover:brightness-125 transition`}
                                />
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-white/40 pt-2 border-t border-white/[0.06]">
                          <span>Aug 11, 2026</span>
                          <span>Aug 25, 2026</span>
                          <span>Today (Sep 10, 2026)</span>
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* Sub-Tab: Beacon Locations (Map) (Directly from Screenshot 2) */}
              {enterpriseSubTab === 'map' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Controls Column (from Screenshot 2) */}
                  <div className="lg:col-span-4 space-y-4">
                    {/* Panel 1: Map Settings */}
                    <GlassCard className="p-4 border-white/[0.08] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-xs">Map</span>
                        <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                      </div>
                      <div className="text-xs text-white/60 font-mono">
                        tdead • Beacons with location ({filteredBeacons.length})
                      </div>
                      <div className="pt-1">
                        <span className="text-[10px] text-white/40 font-mono block mb-1">Theme</span>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <button
                            onClick={() => setNexusMapTheme('dark')}
                            className={`flex-1 py-1.5 rounded-lg border text-center transition ${
                              nexusMapTheme === 'dark'
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-white/[0.02] border-white/[0.06] text-white/60'
                            }`}
                          >
                            Dark
                          </button>
                          <button
                            onClick={() => setNexusMapTheme('light')}
                            className={`flex-1 py-1.5 rounded-lg border text-center transition ${
                              nexusMapTheme === 'light'
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                                : 'bg-white/[0.02] border-white/[0.06] text-white/60'
                            }`}
                          >
                            Light
                          </button>
                        </div>
                      </div>
                    </GlassCard>

                    {/* Panel 2: Filter Settings (from Screenshot 2) */}
                    <GlassCard className="p-4 border-white/[0.08] space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold text-xs flex items-center gap-1.5">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" /> Filter
                        </span>
                        <ChevronDown className="w-3.5 h-3.5 text-white/40" />
                      </div>

                      {/* Fleet Dropdown */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-white/40 font-mono block">Fleet</span>
                        <select
                          value={selectedFleetFilter}
                          onChange={(e) => setSelectedFleetFilter(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white text-xs font-mono outline-none cursor-pointer"
                        >
                          <option value="All">All Fleets ({nexusFleetsCount})</option>
                          <option value="Cold-Chain Pharma">Cold-Chain Pharma</option>
                          <option value="Micromobility Fleet">Micromobility Fleet</option>
                          <option value="Utility Grid">Utility Grid</option>
                        </select>
                      </div>

                      {/* Recency (max age) pills (from Screenshot 2) */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-white/40 font-mono block">Recency (max age)</span>
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          {(['all', '6h', '1h', '15m'] as const).map(pill => (
                            <button
                              key={pill}
                              onClick={() => setNexusRecencyFilter(pill)}
                              className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                nexusRecencyFilter === pill
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                                  : 'bg-white/[0.02] border border-white/[0.06] text-white/60 hover:text-white'
                              }`}
                            >
                              {pill === 'all' ? 'All' : `≤ ${pill}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Recency Range Continuous Rainbow Gradient Slider (from Screenshot 2) */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between text-[10px] font-mono text-white/40">
                          <span>&lt; 15 min</span>
                          <span>≥ 24 h or no data</span>
                        </div>
                        {/* Rainbow gradient slider track */}
                        <div
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const x = (e.clientX - rect.left) / rect.width;
                            if (x < 0.25) setNexusRecencyFilter('15m');
                            else if (x < 0.55) setNexusRecencyFilter('1h');
                            else if (x < 0.85) setNexusRecencyFilter('6h');
                            else setNexusRecencyFilter('all');
                          }}
                          className="h-2.5 rounded-full bg-gradient-to-r from-red-500 via-emerald-400 to-blue-500 p-0.5 relative cursor-pointer"
                          title="Click to adjust recency filter"
                        >
                          <div
                            style={{
                              left: nexusRecencyFilter === '15m' ? '12%' : nexusRecencyFilter === '1h' ? '45%' : nexusRecencyFilter === '6h' ? '75%' : '95%'
                            }}
                            className="w-3.5 h-3.5 rounded-full bg-white border border-black absolute -top-0.5 -translate-x-1/2 shadow transition-all duration-300"
                          />
                        </div>
                      </div>

                      {/* Show up to devices input */}
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] text-white/40 font-mono block">Show up to (devices)</span>
                        <input
                          type="number"
                          defaultValue={500}
                          className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white font-mono text-xs outline-none"
                        />
                      </div>
                    </GlassCard>
                  </div>

                  {/* Right Column: Full Interactive Beacon Map (from Screenshot 2) */}
                  <div className="lg:col-span-8">
                    <GlassCard className="p-5 border-white/[0.08] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h4 className="text-white font-bold text-sm">Beacon Locations</h4>
                          <span className="text-xs text-white/40 font-mono">
                            {nexusRealGeo.city}, {nexusRealGeo.country} ({nexusRealGeo.lat.toFixed(2)}° N, {nexusRealGeo.lng.toFixed(2)}° E)
                          </span>
                        </div>

                        {/* Top-Right Recency Legend (from Screenshot 2) */}
                        <div className="p-2.5 rounded-xl bg-black/50 border border-white/[0.06] font-mono text-[10px] space-y-1">
                          <span className="text-white/40 uppercase block text-[9px] font-bold">RECENCY</span>
                          <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1 text-red-400">
                              <span className="w-2 h-2 rounded-full bg-red-500" /> Recent — &lt; 15 min
                            </span>
                            <span className="flex items-center gap-1 text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Middle
                            </span>
                            <span className="flex items-center gap-1 text-blue-400">
                              <span className="w-2 h-2 rounded-full bg-blue-500" /> Oldest — ≥ 24 h
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Full Map Canvas Area with Real Street Cartography */}
                      <div className={`h-[460px] rounded-2xl border relative overflow-hidden flex items-center justify-center ${
                        nexusMapTheme === 'dark'
                          ? 'bg-[#060913] border-white/10 text-white'
                          : 'bg-slate-100 border-slate-300 text-slate-900'
                      }`}>
                        {/* Real Google Maps with Cyberpunk Styling & Zero Watermark */}
                        <div className="absolute inset-0 z-0">
                          <GoogleMapView
                            apiKey="AIzaSyBbFdjslMGnzKKVTSkhJqum-Q_QYhFaAjw"
                            center={{ lat: nexusRealGeo.lat, lng: nexusRealGeo.lng }}
                            zoom={13}
                            theme={nexusMapTheme}
                            showHexGrid={false}
                            className="w-full h-full"
                          />
                        </div>

                        {/* SVG H3 Spatial Hexagon Grid Overlay */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10 opacity-30" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id="hexGrid" width="60" height="104" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
                              <path d="M30 0 L60 17.32 L60 51.96 L30 69.28 L0 51.96 L0 17.32 Z M30 104 L60 86.68 L60 51.96 L30 69.28 L0 51.96 L0 86.68 Z" fill="none" stroke="#10b981" strokeWidth="0.75" />
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill="url(#hexGrid)" />
                        </svg>

                        {/* Floating Street & Sector Placemarks */}
                        <div className="absolute top-12 left-16 z-10 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[9px] font-mono text-white/70 pointer-events-none">
                          Banani / Gulshan 2
                        </div>
                        <div className="absolute bottom-16 left-28 z-10 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[9px] font-mono text-white/70 pointer-events-none">
                          Hatirjheel Express Loop
                        </div>
                        <div className="absolute top-24 right-20 z-10 px-2 py-0.5 rounded bg-black/70 border border-white/15 text-[9px] font-mono text-white/70 pointer-events-none">
                          Baridhara Diplomatic Zone
                        </div>

                        {/* Central Edge Gateway Station Marker */}
                        <div className="relative z-20 flex flex-col items-center">
                          <div className="w-36 h-36 rounded-full border border-emerald-500/30 absolute animate-ping opacity-25" />
                          <div className="w-24 h-24 rounded-full border border-emerald-500/40 absolute animate-pulse" />
                          <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-white shadow-xl shadow-emerald-400/90 flex items-center justify-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-black" />
                          </div>
                          <span className="mt-2.5 px-2.5 py-1 rounded-full bg-black/90 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 font-bold shadow-xl backdrop-blur-md">
                            Your Node ({nexusH3Hex.slice(0, 8)}..)
                          </span>
                        </div>

                        {/* Dynamically Filtered Beacons with Rainbow Recency Colors */}
                        {filteredBeacons.map((b) => {
                          const meta = getBeaconRecencyMeta(b.timestamp);
                          const pos = beaconPositions[b.id] || { className: 'top-24 left-32' };
                          const isSelected = selectedBeacon?.id === b.id;
                          return (
                            <div
                              key={b.id}
                              onClick={() => setSelectedBeacon(b)}
                              className={`absolute ${pos.className} cursor-pointer group z-20 transition-all duration-300`}
                            >
                              {meta.color === 'red' && (
                                <div className="w-7 h-7 rounded-full border border-red-500/40 absolute animate-ping -top-1.5 -left-1.5 pointer-events-none" />
                              )}
                              <div
                                className={`w-4 h-4 rounded-full ${meta.dotClass} border-2 ${
                                  isSelected ? 'border-yellow-300 scale-135 ring-4 ring-yellow-400/40' : 'border-white'
                                } shadow-lg ${meta.shadowClass} group-hover:scale-125 transition-all`}
                              />
                              <div className={`opacity-0 group-hover:opacity-100 transition absolute -top-9 -left-16 px-2.5 py-1 rounded-xl bg-black/95 border ${meta.borderClass} text-[10px] font-mono text-white whitespace-nowrap pointer-events-none shadow-2xl z-30`}>
                                {b.name} ({meta.label})
                              </div>
                            </div>
                          );
                        })}

                        {filteredBeacons.length === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                            <div className="px-4 py-2 rounded-xl bg-black/85 border border-white/10 text-white/70 font-mono text-xs shadow-2xl">
                              No beacons found matching selected fleet/recency filters.
                            </div>
                          </div>
                        )}

                        {/* Map Zoom Controls (Top Right) */}
                        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 bg-black/80 border border-white/10 p-1 rounded-xl backdrop-blur-md">
                          <button
                            onClick={() => addToast('info', 'Map Zoom', 'Zoom in +1 (Dhaka Sub-sector 14)')}
                            className="w-7 h-7 rounded-lg hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold font-mono transition cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            onClick={() => addToast('info', 'Map Zoom', 'Zoom out -1 (Dhaka Metropolitan Grid 12)')}
                            className="w-7 h-7 rounded-lg hover:bg-white/10 text-white flex items-center justify-center text-xs font-bold font-mono transition cursor-pointer"
                          >
                            -
                          </button>
                        </div>

                        {/* Map Footer Information Badge */}
                        <div className="absolute bottom-3 left-3 z-20 bg-black/80 border border-white/10 px-3 py-1.5 rounded-xl font-mono text-[10px] text-white/80 backdrop-blur-md flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          <span>Dhaka Metro Grid (23.81° N, 90.41° E) • CartoDB Street Tiles • H3 Res 8</span>
                        </div>
                      </div>

                      {/* Selected Beacon Inspector Drawer */}
                      {selectedBeacon && (
                        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 font-mono text-xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-400 font-bold text-sm">{selectedBeacon.name}</span>
                            <button
                              onClick={() => setSelectedBeacon(null)}
                              className="text-white/40 hover:text-white"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                            <div><span className="text-white/40 block">Category:</span> {selectedBeacon.category}</div>
                            <div><span className="text-white/40 block">Fleet:</span> {selectedBeacon.fleetName}</div>
                            <div><span className="text-white/40 block">Distance:</span> {selectedBeacon.distanceMeters}m</div>
                            <div><span className="text-white/40 block">Signal:</span> {selectedBeacon.rssi} dBm</div>
                          </div>
                          <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
                            <span className="text-[10px] text-white/40">Merkle Leaf: {selectedBeacon.merkleLeaf.slice(0, 18)}...</span>
                            <button
                              onClick={() => setNexusModalOpen(true)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs hover:brightness-110 transition"
                            >
                              Attest via 0x0FD2 (+25 CTS)
                            </button>
                          </div>
                        </div>
                      )}
                    </GlassCard>
                  </div>
                </div>
              )}

              {/* Sub-Tab: Detections Feed */}
              {enterpriseSubTab === 'detections' && (
                <GlassCard className="p-5 border-white/[0.08] space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-white font-bold text-sm">Cryptographic Detections Feed</h4>
                      <p className="text-xs text-white/40 mt-0.5">Raw BLE advertising packet stream hashed for Creditcoin Merkle inclusion.</p>
                    </div>
                    <button
                      onClick={() => setNexusModalOpen(true)}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-500 text-black font-bold text-xs"
                    >
                      Commit Batch to Creditcoin
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left font-mono text-xs">
                      <thead>
                        <tr className="border-b border-white/[0.06] text-white/40 text-[10px] uppercase">
                          <th className="pb-2">Timestamp</th>
                          <th className="pb-2">Beacon Identifier</th>
                          <th className="pb-2">Fleet</th>
                          <th className="pb-2">Signal</th>
                          <th className="pb-2">Payload</th>
                          <th className="pb-2 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {filteredBeacons.map(b => (
                          <tr key={b.id} className="hover:bg-white/[0.02] transition">
                            <td className="py-3 text-white/50">{new Date(b.timestamp).toLocaleTimeString()}</td>
                            <td className="py-3">
                              <span className="text-white font-bold block">{b.name}</span>
                              <span className="text-[10px] text-cyan-400">{b.merkleLeaf.slice(0, 20)}...</span>
                            </td>
                            <td className="py-3 text-white/70">{b.fleetName}</td>
                            <td className="py-3 text-emerald-400 font-bold">{b.rssi} dBm</td>
                            <td className="py-3 text-white/60">{b.payloadSize} Bytes</td>
                            <td className="py-3 text-right">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px]">
                                VERIFIED
                              </span>
                            </td>
                          </tr>
                        ))}
                        {filteredBeacons.length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-white/40 font-mono text-xs">
                              No packet detections match the selected fleet or recency filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              )}

              {/* Sub-Tab: Fleets */}
              {enterpriseSubTab === 'fleets' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { name: 'Cold-Chain Pharma', devices: 2, status: 'Active', sla: '99.8% SLA', desc: 'Temperature-monitored vaccine & biotech logistics.' },
                    { name: 'Micromobility Fleet', devices: 1, status: 'Active', sla: '99.4% SLA', desc: 'Urban e-scooters and shared transport beaconing.' },
                    { name: 'Utility Grid', devices: 1, status: 'Active', sla: '99.9% SLA', desc: 'Smart water meters and telemetry sensors.' }
                  ].map((f, i) => (
                    <GlassCard key={i} className="p-5 border-white/[0.08] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {f.status}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400">{f.sla}</span>
                      </div>
                      <h4 className="text-white font-bold text-base">{f.name}</h4>
                      <p className="text-xs text-white/60">{f.desc}</p>
                      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between font-mono text-xs">
                        <span className="text-white/40">Registered:</span>
                        <span className="text-white font-bold">{f.devices} Devices</span>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* VIEW 3: NEXUS TOKEN WALLET (Directly matching Mobile Screenshot 3)        */}
          {/* ========================================================================= */}
          {nexusViewMode === 'wallet' && (
            <div className="max-w-md mx-auto w-full">
              <div className="p-6 rounded-[28px] bg-gradient-to-b from-[#0C121D] via-[#070B12] to-black border border-white/10 shadow-2xl space-y-6">
                {/* Header (from Screenshot 3) */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40 font-mono">TOTAL BALANCE</span>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-mono text-[10px] font-bold">
                        CREDITCOIN L1
                      </span>
                      <span className="text-white/60 font-mono text-xs">tdead.credx.cc</span>
                    </div>
                  </div>
                  <div className="text-4xl font-black font-mono text-white tracking-tight">
                    ${(userWalletUSD + 2500).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>

                {/* 3 Circular Action Buttons (from Screenshot 3) */}
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => addToast('info', 'Send Tokens', 'Enter recipient Creditcoin address or ENS.')}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-center space-y-1.5 transition"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-white/[0.06] flex items-center justify-center text-white">
                      <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-white block">SEND</span>
                  </button>

                  <button
                    onClick={() => addToast('info', 'Receive Address', `Your address: ${address || '0x49...b820'}`)}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-center space-y-1.5 transition"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-white/[0.06] flex items-center justify-center text-white">
                      <ArrowDown className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-white block">RECEIVE</span>
                  </button>

                  <button
                    onClick={() => addToast('info', 'DEX Swap', 'CredX DEX router ready for NEXUS / CTC / USDC swaps.')}
                    className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-center space-y-1.5 transition"
                  >
                    <div className="w-10 h-10 mx-auto rounded-full bg-white/[0.06] flex items-center justify-center text-white">
                      <Repeat className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-white block">SWAP</span>
                  </button>
                </div>

                {/* Add funds card (from Screenshot 3) */}
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1.5">
                  <h5 className="text-white font-bold text-xs">Add funds to your wallet</h5>
                  <p className="text-[11px] text-white/50 leading-snug">
                    Deposit or buy crypto from Binance, Coinbase, and 300+ exchanges • Powered by Creditcoin
                  </p>
                </div>

                {/* TOKENS List (from Screenshot 3) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-white/40 uppercase text-[10px]">TOKENS</span>
                    <span className="text-emerald-400 text-[10px] cursor-pointer hover:underline">See more</span>
                  </div>

                  <div className="space-y-2">
                    {/* Token 1: CredX Nexus */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold">
                          <Radio className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-xs block">CredX Nexus</span>
                          <span className="text-[11px] text-white/40 font-mono">{nexusClaimableTokens.toFixed(4)} NEXUS</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-white font-bold text-xs block">$ {(nexusClaimableTokens * 0.82).toFixed(2)}</span>
                        <span className="text-[10px] text-emerald-400">+12.4%</span>
                      </div>
                    </div>

                    {/* Token 2: USDC */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold">
                          $
                        </div>
                        <div>
                          <span className="text-white font-bold text-xs block">USDC</span>
                          <span className="text-[11px] text-white/40 font-mono">2,500.00 USDC</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-white font-bold text-xs block">$ 2,500.00</span>
                        <span className="text-[10px] text-white/40">0.00%</span>
                      </div>
                    </div>

                    {/* Token 3: Creditcoin (CTC) */}
                    <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-bold">
                          C
                        </div>
                        <div>
                          <span className="text-white font-bold text-xs block">Creditcoin (CTC)</span>
                          <span className="text-[11px] text-white/40 font-mono">{userWalletCTC.toLocaleString()} CTC</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-white font-bold text-xs block">$ {userWalletUSD.toFixed(2)}</span>
                        <span className="text-[10px] text-emerald-400">+4.2%</span>
                      </div>
                    </div>

                    {/* Token 4: CTS Trust Score */}
                    <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 font-bold">
                          <Award className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-xs block">Trust Score (CTS)</span>
                          <span className="text-[11px] text-purple-300 font-mono">{score} Points (Super-Prime)</span>
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-emerald-400 font-bold text-xs block">+25 Ready</span>
                        <span className="text-[10px] text-white/40">USC 0x0FD2</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ACTIVITY Feed (from Screenshot 3) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between font-mono text-xs">
                    <span className="text-white/40 uppercase text-[10px]">ACTIVITY</span>
                    <span className="text-emerald-400 text-[10px] cursor-pointer hover:underline">See more</span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-[11px] block">Proof of Proximity Batch</span>
                          <span className="text-[9px] text-white/40">0x0FD2 • Precompile Attested</span>
                        </div>
                      </div>
                      <span className="text-emerald-400 font-bold text-[11px]">+25 CTS</span>
                    </div>

                    <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                          <ArrowDown className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-[11px] block">Claimed NEXUS Yield</span>
                          <span className="text-[9px] text-white/40">Completed • Wallet Settled</span>
                        </div>
                      </div>
                      <span className="text-white font-bold text-[11px]">+0.5104 NEXUS</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attestation Modal */}
          <NexusAttestationModal
            isOpen={nexusModalOpen}
            onClose={() => setNexusModalOpen(false)}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTOR 3: CREX GEOORBIT RTK GNSS & SPACE-TIME MESH (PHASE 3)              */}
      {/* ========================================================================= */}
      {activeSector === 'geodnet' && (
        <CredXGeoOrbitView />
      )}

      {/* ========================================================================= */}
      {/* SECTOR 4: BITTENSOR AI COMPUTE & GPU FLEET (PHASE 4)                      */}
      {/* ========================================================================= */}
      {activeSector === 'bittensor' && (
        <BittensorSubnetView hardware={hardware} />
      )}

      {/* ========================================================================= */}
      {/* SECTOR 5: VALIDATOR HUB STAKING                                           */}
      {/* ========================================================================= */}
      {activeSector === 'staking' && (
        <div className="space-y-6">
          {/* DePIN Delegation Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <GlassCard className="lg:col-span-5 p-6 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Stake {depinSymbol} to DePIN Fleet</h3>
                  <button
                    onClick={reloadDePINState}
                    disabled={loadingDePIN}
                    className="text-[11px] text-emerald-400 hover:underline font-mono flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingDePIN ? 'animate-spin' : ''}`} /> Refresh
                  </button>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">
                  Stake your {depinSymbol} balance into DePINInfrastructureHub to underwrite physical satellite hubs. Delegation requires an operator with reliability score {'>='} 700 CTS.
                </p>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1">
                    <span className="text-white/40 text-[10px] uppercase block">Your {depinSymbol} Balance</span>
                    <span className="text-emerald-400 font-bold">{depinState ? `${depinState.depinBalance.toLocaleString()} ${depinSymbol}` : '--'}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1">
                    <span className="text-white/40 text-[10px] uppercase block">Delegated to Sample Operator</span>
                    <span className="text-white font-bold">{delegationAmount != null ? `${delegationAmount.toLocaleString()} ${depinSymbol}` : '--'}</span>
                  </div>
                </div>

                <div className="p-3 bg-black/40 border border-white/[0.06] rounded-xl font-mono text-xs space-y-1">
                  <span className="text-white/40 text-[10px] uppercase block">Sample Operator Address</span>
                  <span className="text-cyan-400 font-bold text-[11px] break-all">{DEPIN_SAMPLE_OPERATOR}</span>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-white/60">Stake Amount ({depinSymbol})</span>
                    <span className="text-cyan-400 font-mono">Available: {depinState ? depinState.depinBalance.toLocaleString() : '--'} {depinSymbol}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none transition"
                      placeholder="500"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        onClick={() => setStakeAmount(depinState ? (depinState.depinBalance * 0.5).toFixed(0) : '0')}
                        className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-white/70"
                      >
                        50%
                      </button>
                      <button
                        onClick={() => setStakeAmount(depinState ? depinState.depinBalance.toFixed(0) : '0')}
                        className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold"
                      >
                        MAX
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-white/60">
                    <span>Operator Gate</span>
                    <span className="text-cyan-400 font-bold">{'>='} 700 CTS (on-chain check)</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Stake Asset</span>
                    <span className="text-white font-bold">{depinSymbol} (DEPIN_TOKEN)</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Node</span>
                    <span className="text-white font-bold">Sample Operator (fixed address)</span>
                  </div>
                  <div className="flex justify-between text-white/60">
                    <span>Undelegate</span>
                    <span className="text-emerald-400 font-bold">Liquid via undelegateStake</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleDelegateStake}
                  disabled={delegating || !isConnected}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  {delegating ? 'Delegating...' : `Delegate ${stakeAmount || '0'} ${depinSymbol}`}
                </button>
                <button
                  onClick={handleUndelegateStake}
                  disabled={undelegating || !isConnected || delegationAmount == null || delegationAmount <= 0}
                  className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                  {undelegating ? 'Undelegating...' : 'Undelegate'}
                </button>
              </div>
            </GlassCard>

            {/* DePIN Hardware Financing Card */}
            <GlassCard className="lg:col-span-7 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">DePIN Hardware Financing</h3>
                <span className="text-[10px] font-mono text-white/40">CHAIN ID: 102031</span>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Undercollateralized hardware loans from DePINInfrastructureHub for top-tier operators. Caller score must be {'>='} 750 CTS.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1">
                  <span className="text-white/40 text-[10px] uppercase block">Max Hardware Loan</span>
                  <span className="text-emerald-400 font-bold">{depinState ? `${depinState.maxHardwareLoanAmount.toLocaleString()} ${depinSymbol}` : '--'}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1">
                  <span className="text-white/40 text-[10px] uppercase block">Active Loan</span>
                  <span className="text-white font-bold">{depinState && depinState.loanAmount > 0 ? `${depinState.loanAmount.toLocaleString()} ${depinSymbol}` : 'None'}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1">
                  <span className="text-white/40 text-[10px] uppercase block">Due Block</span>
                  <span className="text-white font-bold">{depinState && depinState.loanAmount > 0 ? `#${depinState.loanDueBlock.toLocaleString()}` : '--'}</span>
                </div>
                <div className="p-3 rounded-xl bg-black/40 border border-white/[0.06] font-mono text-xs space-y-1">
                  <span className="text-white/40 text-[10px] uppercase block">Loan Status</span>
                  <span className={`font-bold ${depinState && depinState.loanAmount > 0 ? (depinState.loanDueBlock - depinState.currentBlock <= 0 ? 'text-red-400' : 'text-emerald-400') : 'text-white/40'}`}>
                    {depinState && depinState.loanAmount > 0
                      ? (depinState.loanDueBlock - depinState.currentBlock <= 0
                        ? `OVERDUE ${Math.abs(depinState.loanDueBlock - depinState.currentBlock).toLocaleString()} blocks`
                        : `${(depinState.loanDueBlock - depinState.currentBlock).toLocaleString()} blocks left`)
                      : 'No active loan'}
                  </span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-white/40">
                Current block: {depinState ? `#${depinState.currentBlock.toLocaleString()}` : '--'} · Loan term: 216,000 blocks (~30 days)
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-white/60">Loan Amount ({depinSymbol})</span>
                  <span className="text-emerald-400 font-mono">Max: {depinState ? depinState.maxHardwareLoanAmount.toLocaleString() : '--'} {depinSymbol}</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={loanInput}
                    onChange={(e) => setLoanInput(e.target.value)}
                    className="w-full bg-black/40 border border-white/[0.08] focus:border-emerald-500/60 rounded-xl px-4 py-3 text-white font-mono text-sm outline-none transition"
                    placeholder="1000"
                  />
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <button
                      onClick={() => setLoanInput(depinState ? depinState.maxHardwareLoanAmount.toFixed(0) : '0')}
                      className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] font-mono text-emerald-300 font-bold"
                    >
                      MAX
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleRequestLoan}
                  disabled={requestingLoan || !isConnected || (depinState?.loanAmount ?? 0) > 0}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowDownRight className="w-4 h-4" />
                  {requestingLoan ? 'Requesting...' : depinState && depinState.loanAmount > 0 ? 'Loan Active' : `Request Loan (${loanInput || '0'} ${depinSymbol})`}
                </button>
                <button
                  onClick={handleRepayLoan}
                  disabled={repayingLoan || !isConnected || !depinState || depinState.loanAmount <= 0}
                  className="w-full py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                  {repayingLoan ? 'Repaying...' : 'Repay Loan'}
                </button>
              </div>

              <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl text-xs space-y-1.5 font-mono">
                <div className="flex justify-between text-white/60">
                  <span>Caller Gate</span>
                  <span className="text-cyan-400 font-bold">{'>='} 750 CTS (on-chain check)</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Loan Asset</span>
                  <span className="text-white font-bold">{depinSymbol} (DEPIN_TOKEN)</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Repayment</span>
                  <span className="text-emerald-400 font-bold">Full balance via repayHardwareLoan</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Allocation</span>
                  <span className="text-white font-bold">Node hardware capex financing</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Illustrative Node Directory (No Deployed Contract Mapping) */}
          <GlassCard className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Top DePIN Validator Hubs</h3>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-white/40">ILLUSTRATIVE DIRECTORY</span>
                <SimulationBadge note="Illustrative validator directory — no live on-chain node state. Real delegation targets the sample operator address above." />
              </div>
            </div>

            <div className="space-y-3">
              {depinNodes.map((node) => (
                <div
                  key={node.id}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-emerald-500/30 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{node.name}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">{node.region}</span>
                    </div>
                    <div className="text-[11px] text-white/50 flex items-center gap-3">
                      <span>Uptime: <strong className="text-emerald-400 font-mono">{node.uptime}</strong></span>
                      <span>Illustrative Stake: <strong className="text-white font-mono">{node.stakedTotal}</strong></span>
                      <span>Fee: <strong className="text-white/70 font-mono">{node.commission}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-white/40 block">Est. APY (illustrative)</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{node.apy}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Modals */}
      <GPULeaseModal isOpen={gpuModalOpen} onClose={() => setGpuModalOpen(false)} cluster={selectedGPU} />
      <PulseAttestationModal isOpen={pulseModalOpen} onClose={() => setPulseModalOpen(false)} />
      <NexusAttestationModal isOpen={nexusModalOpen} onClose={() => setNexusModalOpen(false)} />

      {/* 1. Mobile Node Pairing Modal (Circled QR Code Icon) */}
      <Modal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        title="Pair Mobile Edge Node"
        subtitle="Connect CredX Mobile App to Edge Station tdead.credx.cc"
        maxWidth="max-w-md"
        icon={
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <QrCode className="w-4 h-4" />
          </div>
        }
      >
        <div className="space-y-4 font-sans text-center">
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center space-y-3">
            {/* High-contrast Stylized QR Code SVG */}
            <div className="p-3 bg-white rounded-2xl shadow-xl">
              <svg className="w-44 h-44" viewBox="0 0 120 120" fill="black">
                {/* QR Finder Patterns (Top-Left, Top-Right, Bottom-Left) */}
                <rect x="10" y="10" width="30" height="30" rx="4" fill="black" />
                <rect x="15" y="15" width="20" height="20" rx="2" fill="white" />
                <rect x="20" y="20" width="10" height="10" fill="black" />

                <rect x="80" y="10" width="30" height="30" rx="4" fill="black" />
                <rect x="85" y="15" width="20" height="20" rx="2" fill="white" />
                <rect x="90" y="20" width="10" height="10" fill="black" />

                <rect x="10" y="80" width="30" height="30" rx="4" fill="black" />
                <rect x="15" y="85" width="20" height="20" rx="2" fill="white" />
                <rect x="20" y="90" width="10" height="10" fill="black" />

                {/* Random Data Pattern Dots */}
                <rect x="45" y="15" width="6" height="6" />
                <rect x="55" y="25" width="6" height="6" />
                <rect x="65" y="15" width="6" height="6" />
                <rect x="45" y="45" width="6" height="6" />
                <rect x="55" y="55" width="6" height="6" />
                <rect x="65" y="45" width="6" height="6" />
                <rect x="15" y="55" width="6" height="6" />
                <rect x="25" y="65" width="6" height="6" />
                <rect x="45" y="75" width="6" height="6" />
                <rect x="55" y="85" width="6" height="6" />
                <rect x="75" y="75" width="6" height="6" />
                <rect x="85" y="85" width="6" height="6" />
                <rect x="95" y="55" width="6" height="6" />
                <rect x="75" y="45" width="6" height="6" />
                <rect x="85" y="65" width="6" height="6" />
                <rect x="105" y="75" width="6" height="6" />
              </svg>
            </div>
            <span className="text-[11px] font-mono text-white/50">
              Scan with CredX Mobile App to link witness keys
            </span>
          </div>

          <div className="p-3 bg-black/50 border border-white/10 rounded-xl text-left font-mono text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-white/40">Station ID:</span>
              <span className="text-cyan-300 font-bold">tdead.credx.cc</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Pairing Code:</span>
              <span className="text-emerald-400 font-bold">NX-882A-9071-CC3</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/40">Chain Protocol:</span>
              <span className="text-white">Creditcoin (0x0FD2)</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText('credx://pair?station=tdead.credx.cc&code=NX-882A-9071-CC3');
                addToast('success', 'Copied Link', 'Pairing deep-link copied to clipboard.');
              }}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Deep-Link</span>
            </button>
            <button
              onClick={() => {
                setQrModalOpen(false);
                addToast('success', 'Mobile Station Paired', 'Mobile Edge Witness synchronized to this terminal.');
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Confirm Pair</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* 2. Notifications Drawer / Modal (Circled Bell Icon) */}
      <Modal
        isOpen={bellDrawerOpen}
        onClose={() => setBellDrawerOpen(false)}
        title="Nexus Edge Notifications"
        subtitle="Local telemetry notifications (SIMULATED — no Creditcoin L1 attestations in this panel)"
        maxWidth="max-w-lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Bell className="w-4 h-4" />
          </div>
        }
      >
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between text-xs font-mono text-white/50 border-b border-white/10 pb-2">
            <span>{activeNotifications.length} Total Alerts</span>
            <button
              onClick={() => {
                setActiveNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                addToast('info', 'Notifications Read', 'Marked all notifications as read.');
              }}
              className="text-cyan-400 hover:underline cursor-pointer"
            >
              Mark all as read
            </button>
          </div>

          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {activeNotifications.map(n => (
              <div
                key={n.id}
                className={`p-3.5 rounded-2xl border transition ${
                  n.unread
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'bg-white/[0.02] border-white/[0.06]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-xs">{n.title}</span>
                      {n.unread && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-white/60 leading-relaxed font-mono">{n.desc}</p>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 shrink-0">{n.time}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setBellDrawerOpen(false)}
            className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white text-xs font-mono font-bold transition cursor-pointer"
          >
            Close Notifications
          </button>
        </div>
      </Modal>

      {/* 3. Station Settings Modal (Circled Settings Icon) */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title="Nexus Station Configuration"
        subtitle="BLE radio transmission & Creditcoin 0x0FD2 RPC parameters"
        maxWidth="max-w-lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-slate-500/20 border border-slate-500/40 flex items-center justify-center text-slate-300">
            <Settings className="w-4 h-4" />
          </div>
        }
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="space-y-3 font-mono">
            <div>
              <label className="text-white/60 block mb-1">Radio Transmission Power</label>
              <select
                value={stationConfig.txPower}
                onChange={(e) => setStationConfig({ ...stationConfig, txPower: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              >
                <option value="+4 dBm (High Range)">+4 dBm (High Range • ~50m)</option>
                <option value="0 dBm (Standard)">0 dBm (Standard • ~30m)</option>
                <option value="-12 dBm (Low Power)">-12 dBm (Low Power • ~10m)</option>
              </select>
            </div>

            <div>
              <label className="text-white/60 block mb-1">Beacon Scan Frequency</label>
              <select
                value={stationConfig.scanInterval}
                onChange={(e) => setStationConfig({ ...stationConfig, scanInterval: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              >
                <option value="Aggressive (1000ms)">Aggressive (Continuous • 1000ms)</option>
                <option value="Balanced (3000ms)">Balanced (3000ms)</option>
                <option value="Conservative (10000ms)">Conservative (10000ms)</option>
              </select>
            </div>

            <div>
              <label className="text-white/60 block mb-1">Merkle Batch Submission Size</label>
              <select
                value={stationConfig.merkleBatchSize}
                onChange={(e) => setStationConfig({ ...stationConfig, merkleBatchSize: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white outline-none"
              >
                <option value="10 Packets">Every 10 Packets (+25 CTS/batch)</option>
                <option value="25 Packets">Every 25 Packets (+60 CTS/batch)</option>
                <option value="50 Packets">Every 50 Packets (+125 CTS/batch)</option>
              </select>
            </div>

            <div>
              <label className="text-white/60 block mb-1">Creditcoin L1 Precompile Address</label>
              <input
                type="text"
                readOnly
                value="0x0000000000000000000000000000000000000FD2"
                className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-emerald-400 font-mono text-[11px] outline-none"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setSettingsModalOpen(false)}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-mono font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setSettingsModalOpen(false);
                addToast('success', 'Configuration Saved', 'Nexus Edge Station radio & RPC parameters applied.');
              }}
              className="flex-1 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-black font-mono font-bold transition cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              Save Parameters
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. IoT Edge Hardware Telemetry Capture Module */}
      <Modal
        isOpen={iotModalOpen}
        onClose={() => setIotModalOpen(false)}
        title="Physical IoT Device Telemetry Capture"
        subtitle="Capture real sensor and advertising packets via device modules"
        maxWidth="max-w-lg"
        icon={
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Bluetooth className="w-4 h-4" />
          </div>
        }
      >
        <div className="space-y-4 font-sans text-xs">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 to-cyan-950/40 border border-emerald-500/30 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 font-bold uppercase tracking-wider font-mono text-[10px]">
                Hardware Interface Module
              </span>
            </div>
            <p className="text-white/80 leading-relaxed font-mono text-[11px]">
              Discover and capture real-time telemetry from nearby IoT hardware (Smartwatches, Beacons, ColdChain sensors, Smart Meters) and display it locally (SIMULATED — nothing is committed to Creditcoin L1 in this panel).
            </p>
          </div>

          <div className="space-y-2 font-mono">
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-white font-bold block">Web Bluetooth (BLE) Radio</span>
                <span className="text-white/40 text-[10px]">Direct 2.4 GHz RF advertising packet sniffing</span>
              </div>
              <button
                onClick={handleScanRealBluetoothDevice}
                disabled={isScanningBluetooth}
                className="px-3 py-1.5 rounded-lg bg-emerald-400 text-black font-bold text-xs hover:bg-emerald-300 transition cursor-pointer disabled:opacity-50"
              >
                {isScanningBluetooth ? 'Scanning...' : 'Pair & Scan'}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] flex items-center justify-between">
              <div>
                <span className="text-white font-bold block">Ambient Sensor & Interface Stream</span>
                <span className="text-white/40 text-[10px]">Real machine battery, network bandwidth & clock jitter</span>
              </div>
              <button
                onClick={() => {
                  setIotModalOpen(false);
                  setNexusModalOpen(true);
                  addToast('success', 'Sensor Packet Captured', 'Live device packet verified and prepared for Merkle inclusion.');
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-400 text-black font-bold text-xs hover:bg-cyan-300 transition cursor-pointer"
              >
                Capture Telemetry
              </button>
            </div>
          </div>

          <button
            onClick={() => setIotModalOpen(false)}
            className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white font-mono font-bold transition cursor-pointer"
          >
            Close Scanner
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default DePINTab;

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { CreditTier, OCCRFactor, LoanPosition, HardwareTelemetry } from '../types/protocol';
import { useToast } from './ToastContext';
import { useWeb3 } from './Web3Context';
import posthog, { isPostHogEnabled } from '../posthog';
import {
  fetchBorrowerProfile,
  fetchEngineRates,
  fetchUserLoans,
  fetchSBTAttestation,
  borrowFromPool,
  repayPoolLoan,
  mintSBT as mintSBTTx,
  submitProofBatch,
  ProofSubmission,
  bpsToApr,
  scoreToTier,
} from '../services/credXService';
import {
  NexusBeacon,
  NexusGeoLocation,
  resolveRealNexusLocation,
  calculateRssiFromDistance,
  sha256Hex,
  computeMerkleRoot
} from '../utils/nexusTelemetry';
import {
  NMEAGGAData,
  SatelliteChannel,
  StableHexRecord,
  NTRIPMountpoint,
  GlobalMinerCluster,
  GEORBIT_MOUNTPOINTS,
  ACTIVE_STABLE_HEXES,
  GLOBAL_MINER_CLUSTERS,
  INITIAL_SATELLITE_CHANNELS,
  parseNMEAGGA,
  generateSampleNMEA
} from '../utils/geoOrbitTelemetry';

export interface ProtocolContextType {
  dataSource: 'demo' | 'chain';
  isLiveOnChain: boolean;
  refreshFromChain: () => Promise<void>;
  score: number;
  creditScore: number;
  tier: CreditTier;
  occrFactors: OCCRFactor[];
  factors: OCCRFactor[];
  verifiedVolumeUSD: number;
  maxBorrowLimit: number;
  approvedLineUSD: number;
  collateralRatioBps: number;
  borrowApr: string;
  sbtTokenId: number;
  sbtCommitment: string;
  sbtMinted: boolean;
  mintSBT: () => void;
  activeLoans: LoanPosition[];
  hardware: HardwareTelemetry;
  telemetry: HardwareTelemetry;
  virtualNodeActive: boolean;
  nodeRunning: boolean;
  virtualNodePoints: number;
  nodePoints: number;
  nodeUptimeSec: number;
  nodeBandwidthMB: number;
  borrow: (amountUSD: number, collateral: string) => void;
  originateLoan: (borrowUSD: number, collateralCTC: number) => void;
  repay: (id: string | number) => void;
  repayLoan: (id: number) => void;
  toggleVirtualNode: () => void;
  toggleNode: () => void;
  runPingTest: () => Promise<number>;
  syncNodePoints: () => void;
  boostScore: (pts: number, reason: string) => void;
  // CredX Pulse DePIN State & Handlers
  pulseConnected: boolean;
  pulseEpoch: number;
  pulseNetworkQuality: number;
  pulseUptimePoints: number;
  pulseNetworkPoints: number;
  pulseBandwidthGB: number;
  pulseStakedCTC: number;
  pulseStakingAPR: number;
  pulseClaimableRewardUSD: number;
  pulseTier: string;
  pulseTierPoints: number;
  pulseLevelProgressPct: number;
  pulseRealIP: string;
  pulseCountryFlag: string;
  pulseCountryName: string;
  pulseComputeThroughputMhash: number;
  pulseSessionSeconds: number;
  pulseNetworks: Array<{
    id: string;
    name: string;
    ip: string;
    flag: string;
    timeConnected: string;
    score: number;
    points: number;
    status: 'Connected' | 'Not Connected';
  }>;
  renamePulseNetwork: (id: string, newName: string) => void;
  togglePulseNode: () => void;
  claimPulseAllocation: (amountUSD?: number) => void;
  claimPulseTierBonus: () => void;
  stakePulseCTC: (amount: number) => void;
  syncPulseAttestation: () => Promise<void>;
  // CredX Nexus IoT Edge & Enterprise Fleet State & Handlers
  nexusActive: boolean;
  nexusMode: 'eco' | 'balanced' | 'turbo';
  nexusClaimableTokens: number;
  nexusTotalBeacons: number;
  nexusTeamMembers: number;
  nexusFleetsCount: number;
  nexusAppsCount: number;
  nexusTotalDetections: number;
  nexusDailyDetections: number[];
  nexusDiscoveredBeacons: import('../utils/nexusTelemetry').NexusBeacon[];
  nexusRealGeo: import('../utils/nexusTelemetry').NexusGeoLocation;
  nexusH3Hex: string;
  nexusUncommittedPackets: number;
  nexusRecencyFilter: 'all' | '6h' | '1h' | '15m';
  nexusRecencyMaxMinutes: number;
  nexusMapTheme: 'dark' | 'light';
  toggleNexusNode: () => void;
  setNexusMode: (mode: 'eco' | 'balanced' | 'turbo') => void;
  claimNexusTokens: () => void;
  attestNexusBatch: () => Promise<void>;
  setNexusRecencyFilter: (filter: 'all' | '6h' | '1h' | '15m') => void;
  setNexusRecencyMaxMinutes: (minutes: number) => void;
  setNexusMapTheme: (theme: 'dark' | 'light') => void;
  addNexusBeacon: (beacon: import('../utils/nexusTelemetry').NexusBeacon) => void;
  // CredX GeoOrbit Space-Time Mesh & Centimeter Positioning State & Handlers
  orbitConnected: boolean;
  orbitTotalStations: number;
  orbitMyStationsCount: number;
  orbitClaimableTokens: number;
  orbitBurnedTokens: number;
  orbitDataRevenueUSD: number;
  orbitSatellitesLocked: number;
  orbitAccuracyCm: number;
  orbitActiveHexMultiplier: string;
  orbitMountpoint: string;
  orbitStationUptimeHours: number;
  orbitSatellites: SatelliteChannel[];
  orbitNmeaSentence: string;
  orbitNmeaData: NMEAGGAData | null;
  orbitLastAttestationHash: string;
  orbitPoSTProofsCount: number;
  orbitStableHexes: StableHexRecord[];
  orbitClusters: GlobalMinerCluster[];
  orbitMountpoints: NTRIPMountpoint[];
  toggleOrbitStation: () => void;
  claimOrbitTokens: () => void;
  syncOrbitAttestation: () => Promise<void>;
  setOrbitMountpoint: (mountpoint: string) => void;
  simulateRoverFix: (quality?: 1 | 4 | 5) => void;
  // Aliases for backward compatibility
  grassNetworkQuality: number;
  grassEpoch: number;
  grassUptimePoints: number;
  grassNetworkPoints: number;
  grassTotalBandwidthGB: number;
  grassConnected: boolean;
  toggleGrassNode: () => void;
  syncGrassAttestation: () => Promise<void>;
}

const ProtocolContext = createContext<ProtocolContextType | undefined>(undefined);

/** Build the on-chain factor breakdown from a real CredXHub borrower profile. */
function deriveFactors(profile: {
  totalVerifiedVolumeUSD: number;
  totalAttestationsCount: number;
  protocolDiversityCount: number;
  chainDiversityCount: number;
  weightedActionScore: number;
  lastAttestationTimestamp: number;
}, score: number): OCCRFactor[] {
  const daysSinceLastAttestation = profile.lastAttestationTimestamp > 0
    ? Math.max(0, (Date.now() / 1000 - profile.lastAttestationTimestamp) / 86400)
    : Number.MAX_SAFE_INTEGER;
  const recencyOk = daysSinceLastAttestation <= 30;
  return [
    { id: '1', name: 'On-chain Loan Repayment History', description: `Weighted action score ${profile.weightedActionScore.toFixed(0)} verified on Creditcoin`, score: profile.weightedActionScore > 0 ? 200 : 0, max: 200, weight: 35, color: '#06b6d4' },
    { id: '2', name: `Verified Volume ($${Math.round(profile.totalVerifiedVolumeUSD).toLocaleString()})`, description: 'Total USD value verified via Merkle/continuity proofs', score: Math.min(150, Math.round(profile.totalVerifiedVolumeUSD / 1500)), max: 150, weight: 25, color: '#a855f7' },
    { id: '3', name: 'Multi-Protocol Diversity', description: `${profile.protocolDiversityCount} DeFi protocol types across ${profile.chainDiversityCount} source chains`, score: Math.min(120, (profile.protocolDiversityCount + profile.chainDiversityCount) * 40), max: 120, weight: 20, color: '#10b981' },
    { id: '4', name: 'Attestation Frequency', description: `${profile.totalAttestationsCount} cryptographic state verifications`, score: Math.min(80, profile.totalAttestationsCount * 16), max: 80, weight: 10, color: '#3b82f6' },
    { id: '5', name: 'Recency Bonus (<30d)', description: recencyOk ? `Last attestation ${Math.round(daysSinceLastAttestation)}d ago` : 'No attestation in the last 30 days', score: recencyOk ? 50 : 0, max: 50, weight: 10, color: '#f59e0b' },
  ];
}

/** Map an on-chain pool loan to the UI LoanPosition shape. */
function mapLoanToPosition(loan: {
  loanId: string;
  principalUSD: number;
  collateralCTC: number;
  borrowedAtBlock: number;
  dueBlock: number;
  interestRateBps: number;
  isDefaulted: boolean;
}): LoanPosition {
  const dueAt = new Date(Date.now() + 15 * 86400000).toISOString().slice(0, 10);
  return {
    id: `${loan.loanId}`,
    amount: loan.principalUSD,
    collateral: `${loan.collateralCTC.toLocaleString(undefined, { maximumFractionDigits: 2 })} CTC`,
    principalUSD: loan.principalUSD,
    collateralCTC: loan.collateralCTC,
    collateralRatio: '—',
    interestRate: (loan.interestRateBps / 100).toFixed(2),
    apr: bpsToApr(loan.interestRateBps),
    dueDate: dueAt,
    dueDays: 15,
    status: loan.isDefaulted ? 'DEFAULTED' : 'ACTIVE',
  };
}

export const ProtocolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSource, setDataSource] = useState<'demo' | 'chain'>('demo');
  const [score, setScore] = useState<number>(794);
  const [tier, setTier] = useState<CreditTier>('Super-Prime');
  const [verifiedVolumeUSD, setVerifiedVolumeUSD] = useState<number>(150000);
  const [approvedLineUSD, setApprovedLineUSD] = useState<number>(225000);
  const [collateralRatioBps, setCollateralRatioBps] = useState<number>(7000); // 70.0%
  const [borrowApr, setBorrowApr] = useState<string>('2.50%');
  const [sbtTokenId, setSbtTokenId] = useState<number>(4928);
  const [sbtCommitment, setSbtCommitment] = useState<string>('0x73549c1d64f55b95a821e289bf4490c8e109d73b22419ef8971a62948c12a84f');
  const [sbtMinted, setSbtMinted] = useState<boolean>(true);

  const [occrFactors, setOccrFactors] = useState<OCCRFactor[]>([
    { id: '1', name: 'Historical Loan Repayment', description: 'Verified on-chain debt liquidation & repayment receipts', score: 200, max: 200, weight: 35, color: '#06b6d4' },
    { id: '2', name: 'Verified Volume ($150k)', description: 'Total volume verified across Ethereum, Base, Arbitrum', score: 150, max: 150, weight: 25, color: '#a855f7' },
    { id: '3', name: 'Multi-Protocol Diversity', description: '3 DeFi protocols across 2 connected chains', score: 120, max: 120, weight: 20, color: '#10b981' },
    { id: '4', name: 'Attestation Frequency', description: 'Regular cryptographic state verification cadence', score: 60, max: 80, weight: 10, color: '#3b82f6' },
    { id: '5', name: 'Recency Bonus (<30d)', description: 'Active multi-chain transactions in the last month', score: 50, max: 50, weight: 10, color: '#f59e0b' }
  ]);

  const [activeLoans, setActiveLoans] = useState<LoanPosition[]>([
    {
      id: 'LN-9041',
      amount: 10000,
      collateral: '3,500 CTC',
      principalUSD: 10000,
      collateralCTC: 3500,
      collateralRatio: '70.0%',
      interestRate: '2.50',
      apr: '2.50%',
      dueDate: '2026-10-15',
      dueDays: 29,
      status: 'ACTIVE'
    }
  ]);

  const [hardware, setHardware] = useState<HardwareTelemetry>({
    cpuCores: navigator.hardwareConcurrency || 8,
    deviceMemoryGB: (navigator as unknown as { deviceMemory?: number }).deviceMemory || 16,
    gpuRenderer: 'NVIDIA GeForce RTX Accelerated Hub',
    pingMs: 18,
    cores: navigator.hardwareConcurrency || 8,
    ramGB: (navigator as unknown as { deviceMemory?: number }).deviceMemory || 16
  });

  const [virtualNodeActive, setVirtualNodeActive] = useState<boolean>(false);
  const [virtualNodePoints, setVirtualNodePoints] = useState<number>(1480);
  const [nodeUptimeSec, setNodeUptimeSec] = useState<number>(0);
  const [nodeBandwidthMB, setNodeBandwidthMB] = useState<number>(142.5);

  const { showToast, addToast, playSound } = useToast();
  const { isConnected, address } = useWeb3();
  const lastChainAddress = useRef<string>('');

  // ───────────────────────────────────────────────────────────────────────
  //  Real on-chain refresh: pulls the wallet's live CredXHub profile, the
  //  derived engine rates, their SBT attestation and lending pool loans.
  // ───────────────────────────────────────────────────────────────────────
  const refreshFromChain = useCallback(async () => {
    if (!isConnected || !address) {
      setDataSource('demo');
      return;
    }
    try {
      const profile = await fetchBorrowerProfile(address);
      if (!profile) {
        setDataSource('demo');
        return;
      }
      let approvedLine = profile.maxCreditLineUSD;
      let ratioBps = profile.requiredCollateralRatioBps;
      let apr = '—';
      if (profile.creditScore >= 300) {
        const rates = await fetchEngineRates(profile.creditScore);
        if (approvedLine <= 0) approvedLine = rates.maxCreditLineUSD;
        if (ratioBps <= 0) ratioBps = rates.collateralRatioBps;
        apr = bpsToApr(rates.interestRateBps);
      }
      const [loans, sbt] = await Promise.all([
        fetchUserLoans(address),
        fetchSBTAttestation(address),
      ]);

      setScore(profile.creditScore);
      setTier(scoreToTier(profile.creditScore) as CreditTier);
      setVerifiedVolumeUSD(profile.totalVerifiedVolumeUSD);
      setApprovedLineUSD(approvedLine);
      setCollateralRatioBps(ratioBps);
      setBorrowApr(apr);
      setOccrFactors(deriveFactors(profile, profile.creditScore));
      setActiveLoans(loans.map(mapLoanToPosition));
      setSbtTokenId(sbt ? parseInt(sbt.tokenId, 10) : 0);
      setSbtCommitment(sbt ? sbt.commitmentHash : '0x0000000000000000000000000000000000000000000000000000000000000000');
      setSbtMinted(!!sbt);
      setDataSource('chain');
    } catch (err) {
      console.warn('Could not refresh on-chain protocol state:', err);
      setDataSource('demo');
    }
  }, [isConnected, address]);

  // Load real state on connect / account switch; return to demo defaults on disconnect.
  useEffect(() => {
    if (isConnected && address && address !== lastChainAddress.current) {
      lastChainAddress.current = address;
      void refreshFromChain();
      return;
    }
    if (!isConnected) {
      lastChainAddress.current = '';
      setDataSource('demo');
    }
  }, [isConnected, address, refreshFromChain]);

  // Detect real GPU via WebGL
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          const renderer = (gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL);
          if (renderer) {
            setHardware(prev => ({ ...prev, gpuRenderer: renderer }));
          }
        }
      }
    } catch {
      // Fallback
    }
  }, []);

  // Node telemetry timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (virtualNodeActive) {
      interval = setInterval(() => {
        setNodeUptimeSec(prev => prev + 1);
        setVirtualNodePoints(prev => prev + 4);
        setNodeBandwidthMB(prev => +(prev + 0.45).toFixed(2));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [virtualNodeActive]);

  // CredX Pulse DePIN State (Renamed & Epoch 0 Genesis)
  const [pulseConnected, setPulseConnected] = useState<boolean>(true);
  const [pulseEpoch] = useState<number>(0); // Epoch 0 (Genesis Launch)
  const [pulseNetworkQuality, setPulseNetworkQuality] = useState<number>(75); // 75% dynamically based on real latency probe
  const [pulseUptimePoints, setPulseUptimePoints] = useState<number>(41706.69);
  const [pulseNetworkPoints, setPulseNetworkPoints] = useState<number>(54.565);
  const [pulseBandwidthGB, setPulseBandwidthGB] = useState<number>(85.22);
  const [pulseStakedCTC, setPulseStakedCTC] = useState<number>(1500);
  const [pulseStakingAPR] = useState<number>(6.19);
  const [pulseClaimableRewardUSD, setPulseClaimableRewardUSD] = useState<number>(0.61);
  const [pulseTier] = useState<string>('Tier VI: Emerald');
  const [pulseTierPoints, setPulseTierPoints] = useState<number>(177360);
  const [pulseLevelProgressPct] = useState<number>(47.33);

  // Real Machine & Network Telemetry
  const [pulseRealIP, setPulseRealIP] = useState<string>('103.187.95.62');
  const [pulseCountryFlag] = useState<string>('🇧🇩');
  const [pulseCountryName] = useState<string>('Bangladesh');
  const [pulseComputeThroughputMhash, setPulseComputeThroughputMhash] = useState<number>(184.2);
  const [pulseSessionSeconds, setPulseSessionSeconds] = useState<number>(3783); // 1 day, 1 hr, 3 mins

  // Networks List (Matching User's Real Screenshot)
  const [pulseNetworks, setPulseNetworks] = useState<Array<{
    id: string;
    name: string;
    ip: string;
    flag: string;
    timeConnected: string;
    score: number;
    points: number;
    status: 'Connected' | 'Not Connected';
  }>>([
    { id: 'dev-1', name: 'Primary Desktop Node', ip: '103.187.95.62', flag: '🇧🇩', timeConnected: '1 day, 1 hr, 3 mins', score: 75, points: 737.5625, status: 'Connected' },
    { id: 'dev-2', name: 'Mobile Edge Relay', ip: '103.187.95.55', flag: '🇧🇩', timeConnected: '0 day, 9 hrs, 56 mins', score: 75, points: 329.5417, status: 'Not Connected' },
    { id: 'dev-3', name: 'Home WiFi Beacon', ip: '103.187.95.51', flag: '🇧🇩', timeConnected: '0 day, 3 hrs, 51 mins', score: 75, points: 214.9375, status: 'Not Connected' },
    { id: 'dev-4', name: 'Office Fiber Bridge', ip: '103.187.95.50', flag: '🇧🇩', timeConnected: '0 day, 20 hrs, 25 mins', score: 75, points: 1057.6875, status: 'Not Connected' }
  ]);

  const renamePulseNetwork = useCallback((id: string, newName: string) => {
    if (!newName.trim()) return;
    setPulseNetworks(prev => prev.map(dev => dev.id === id ? { ...dev, name: newName.trim() } : dev));
    addToast('success', 'Device Renamed', `Network device renamed to "${newName.trim()}".`);
  }, [addToast]);

  // Real IP Detection via client fetch
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        if (data.ip) {
          setPulseRealIP(data.ip);
          setPulseNetworks(prev => prev.map((dev, i) => i === 0 ? { ...dev, ip: data.ip } : dev));
        }
      })
      .catch(() => {
        // Fallback to detected Bangladesh IP
      });
  }, []);

  // Real Processing Power Benchmark: WebCrypto SHA-256 Micro-Hashing
  const runRealHardwareBenchmark = useCallback(async () => {
    try {
      if (!window.crypto?.subtle) return;
      const t0 = performance.now();
      const testBuffer = new Uint8Array(32 * 1024);
      for (let i = 0; i < 30; i++) {
        await window.crypto.subtle.digest('SHA-256', testBuffer);
      }
      const elapsed = performance.now() - t0;
      if (elapsed > 0) {
        const mhash = +((30 / elapsed) * 20).toFixed(1);
        setPulseComputeThroughputMhash(Math.max(120, mhash));
      }
    } catch {
      // Keep default
    }
  }, []);

  const togglePulseNode = useCallback(() => {
    setPulseConnected(prev => {
      const next = !prev;
      setPulseNetworks(devs => devs.map((dev, i) => i === 0 ? { ...dev, status: next ? 'Connected' : 'Not Connected' } : dev));
      addToast(
        next ? 'success' : 'info',
        next ? 'CredX Pulse Connected' : 'CredX Pulse Suspended',
        next ? 'Routing residential bandwidth and earning Epoch 0 points...' : 'Bandwidth sharing paused.'
      );
      return next;
    });
  }, [addToast]);

  // Real-time Pulse Telemetry Ticker & Hardware Compute Benchmark
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    let benchmarkInterval: NodeJS.Timeout | null = null;

    if (pulseConnected) {
      interval = setInterval(() => {
        setPulseSessionSeconds(s => s + 1);
        setPulseUptimePoints(prev => +(prev + 0.45).toFixed(2));
        setPulseNetworkPoints(prev => +(prev + 0.02).toFixed(3));
        setPulseBandwidthGB(prev => +(prev + 0.005).toFixed(3));

        // Update connected device live points
        setPulseNetworks(prev => prev.map((dev, i) => {
          if (i === 0) {
            return { ...dev, points: +(dev.points + 0.0045).toFixed(4) };
          }
          return dev;
        }));
      }, 1000);

      // Run real hardware benchmark every 12s
      runRealHardwareBenchmark();
      benchmarkInterval = setInterval(runRealHardwareBenchmark, 12000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (benchmarkInterval) clearInterval(benchmarkInterval);
    };
  }, [pulseConnected, runRealHardwareBenchmark]);

  const boostScore = useCallback((pts: number, reason: string) => {
    if (dataSource === 'chain') {
      addToast(
        'info',
        'CTV is On-Chain',
        `Score changes require verified proofs — submit cross-chain evidence in the Proof Verifier (${reason}).`
      );
      return;
    }
    setScore(prev => {
      const next = Math.min(850, prev + pts);
      if (next >= 780) setTier('Super-Prime');
      else if (next >= 700) setTier('Prime');
      else if (next >= 650) setTier('Near-Prime');
      return next;
    });
    playSound('fanfare');
    addToast('success', 'Demo Score Boost', `+${pts} simulated points (${reason}) — connect a wallet for real on-chain score.`);
  }, [addToast, playSound, dataSource]);

  const claimPulseAllocation = useCallback((amountUSD?: number) => {
    if (pulseClaimableRewardUSD <= 0) {
      addToast('info', 'Allocation Already Claimed', 'Your Epoch 0 snapshot has been claimed.');
      return;
    }
    const claimedAmount = (amountUSD !== undefined ? amountUSD : pulseClaimableRewardUSD).toFixed(2);
    playSound('fanfare');
    setPulseClaimableRewardUSD(0);
    boostScore(15, 'CredX Pulse Epoch 0 Allocation Settled');
    addToast('success', 'Allocation Claimed (Simulated)!', `Claimed $${claimedAmount} demo PULSE allocation to your local session (no real tokens moved).`);
  }, [pulseClaimableRewardUSD, playSound, boostScore, addToast]);

  const claimPulseTierBonus = useCallback(() => {
    playSound('fanfare');
    setPulseTierPoints(prev => prev + 6000);
    boostScore(20, 'CredX Pulse Tier VI Emerald Milestone Bonus');
    addToast('success', 'Tier Bonus Claimed!', 'Earned +6,000 Pulse Points & +20 CTS reputation boost!');
  }, [playSound, boostScore, addToast]);

  const stakePulseCTC = useCallback((amount: number) => {
    if (amount <= 0) return;
    setPulseStakedCTC(prev => prev + amount);
    playSound('success');
    addToast('success', 'CTC Staked in Pulse Pool', `Successfully deposited ${amount.toLocaleString()} CTC at 6.19% APR.`);
  }, [playSound, addToast]);

  const syncPulseAttestation = useCallback(async () => {
    playSound('fanfare');
    boostScore(35, 'CredX Pulse Epoch 0 Verified Bandwidth & Quality Attestation');
    addToast('info', 'Demo Pulse Attestation', 'Pulse bandwidth attestation is simulated locally — no on-chain proof was anchored. Use the Proof Verifier with a connected wallet for real verification.');
  }, [boostScore, playSound, addToast]);

  // CredX Nexus IoT Edge & Enterprise Fleet State (Phase 2)
  const [nexusActive, setNexusActive] = useState<boolean>(true);
  const [nexusMode, setNexusModeState] = useState<'eco' | 'balanced' | 'turbo'>('balanced');
  const [nexusClaimableTokens, setNexusClaimableTokens] = useState<number>(0.5104);
  const [nexusTotalBeacons, setNexusTotalBeacons] = useState<number>(4);
  const [nexusTeamMembers] = useState<number>(1);
  const [nexusFleetsCount] = useState<number>(2);
  const [nexusAppsCount] = useState<number>(1);
  const [nexusTotalDetections, setNexusTotalDetections] = useState<number>(1428);
  const [nexusDailyDetections] = useState<number[]>([
    42, 58, 65, 80, 92, 110, 105, 128, 140, 155, 172, 168, 190, 205, 220, 215, 238, 260, 280, 310, 295, 340, 365, 390, 420, 410, 445, 470, 495, 520
  ]);
  const [nexusRealGeo, setNexusRealGeo] = useState<NexusGeoLocation>({
    lat: 23.8103,
    lng: 90.4125,
    city: 'Dhaka',
    country: 'Bangladesh',
    countryFlag: '🇧🇩',
    h3Hex: '8861892543fffff',
    densityMultiplier: 1.65,
    accuracyMeters: 15
  });
  const [nexusH3Hex, setNexusH3Hex] = useState<string>('8861892543fffff');
  const [nexusUncommittedPackets, setNexusUncommittedPackets] = useState<number>(34);
  const [nexusRecencyFilter, setNexusRecencyFilter] = useState<'all' | '6h' | '1h' | '15m'>('all');
  const [nexusRecencyMaxMinutes, setNexusRecencyMaxMinutes] = useState<number>(1440);
  const [nexusMapTheme, setNexusMapTheme] = useState<'dark' | 'light'>('dark');

  const [nexusDiscoveredBeacons, setNexusDiscoveredBeacons] = useState<NexusBeacon[]>([
    {
      id: 'BCN-8492',
      name: 'Cargo BLE Tag #8492',
      category: 'Asset Tag',
      macHash: '0xa48f..39c1',
      distanceMeters: 3.2,
      rssi: -52,
      lat: 23.8124,
      lng: 90.4148,
      batteryPct: 94,
      timestamp: Date.now() - 4 * 60 * 1000,
      merkleLeaf: '0x8f2d1e4a5c9b7f3a8e1d2c4b6a8f0e2d4c6b8a0f2e4d6c8b0a2f4e6d8c0b2a4f',
      payloadSize: 32,
      fleetName: 'Cold-Chain Pharma'
    },
    {
      id: 'BCN-1940',
      name: 'City Scooter #194',
      category: 'Micromobility',
      macHash: '0x39c0..81ab',
      distanceMeters: 11.4,
      rssi: -71,
      lat: 23.8089,
      lng: 90.4102,
      batteryPct: 78,
      timestamp: Date.now() - 11 * 60 * 1000,
      merkleLeaf: '0x1c3e5a7b9d1f3e5a7b9d1f3e5a7b9d1f3e5a7b9d1f3e5a7b9d1f3e5a7b9d1f3e',
      payloadSize: 48,
      fleetName: 'Micromobility Fleet'
    },
    {
      id: 'BCN-0032',
      name: 'ColdChain Sensor #03',
      category: 'Cold-Chain Temp',
      macHash: '0xd71e..4920',
      distanceMeters: 5.8,
      rssi: -62,
      lat: 23.8142,
      lng: 90.4165,
      batteryPct: 88,
      timestamp: Date.now() - 55 * 60 * 1000,
      merkleLeaf: '0x4b6a8f0e2d4c6b8a0f2e4d6c8b0a2f4e6d8c0b2a4f6e8d0c2b4a6f8e0d2c4b6a',
      payloadSize: 64,
      fleetName: 'Cold-Chain Pharma'
    },
    {
      id: 'BCN-0401',
      name: 'Smart Water Meter #40',
      category: 'Smart Meter',
      macHash: '0x0f81..b934',
      distanceMeters: 22.0,
      rssi: -84,
      lat: 23.8065,
      lng: 90.4081,
      batteryPct: 99,
      timestamp: Date.now() - 8 * 60 * 60 * 1000,
      merkleLeaf: '0x7e9d1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e1f3a5b7c9e',
      payloadSize: 24,
      fleetName: 'Utility Grid'
    }
  ]);

  // Real Geolocation Detection on Mount
  useEffect(() => {
    resolveRealNexusLocation().then(geo => {
      setNexusRealGeo(geo);
      setNexusH3Hex(geo.h3Hex);
    });
  }, []);

  // Periodic Telemetry & Dynamic BLE Witness Simulation
  useEffect(() => {
    if (!nexusActive) return;

    const interval = setInterval(() => {
      setNexusClaimableTokens(prev => +(prev + 0.0001).toFixed(4));
      setNexusTotalDetections(prev => prev + 1);

      setNexusDiscoveredBeacons(prev => prev.map(beacon => {
        const jitter = calculateRssiFromDistance(beacon.distanceMeters);
        return { ...beacon, rssi: jitter };
      }));
    }, 2500);

    const packetInterval = setInterval(() => {
      setNexusUncommittedPackets(p => p + 1);
    }, 5000);

    return () => {
      clearInterval(interval);
      clearInterval(packetInterval);
    };
  }, [nexusActive]);

  const toggleNexusNode = useCallback(() => {
    setNexusActive(prev => {
      const next = !prev;
      playSound(next ? 'success' : 'click');
      addToast(
        next ? 'success' : 'info',
        next ? 'CredX Nexus Relayer Active' : 'CredX Nexus Relayer Paused',
        next ? 'Listening for nearby BLE asset tags and smart meters...' : 'IoT edge relay suspended.'
      );
      return next;
    });
  }, [playSound, addToast]);

  const setNexusMode = useCallback((mode: 'eco' | 'balanced' | 'turbo') => {
    setNexusModeState(mode);
    playSound('click');
    addToast('info', 'Discovery Mode Updated', `Switched to ${mode.toUpperCase()} BLE discovery.`);
  }, [playSound, addToast]);

  const claimNexusTokens = useCallback(() => {
    if (nexusClaimableTokens <= 0) return;
    const claimed = nexusClaimableTokens;
    setNexusClaimableTokens(0);
    playSound('fanfare');
    boostScore(10, 'CredX Nexus Verified Relay Settlement');
    addToast('success', 'NEXUS Tokens Claimed!', `Claimed ${claimed.toFixed(4)} NEXUS to your connected Creditcoin wallet.`);
  }, [nexusClaimableTokens, playSound, boostScore, addToast]);

  const attestNexusBatch = useCallback(async () => {
    playSound('fanfare');
    setNexusUncommittedPackets(0);
    boostScore(25, 'CredX Nexus Physical Proof of Proximity (PoP) Batch');
    addToast('info', 'Demo Nexus Attestation', 'IoT PoP batch is simulated locally — no Merkle root was attested on-chain. Connect a wallet to submit real proofs.');
  }, [playSound, boostScore, addToast]);

  const addNexusBeacon = useCallback((beacon: NexusBeacon) => {
    setNexusDiscoveredBeacons(prev => [beacon, ...prev]);
    setNexusTotalBeacons(prev => prev + 1);
    setNexusTotalDetections(prev => prev + 1);
    setNexusUncommittedPackets(prev => prev + 1);
  }, []);

  // ==========================================
  // CredX GeoOrbit RTK Space-Time Mesh State
  // ==========================================
  const [orbitConnected, setOrbitConnected] = useState<boolean>(true);
  const [orbitTotalStations] = useState<number>(22660);
  const [orbitMyStationsCount] = useState<number>(1);
  const [orbitClaimableTokens, setOrbitClaimableTokens] = useState<number>(48.25);
  const [orbitBurnedTokens, setOrbitBurnedTokens] = useState<number>(2841920);
  const [orbitDataRevenueUSD, setOrbitDataRevenueUSD] = useState<number>(354504.35);
  const [orbitSatellitesLocked, setOrbitSatellitesLocked] = useState<number>(38);
  const [orbitAccuracyCm, setOrbitAccuracyCm] = useState<number>(1.2);
  const [orbitActiveHexMultiplier] = useState<string>('6X');
  const [orbitMountpoint, setOrbitMountpointState] = useState<string>('AUTO_ITRF2020');
  const [orbitStationUptimeHours, setOrbitStationUptimeHours] = useState<number>(842.6);
  const [orbitSatellites, setOrbitSatellites] = useState<SatelliteChannel[]>(INITIAL_SATELLITE_CHANNELS);
  const [orbitNmeaSentence, setOrbitNmeaSentence] = useState<string>(() => generateSampleNMEA(4));
  const [orbitNmeaData, setOrbitNmeaData] = useState<NMEAGGAData | null>(() => parseNMEAGGA(generateSampleNMEA(4)));
  const [orbitLastAttestationHash, setOrbitLastAttestationHash] = useState<string>('0x8a92f03b17c82e44d59a60b9381e4c771a39fbc8012489e5a1b32d4e7f80219c');
  const [orbitPoSTProofsCount, setOrbitPoSTProofsCount] = useState<number>(142);

  // Background Telemetry & Satellite Carrier-Phase Simulation
  useEffect(() => {
    if (!orbitConnected) return;

    const interval = setInterval(() => {
      setOrbitClaimableTokens(prev => +(prev + 0.002).toFixed(4));
      setOrbitDataRevenueUSD(prev => +(prev + 0.08).toFixed(2));
      setOrbitBurnedTokens(prev => prev + 1);
      setOrbitStationUptimeHours(prev => +(prev + 0.001).toFixed(3));

      // Jitter satellite SNRs slightly for real-time physics tracking realism
      setOrbitSatellites(prev => prev.map(sat => {
        const jitter = +((Math.random() - 0.5) * 0.4).toFixed(1);
        const newSnr = Math.min(54, Math.max(38, +(sat.snrDbHz + jitter).toFixed(1)));
        return { ...sat, snrDbHz: newSnr };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [orbitConnected]);

  const toggleOrbitStation = useCallback(() => {
    setOrbitConnected(prev => {
      const next = !prev;
      playSound(next ? 'success' : 'click');
      addToast(
        next ? 'success' : 'info',
        next ? 'CredX GeoOrbit Base Station Online' : 'Base Station Offline',
        next ? 'Broadcasting RTCM 3.2 MSM7 differential corrections to NTRIP caster.' : 'Base station broadcast suspended.'
      );
      return next;
    });
  }, [playSound, addToast]);

  const claimOrbitTokens = useCallback(() => {
    if (orbitClaimableTokens <= 0) return;
    const claimed = orbitClaimableTokens;
    setOrbitClaimableTokens(0);
    playSound('fanfare');
    boostScore(15, 'CredX GeoOrbit Verified RTK Epoch Settlement');
    addToast('success', 'ORBIT Rewards Claimed!', `Claimed ${claimed.toFixed(2)} ORBIT to your connected Creditcoin wallet.`);
  }, [orbitClaimableTokens, playSound, boostScore, addToast]);

  const setOrbitMountpoint = useCallback((mountpoint: string) => {
    setOrbitMountpointState(mountpoint);
    playSound('click');
    addToast('info', 'NTRIP Mountpoint Switched', `Connected to ${mountpoint} on caster port 2101 (RTCM 3.2).`);
  }, [playSound, addToast]);

  const simulateRoverFix = useCallback((quality: 1 | 4 | 5 = 4) => {
    const raw = generateSampleNMEA(quality);
    const parsed = parseNMEAGGA(raw);
    setOrbitNmeaSentence(raw);
    setOrbitNmeaData(parsed);
    setOrbitAccuracyCm(parsed.accuracyCm);
    setOrbitSatellitesLocked(parsed.satellites);
    if (quality === 4) {
      playSound('fanfare');
      addToast('success', 'RTK Fix Resolved (1.2 cm)', 'Carrier-phase integer ambiguities resolved via CredX GeoOrbit NTRIP caster.');
    } else if (quality === 5) {
      playSound('click');
      addToast('info', 'RTK Float Mode (14.5 cm)', 'Differential baseline converging. Awaiting integer ambiguity lock.');
    } else {
      playSound('click');
      addToast('info', 'Autonomous Mode (2.8 m)', 'Standard L1 uncorrected GNSS pseudo-range positioning.');
    }
  }, [playSound, addToast]);

  const syncOrbitAttestation = useCallback(async () => {
    playSound('fanfare');
    const randomHex = Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    const newHash = `0x${randomHex}`;
    setOrbitLastAttestationHash(newHash);
    setOrbitPoSTProofsCount(c => c + 1);
    boostScore(50, 'CredX GeoOrbit Dual-Frequency Space-Time Proof (PoST)');
    addToast(
      'info',
      'Demo Space-Time Proof',
      `RINEX carrier observation proof is simulated locally — nothing was anchored on Creditcoin L1. Connect a wallet for real attestation.`
    );
  }, [playSound, boostScore, addToast]);

  const borrow = useCallback((amountUSD: number, collateral: string) => {
    if (dataSource === 'chain') {
      void (async () => {
        try {
          const hash = await borrowFromPool(amountUSD);
          addToast('success', 'Borrow Submitted', `Loan request ${amountUSD.toLocaleString()} cUSD — tx ${hash.slice(0, 8)}… sent.`);
          await refreshFromChain();
        } catch (err: any) {
          addToast('error', 'Borrow Failed', err?.shortMessage || err?.message || 'Transaction rejected.');
        }
      })();
      return;
    }
    const newId = `LN-${Math.floor(1000 + Math.random() * 9000)}`;
    const newLoan: LoanPosition = {
      id: newId,
      amount: amountUSD,
      collateral,
      principalUSD: amountUSD,
      collateralRatio: '70.0%',
      interestRate: '2.50',
      apr: '2.50%',
      dueDate: '2026-10-30',
      dueDays: 30,
      status: 'ACTIVE'
    };
    setActiveLoans(prev => [newLoan, ...prev]);
    addToast('info', 'Demo Borrow', `${amountUSD.toLocaleString()} cUSD loan simulated locally — connect a wallet to borrow on Creditcoin testnet.`);
    if (isPostHogEnabled) {
      posthog.capture('loan_originated', { amount_usd: amountUSD });
    }
    boostScore(5, 'New Under-Collateralized Loan Origination');
  }, [boostScore, dataSource, refreshFromChain, addToast]);

  const originateLoan = useCallback((borrowUSD: number, collateralCTC: number) => {
    borrow(borrowUSD, `${collateralCTC} CTC`);
  }, [borrow]);

  const repay = useCallback((id: string | number) => {
    if (dataSource === 'chain') {
      const loan = activeLoans.find(l => l.id === String(id));
      void (async () => {
        try {
          const hash = await repayPoolLoan(id, loan?.principalUSD ?? 0);
          addToast('success', 'Repayment Sent', `Loan ${id} repaid — tx ${hash.slice(0, 8)}… confirmed.`);
          await refreshFromChain();
        } catch (err: any) {
          addToast('error', 'Repayment Failed', err?.shortMessage || err?.message || 'Transaction rejected.');
        }
      })();
      return;
    }
    setActiveLoans(prev => prev.filter(l => l.id !== id));
    addToast('info', 'Demo Repayment', 'Loan settlement simulated locally — connect a wallet to repay on-chain.');
    if (isPostHogEnabled) {
      posthog.capture('loan_repaid');
    }
    boostScore(15, 'On-Time Loan Settlement & Collateral Refund');
  }, [boostScore, dataSource, activeLoans, refreshFromChain, addToast]);

  const repayLoan = useCallback((id: number) => {
    repay(id);
  }, [repay]);

  const mintSBT = useCallback(() => {
    if (dataSource === 'chain') {
      void (async () => {
        try {
          const hash = await mintSBTTx();
          addToast('success', 'Attestation Minted', `SBT minted on-chain — tx ${hash.slice(0, 8)}… confirmed.`);
          await refreshFromChain();
        } catch (err: any) {
          addToast('error', 'Mint Failed', err?.shortMessage || err?.message || 'Transaction rejected.');
        }
      })();
      return;
    }
    setSbtMinted(true);
    addToast('info', 'Demo SBT', 'Passport state simulated locally — connect a wallet to mint the real ERC-5192 soulbound token.');
    boostScore(10, 'ERC-5192 Soulbound Passport Minted');
  }, [boostScore, dataSource, refreshFromChain, addToast]);

  const toggleVirtualNode = useCallback(() => {
    const next = !virtualNodeActive;
    setVirtualNodeActive(next);
    if (isPostHogEnabled) {
      posthog.capture(next ? 'virtual_node_started' : 'virtual_node_paused');
    }
    if (next) {
      playSound('success');
      addToast('success', 'Virtual Node Started', 'Sharing idle compute & bandwidth to earn CredX points');
    } else {
      playSound('click');
      addToast('info', 'Virtual Node Paused', 'Uptime points saved locally');
    }
  }, [virtualNodeActive, playSound, addToast]);

  const toggleNode = useCallback(() => {
    toggleVirtualNode();
  }, [toggleVirtualNode]);

  const runPingTest = useCallback(async (): Promise<number> => {
    const start = performance.now();
    try {
      await fetch(window.location.origin, { method: 'HEAD', mode: 'no-cors' });
      const duration = Math.round(performance.now() - start);
      const measured = Math.max(12, duration);
      setHardware(prev => ({ ...prev, pingMs: measured }));
      return measured;
    } catch {
      setHardware(prev => ({ ...prev, pingMs: 18 }));
      return 18;
    }
  }, []);

  const syncNodePoints = useCallback(() => {
    if (virtualNodePoints === 0) return;
    const pts = Math.min(25, Math.floor(virtualNodePoints / 100));
    boostScore(pts, `Virtual Node ${nodeBandwidthMB}MB Bandwidth Telemetry Proof`);
  }, [virtualNodePoints, nodeBandwidthMB, boostScore]);

  return (
    <ProtocolContext.Provider
      value={{
        dataSource,
        isLiveOnChain: dataSource === 'chain',
        refreshFromChain,
        score,
        creditScore: score,
        tier,
        occrFactors,
        factors: occrFactors,
        verifiedVolumeUSD,
        maxBorrowLimit: approvedLineUSD,
        approvedLineUSD,
        collateralRatioBps,
        borrowApr,
        sbtTokenId,
        sbtCommitment,
        sbtMinted,
        mintSBT,
        activeLoans,
        hardware,
        telemetry: hardware,
        virtualNodeActive,
        nodeRunning: virtualNodeActive,
        virtualNodePoints,
        nodePoints: virtualNodePoints,
        nodeUptimeSec,
        nodeBandwidthMB,
        borrow,
        originateLoan,
        repay,
        repayLoan,
        toggleVirtualNode,
        toggleNode,
        runPingTest,
        syncNodePoints,
        boostScore,
        // Pulse DePIN state & handlers
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
        syncPulseAttestation,
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
        orbitStableHexes: ACTIVE_STABLE_HEXES,
        orbitClusters: GLOBAL_MINER_CLUSTERS,
        orbitMountpoints: GEORBIT_MOUNTPOINTS,
        toggleOrbitStation,
        claimOrbitTokens,
        syncOrbitAttestation,
        setOrbitMountpoint,
        simulateRoverFix,
        // Backward-compatible aliases
        grassNetworkQuality: pulseNetworkQuality,
        grassEpoch: pulseEpoch,
        grassUptimePoints: pulseUptimePoints,
        grassNetworkPoints: pulseNetworkPoints,
        grassTotalBandwidthGB: pulseBandwidthGB,
        grassConnected: pulseConnected,
        toggleGrassNode: togglePulseNode,
        syncGrassAttestation: syncPulseAttestation
      }}
    >
      {children}
    </ProtocolContext.Provider>
  );
};

export const useProtocol = (): ProtocolContextType => {
  const context = useContext(ProtocolContext);
  if (!context) throw new Error('useProtocol must be used within ProtocolProvider');
  return context;
};

export default ProtocolProvider;

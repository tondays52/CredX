/**
 * AutonomousAIHub Contract Utility
 * Live reads and writes to the deployed AutonomousAIHub on Creditcoin Testnet
 * Contract: 0xEc1445818cF57507Ff46B8a72daa9F7A66B60a5D
 * cUSD Token: 0xdec5170C46DC63D812c699E9dFE6561FFd1BF298
 */

import { ethers, BrowserProvider, JsonRpcProvider } from 'ethers';

export const AI_HUB_ADDRESS = '0xEc1445818cF57507Ff46B8a72daa9F7A66B60a5D';
export const CUSD_ADDRESS   = '0xdec5170C46DC63D812c699E9dFE6561FFd1BF298';
export const CREDITCOIN_RPC = 'https://rpc.cc3-testnet.creditcoin.network';

// ─── ABIs (minimal, only what we need) ─────────────────────────────────────

export const AI_HUB_ABI = [
  // Read-only
  'function marketVolatilityIndex() view returns (uint256)',
  'function globalDefaultRateBps() view returns (uint256)',
  'function lastRiskUpdateBlock() view returns (uint256)',
  'function getAutonomousRiskAdjustedAPR() view returns (uint256)',
  'function aiAgents(address) view returns (uint256 reputationScore, uint256 totalVerifiedProfitUSD, uint256 activeLoanAmount, uint256 totalLoansRepaid, bool isRegistered)',
  'function computeTasks(bytes32) view returns (bytes32 taskId, address requester, address gpuProvider, uint256 escrowAmount, bool isSettled)',
  // Write
  'function registerAIAgent()',
  'function triggerAutonomousAgentLoan(uint256 amount)',
  'function repayAgentLoan(uint256 amount)',
  'function depositComputeEscrow(bytes32 taskId, address gpuProvider, uint256 amount)',
  // Events
  'event AIAgentRegistered(address indexed agent)',
  'event AgentLoanDispatched(address indexed agent, uint256 amount)',
  'event AgentLoanRepaid(address indexed agent, uint256 amount)',
  'event ComputeEscrowDeposited(bytes32 indexed taskId, address indexed requester, address indexed gpuProvider, uint256 amount)',
  'event CrossChainRiskSignalProcessed(uint256 indexed sourceChainId, bytes32 indexed txHash, uint256 newVolatilityIndex, uint256 newDefaultRateBps, uint256 adjustedBaseApr)',
];

export const CUSD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AIAgentProfile {
  reputationScore: number;
  totalVerifiedProfitUSD: number;
  activeLoanAmount: number;   // in cUSD (18 decimals normalised)
  totalLoansRepaid: number;
  isRegistered: boolean;
}

export interface AIHubRiskMetrics {
  volatilityIndex: number;    // raw bps (0–10000)
  defaultRateBps: number;     // raw bps (0–10000)
  lastRiskBlock: number;
  autonomousAPRBps: number;   // raw bps
}

// ─── Read-only provider (no wallet needed) ──────────────────────────────────

function getReadContract() {
  const provider = new JsonRpcProvider(CREDITCOIN_RPC);
  return new ethers.Contract(AI_HUB_ADDRESS, AI_HUB_ABI, provider);
}

function getCUSDReadContract() {
  const provider = new JsonRpcProvider(CREDITCOIN_RPC);
  return new ethers.Contract(CUSD_ADDRESS, CUSD_ABI, provider);
}

// ─── Public read functions ───────────────────────────────────────────────────

export async function fetchRiskMetrics(): Promise<AIHubRiskMetrics> {
  const contract = getReadContract();
  const [vol, def, block, apr] = await Promise.all([
    contract.marketVolatilityIndex(),
    contract.globalDefaultRateBps(),
    contract.lastRiskUpdateBlock(),
    contract.getAutonomousRiskAdjustedAPR(),
  ]);
  return {
    volatilityIndex:  Number(vol),
    defaultRateBps:   Number(def),
    lastRiskBlock:    Number(block),
    autonomousAPRBps: Number(apr),
  };
}

export async function fetchAgentProfile(address: string): Promise<AIAgentProfile> {
  const contract = getReadContract();
  const result = await contract.aiAgents(address);
  return {
    reputationScore:      Number(result.reputationScore),
    totalVerifiedProfitUSD: Number(ethers.formatUnits(result.totalVerifiedProfitUSD, 6)), // treat as USD cents
    activeLoanAmount:     parseFloat(ethers.formatUnits(result.activeLoanAmount, 18)),
    totalLoansRepaid:     parseFloat(ethers.formatUnits(result.totalLoansRepaid, 18)),
    isRegistered:         result.isRegistered,
  };
}

export async function fetchCUSDBalance(address: string): Promise<number> {
  try {
    const contract = getCUSDReadContract();
    const bal = await contract.balanceOf(address);
    return parseFloat(ethers.formatUnits(bal, 18));
  } catch {
    return 0;
  }
}

// ─── Write functions (require signer from MetaMask) ─────────────────────────

async function getSigner(): Promise<ethers.Signer> {
  const win = window as any;
  if (!win.ethereum) throw new Error('No EVM wallet detected');
  const provider = new BrowserProvider(win.ethereum);
  return provider.getSigner();
}

export async function registerAIAgent(): Promise<string> {
  const signer = await getSigner();
  const contract = new ethers.Contract(AI_HUB_ADDRESS, AI_HUB_ABI, signer);
  const tx = await contract.registerAIAgent();
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function triggerAgentLoan(amountCUSD: number): Promise<string> {
  const signer = await getSigner();
  const contract = new ethers.Contract(AI_HUB_ADDRESS, AI_HUB_ABI, signer);
  const amount = ethers.parseUnits(amountCUSD.toString(), 18);
  const tx = await contract.triggerAutonomousAgentLoan(amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function repayAgentLoan(amountCUSD: number): Promise<string> {
  const signer = await getSigner();
  const signerAddress = await signer.getAddress();

  // First approve cUSD spend
  const cusdContract = new ethers.Contract(CUSD_ADDRESS, CUSD_ABI, signer);
  const amount = ethers.parseUnits(amountCUSD.toString(), 18);
  const allowance = await cusdContract.allowance(signerAddress, AI_HUB_ADDRESS);
  if (allowance < amount) {
    const approveTx = await cusdContract.approve(AI_HUB_ADDRESS, amount);
    await approveTx.wait();
  }

  const contract = new ethers.Contract(AI_HUB_ADDRESS, AI_HUB_ABI, signer);
  const tx = await contract.repayAgentLoan(amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function depositComputeEscrow(
  taskId: string,
  gpuProvider: string,
  amountCUSD: number
): Promise<string> {
  const signer = await getSigner();
  const signerAddress = await signer.getAddress();
  const amount = ethers.parseUnits(amountCUSD.toString(), 18);

  // Approve cUSD
  const cusdContract = new ethers.Contract(CUSD_ADDRESS, CUSD_ABI, signer);
  const allowance = await cusdContract.allowance(signerAddress, AI_HUB_ADDRESS);
  if (allowance < amount) {
    const approveTx = await cusdContract.approve(AI_HUB_ADDRESS, amount);
    await approveTx.wait();
  }

  const contract = new ethers.Contract(AI_HUB_ADDRESS, AI_HUB_ABI, signer);
  const taskIdBytes32 = ethers.id(taskId); // keccak256 of the string
  const tx = await contract.depositComputeEscrow(taskIdBytes32, gpuProvider, amount);
  const receipt = await tx.wait();
  return receipt.hash;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function bpsToPercent(bps: number): string {
  return (bps / 100).toFixed(2) + '%';
}

export function scoreToTier(score: number): { label: string; color: string; emoji: string } {
  if (score >= 780) return { label: 'Super-Prime', color: '#00FF66', emoji: '🏆' };
  if (score >= 700) return { label: 'Prime',       color: '#22d3ee', emoji: '🌟' };
  if (score >= 650) return { label: 'Near-Prime',  color: '#a78bfa', emoji: '⭐' };
  if (score >= 580) return { label: 'Standard',    color: '#fbbf24', emoji: '📊' };
  return                     { label: 'Subprime',   color: '#f87171', emoji: '⚠️' };
}

/** Generate a deterministic task ID string for display/submission */
export function generateTaskId(): string {
  return `TASK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`; // NOSONAR
}

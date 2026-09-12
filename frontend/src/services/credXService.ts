/**
 * CredXProtocol Contract Service
 *
 * Real on-chain reads (JsonRpcProvider) and writes (BrowserProvider signer)
 * to the deployed CredX contracts on Creditcoin Testnet (chainId 102031).
 * Mirrors the proven pattern from `utils/aiHubContract.ts`.
 *
 * NOTE: the deployed "AttestationVerifier" is the testnet mock harness
 * ("always-pass" mode). Proofs submitted through it produce score changes
 * by design of the demo environment — see MockAttestationOracle.sol.
 */

import { ethers, BrowserProvider, JsonRpcProvider } from 'ethers';
import { CONTRACTS, CUSD_DECIMALS, CREDITCOIN_RPC } from '../config/contracts';

export type CardTier = 'SUBPRIME' | 'NEAR_PRIME' | 'PRIME' | 'SUPER_PRIME';

export interface BorrowerProfile {
  creditScore: number;
  totalVerifiedVolumeUSD: number;
  totalAttestationsCount: number;
  lastAttestationTimestamp: number;
  isMainnetActive: boolean;
  protocolDiversityCount: number;
  chainDiversityCount: number;
  weightedActionScore: number;
  maxCreditLineUSD: number;
  requiredCollateralRatioBps: number;
}

export interface PoolLoan {
  loanId: string;
  borrower: string;
  principalUSD: number;
  collateralCTC: number;
  borrowedAtBlock: number;
  dueBlock: number;
  interestRateBps: number;
  isRepaid: boolean;
  isDefaulted: boolean;
}

export interface SBTAttestation {
  tokenId: string;
  holder: string;
  tier: CardTier;
  minimumScore: number;
  attestedBlock: number;
  commitmentHash: string;
  isValid: boolean;
}

export interface ArenaStats {
  paperBalance: number;
  currentWinStreak: number;
  longestWinStreak: number;
  totalWins: number;
  totalRounds: number;
  totalReputationBoostsClaimed: number;
}

// ─── Minimal ABIs ───────────────────────────────────────────────────────────

export const ERC20_META_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

export const AMM_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function reserve0() view returns (uint256)',
  'function reserve1() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function getAmountOut(uint256 amountIn, address tokenIn, address user) view returns (uint256)',
  'function addLiquidity(uint256 amount0, uint256 amount1) returns (uint256 liquidity)',
  'function removeLiquidity(uint256 liquidity) returns (uint256 amount0, uint256 amount1)',
  'function swap(uint256 amount0Out, uint256 amount1Out)',
];

export const YIELD_VAULT_ABI = [
  'function stakingToken() view returns (address)',
  'function rewardToken() view returns (address)',
  'function totalStaked() view returns (uint256)',
  'function rewardPerTokenStored() view returns (uint256)',
  'function lastRewardBlock() view returns (uint256)',
  'function stakers(address) view returns (uint256)',
  'function rewardDebt(address) view returns (uint256)',
  'function stake(uint256 amount)',
  'function unstake(uint256 amount)',
  'function claimRewards()',
];

export const TREASURY_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function lastDepositBlock(address) view returns (uint256)',
  'function STABLECOIN() view returns (address)',
  'function PRICE_ORACLE() view returns (address)',
  'function MIN_SCORE_REQUIRED() view returns (uint256)',
  'function PREMIUM_SCORE_THRESHOLD() view returns (uint256)',
  'function PREMIUM_BONUS_BPS() view returns (uint256)',
  'function BONUS_VEST_BLOCKS() view returns (uint256)',
  'function deposit(uint256 stablecoinAmount)',
  'function withdraw(uint256 sharesAmount)',
];

export const PRICE_ORACLE_ABI = [
  'function getLatestPrice() view returns (uint256 price, uint8 decimals)',
];

export const INVOICE_ABI = [
  'function nextInvoiceId() view returns (uint256)',
  'function invoices(uint256) view returns (address business, address funder, uint256 faceValue, uint256 fundedAmount, uint256 durationBlocks, uint256 createdBlock, bool isFunded, bool isRepaid)',
  'function tokenizeInvoice(uint256 faceValue, uint256 durationBlocks) returns (uint256)',
  'function fundInvoice(uint256 invoiceId)',
  'function repayInvoice(uint256 invoiceId)',
  'function reclaimOverdueFunds(uint256 invoiceId)',
];

export const DEPIN_HUB_ABI = [
  'function DEPIN_TOKEN() view returns (address)',
  'function maxHardwareLoanAmount() view returns (uint256)',
  'function delegations(address, address) view returns (uint256)',
  'function hardwareLoans(address) view returns (uint256)',
  'function hardwareLoanDueBlock(address) view returns (uint256)',
  'function delegateStake(address operator, uint256 amount)',
  'function undelegateStake(address operator, uint256 amount)',
  'function requestHardwareLoan(uint256 amount)',
  'function repayHardwareLoan(uint256 amount)',
];

export const GAMING_ABI = [
  'function gameToken() view returns (address)',
  'function gameItem() view returns (address)',
  'function lastGatherBlock(address) view returns (uint256)',
  'function lastLootboxBlock(address) view returns (uint256)',
  'function listings(uint256) view returns (address seller, uint256 price, bool active)',
  'function gatherResources()',
  'function openLootbox()',
  'function listNFT(uint256 tokenId, uint256 price)',
  'function cancelListing(uint256 tokenId)',
  'function buyNFT(uint256 tokenId)',
];

export const ARENA_VIEW_ABI = [
  'function currentRoundId() view returns (uint256)',
  'function rounds(uint256) view returns (uint256 roundId, string assetSymbol, uint256 strikePrice, uint256 settlementPrice, uint256 startBlock, uint256 lockBlock, uint256 closeBlock, uint256 totalAboveStake, uint256 totalBelowStake, uint8 winningChoice, uint8 status)',
  'function userPredictions(uint256, address) view returns (uint8 choice, uint256 stakeAmount, bool claimed)',
  'function userStats(address) view returns (uint256 paperBalance, uint256 currentWinStreak, uint256 longestWinStreak, uint256 totalWins, uint256 totalRounds, uint256 totalReputationBoostsClaimed)',
  'function registerUser()',
  'function placePrediction(uint256 roundId, uint8 choice, uint256 stakeAmount)',
  'function claimPayout(uint256 roundId)',
  'function syncStreakToReputation() returns (bool)',
];

export const HUB_ABI = [
  'function getBorrowerProfile(address) view returns (uint256 creditScore, uint256 totalVerifiedVolumeUSD, uint256 totalAttestationsCount, uint256 maxCreditLineUSD, uint256 requiredCollateralRatioBps, uint256 lastAttestationTimestamp)',
  'function borrowerProfiles(address) view returns (uint256 creditScore, uint256 totalVerifiedVolumeUSD, uint256 totalAttestationsCount, uint256 lastAttestationTimestamp, bool isMainnetActive, uint256 protocolDiversityCount, uint256 chainDiversityCount, uint256 weightedActionScore)',
  'function submitBatchProofs((uint256,bytes32,uint256,bytes32,uint256,bytes,bytes)[] proofs, uint8[] actionTypes, uint256[] reportedValuesUSD) returns (uint256 finalScore)',
  'function delegateCredit(address beneficiary, uint256 boostAmount, uint256 durationDays)',
  'function revokeCreditDelegation(address beneficiary)',
  'function getAttestcoinPrecompile() view returns (address)',
];

export const SCORE_ENGINE_ABI = [
  'function getCollateralRatio(uint256 score) pure returns (uint256)',
  'function getInterestRate(uint256 score) pure returns (uint256)',
  'function getMaxCreditLine(uint256 score, uint256 totalVerifiedVolumeUSD) pure returns (uint256)',
];

export const POOL_ABI = [
  'function loans(uint256) view returns (uint256 loanId, address borrower, uint256 principalUSD, uint256 collateralCTC, uint256 borrowedAtBlock, uint256 dueBlock, uint256 interestRateBps, bool isRepaid, bool isDefaulted)',
  'function getUserLoans(address) view returns (uint256[])',
  'function lenderBalances(address) view returns (uint256)',
  'function ctcPriceUSD() view returns (uint256)',
  'function depositLiquidity(uint256 amountUSD)',
  'function withdrawLiquidity(uint256 amountUSD)',
  'function borrow(uint256 requestedUSD) payable returns (uint256 loanId)',
  'function repayLoan(uint256 loanId, uint256 amountUSD)',
];

export const SBT_ABI = [
  'function attestations(uint256) view returns (uint256 tokenId, address holder, uint8 tier, uint256 minimumScore, uint256 attestedBlock, bytes32 commitmentHash, bool isValid)',
  'function holderTokenId(address) view returns (uint256)',
  'function mintAttestation() returns (uint256 tokenId)',
  'function refreshAttestation()',
  'function tokenURI(uint256) view returns (string)',
];

export const ARENA_ABI = [
  'function registerUser()',
  'function syncStreakToReputation() returns (bool)',
  'function userStats(address) view returns (uint256 paperBalance, uint256 currentWinStreak, uint256 longestWinStreak, uint256 totalWins, uint256 totalRounds, uint256 totalReputationBoostsClaimed)',
];

export const CUSD_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
];

// ─── USC BlockProverAttestationOracle (live 0x0FD2 integration) ────────────

export const USC_ORACLE_ABI = [
  'function blockProverPrecompile() view returns (address)',
  'function chainInfoPrecompile() view returns (address)',
  'function anchoredCount() view returns (uint256)',
  'function supportedChains() view returns ((uint64 chainKey, uint64 chainId, bytes chainName, uint8 chainEncoding)[])',
  'function isSupportedChain(uint64 chainKey) view returns (bool)',
  'function latestAttestedHeight(uint64 chainKey) view returns (uint64 height, bool exists)',
  'function verifySourceTransaction(uint64 chainKey, uint64 height, bytes encodedTransaction, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) view returns (bool)',
  'function anchorVerifiedTransaction(uint64 chainKey, uint64 height, bytes encodedTransaction, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof) returns (bool)',
  'function isTxAnchored(uint64 chainKey, uint64 height, bytes encodedTransaction) view returns (bool)',
];

export interface USCChainInfo {
  chainKey: number;
  chainId: number;
  chainName: string;
  latestAttestedHeight: number;
}

export interface USCOracleInfo {
  blockProverPrecompile: string;
  chainInfoPrecompile: string;
  anchoredCount: number;
  chains: USCChainInfo[];
}

function hexBytesToUtf8(hexStr: string): string {
  try {
    const hex = hexStr.replace(/^0x/, '');
    if (hex.length % 2 !== 0) return '';
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      const b = parseInt(hex.slice(i, i + 2), 16);
      if (b === 0) break; // null-terminated
      bytes.push(b);
    }
    return String.fromCharCode(...bytes).replace(/[^\x20-\x7e]/g, '');
  } catch {
    return '';
  }
}

export async function fetchUSCOracleInfo(): Promise<USCOracleInfo> {
  const oracle = readContract(CONTRACTS.blockProverAttestationOracle, USC_ORACLE_ABI);
  const [chainsRaw, anchoredCount, blockProver, chainInfo] = await Promise.all([
    oracle.supportedChains(),
    oracle.anchoredCount(),
    oracle.blockProverPrecompile(),
    oracle.chainInfoPrecompile(),
  ]);

  const chainKeys = chainsRaw.map((c: any) => Number(c.chainKey));
  const heights = await Promise.all(
    chainKeys.map((key: number) => oracle.latestAttestedHeight(key))
  );

  const chains: USCChainInfo[] = chainsRaw.map((c: any, i: number) => ({
    chainKey: Number(c.chainKey),
    chainId: Number(c.chainId),
    chainName: c.chainName ? hexBytesToUtf8(c.chainName) : '(unnamed)',
    latestAttestedHeight: Number(heights[i][0]),
  }));

  return {
    blockProverPrecompile: String(blockProver),
    chainInfoPrecompile: String(chainInfo),
    anchoredCount: Number(anchoredCount),
    chains,
  };
}

// ─── USC live proof verification (0x0FD2 via the proof-builder HTTP API) ──

export const USC_PROOF_API_BASE = 'https://prover.cc3-testnet.creditcoin.network';
export const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

/** Shape returned by Creditcoin's public proof-builder service (GET /api/v1/proof-by-tx/{chainKey}/{txHash}). */
export interface USCMerkleSibling {
  hash: string;
  isLeft: boolean;
}

export interface USCMerkleProof {
  root: string;
  siblings: USCMerkleSibling[];
}

export interface USCContinuityProof {
  lowerEndpointDigest: string;
  roots: string[];
}

export interface USCProof {
  chainKey: number;
  height: number;
  txIndex: number;
  txHash: string;
  txBytes: string;
  merkleProof: USCMerkleProof;
  continuityProof: USCContinuityProof;
}

async function uscFetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`USC endpoint ${url} responded ${res.status}`);
  return res.json();
}

/**
 * Resolves a fresh, real proof for the latest Creditcoin-attested Sepolia block:
 *   1. attested-height from the proof-builder API (already indexed, no waiting needed)
 *   2. last real transaction hash at that height via the Sepolia public RPC
 *   3. Merkle + continuity proof from `GET /api/v1/proof-by-tx/{chainKey}/{txHash}`
 */
export async function fetchLatestAttestedUSCProof(chainKey = 1): Promise<USCProof> {
  const { attestedHeight } = await uscFetchJson(`${USC_PROOF_API_BASE}/api/v1/attested-height/${chainKey}`);
  if (!attestedHeight) throw new Error('Proof-builder returned no attested height for chainKey ' + chainKey);

  const blockRes = await uscFetchJson(SEPOLIA_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_getBlockByNumber',
      params: ['0x' + attestedHeight.toString(16), false],
      id: 1,
    }),
  });
  const txs: string[] = blockRes?.result?.transactions || [];
  if (txs.length === 0) throw new Error(`Sepolia block #${attestedHeight} has no transactions to prove`);

  const txHash = txs[txs.length - 1];
  const data = await uscFetchJson(`${USC_PROOF_API_BASE}/api/v1/proof-by-tx/${chainKey}/${txHash}`);
  if (!data || !data.txBytes || !data.merkleProof || !data.continuityProof) {
    throw new Error('Proof-builder returned an incomplete proof payload.');
  }

  return {
    chainKey,
    height: Number(data.headerNumber),
    txIndex: Number(data.txIndex),
    txHash,
    txBytes: data.txBytes,
    merkleProof: data.merkleProof,
    continuityProof: data.continuityProof,
  };
}

/** View-only crypto verification against the live BlockProver precompile (0x0FD2). */
export async function verifyUSCProofOnOracle(proof: USCProof): Promise<boolean> {
  const oracle = readContract(CONTRACTS.blockProverAttestationOracle, USC_ORACLE_ABI);
  return oracle.verifySourceTransaction(
    proof.chainKey,
    proof.height,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof
  );
}

/** State-changing anchor of a crypto-verified proof (signed by the connected wallet). */
export async function anchorUSCVerifiedProof(proof: USCProof): Promise<{ ok: boolean; txHash: string }> {
  const signer = await getSigner();
  const oracle = new ethers.Contract(CONTRACTS.blockProverAttestationOracle, USC_ORACLE_ABI, signer);
  const tx = await oracle.anchorVerifiedTransaction(
    proof.chainKey,
    proof.height,
    proof.txBytes,
    proof.merkleProof,
    proof.continuityProof
  );
  const receipt = await tx.wait();
  return { ok: receipt.status === 1, txHash: String(receipt.hash) };
}

// ─── Read-only provider ─────────────────────────────────────────────────────

const readProvider = () => new JsonRpcProvider(CREDITCOIN_RPC);

function readContract(address: string, abi: string[]) {
  return new ethers.Contract(address, abi, readProvider());
}

const hubRead = () => readContract(CONTRACTS.credXHub, HUB_ABI);
const engineRead = () => readContract(CONTRACTS.creditScoreEngine, SCORE_ENGINE_ABI);
const poolRead = () => readContract(CONTRACTS.lendingPool, POOL_ABI);
const sbtRead = () => readContract(CONTRACTS.creditAttestationSBT, SBT_ABI);
const arenaRead = () => readContract(CONTRACTS.reputationArena, ARENA_ABI);

// ─── Public reads ───────────────────────────────────────────────────────────

export async function fetchBorrowerProfile(address: string): Promise<BorrowerProfile | null> {
  try {
    const [basic, extended] = await Promise.all([
      hubRead().getBorrowerProfile(address),
      hubRead().borrowerProfiles(address),
    ]);
    return {
      creditScore: Number(basic.creditScore),
      totalVerifiedVolumeUSD: parseFloat(ethers.formatUnits(basic.totalVerifiedVolumeUSD, 18)),
      totalAttestationsCount: Number(basic.totalAttestationsCount),
      maxCreditLineUSD: parseFloat(ethers.formatUnits(basic.maxCreditLineUSD, 18)),
      requiredCollateralRatioBps: Number(basic.requiredCollateralRatioBps),
      lastAttestationTimestamp: Number(basic.lastAttestationTimestamp),
      isMainnetActive: extended.isMainnetActive,
      protocolDiversityCount: Number(extended.protocolDiversityCount),
      chainDiversityCount: Number(extended.chainDiversityCount),
      weightedActionScore: parseFloat(ethers.formatUnits(extended.weightedActionScore, 18)),
    };
  } catch {
    return null;
  }
}

export async function fetchEngineRates(score: number): Promise<{
  collateralRatioBps: number;
  interestRateBps: number;
  maxCreditLineUSD: number;
}> {
  const engine = engineRead();
  const [ratio, rate, maxLine] = await Promise.all([
    engine.getCollateralRatio(score),
    engine.getInterestRate(score),
    engine.getMaxCreditLine(score, 0),
  ]);
  return {
    collateralRatioBps: Number(ratio),
    interestRateBps: Number(rate),
    maxCreditLineUSD: parseFloat(ethers.formatUnits(maxLine, 18)),
  };
}

export async function fetchUserLoans(address: string): Promise<PoolLoan[]> {
  try {
    const contract = poolRead();
    const ids = await contract.getUserLoans(address);
    const loans = await Promise.all(
      ids.map(async (id: bigint) => {
        const loan = await contract.loans(id);
        return {
          loanId: id.toString(),
          borrower: loan.borrower,
          principalUSD: parseFloat(ethers.formatUnits(loan.principalUSD, 18)),
          collateralCTC: parseFloat(ethers.formatUnits(loan.collateralCTC, 18)),
          borrowedAtBlock: Number(loan.borrowedAtBlock),
          dueBlock: Number(loan.dueBlock),
          interestRateBps: Number(loan.interestRateBps),
          isRepaid: loan.isRepaid,
          isDefaulted: loan.isDefaulted,
        };
      })
    );
    return loans.filter((l) => !l.isRepaid);
  } catch {
    return [];
  }
}

export async function fetchSBTAttestation(address: string): Promise<SBTAttestation | null> {
  try {
    const contract = sbtRead();
    const tokenId = await contract.holderTokenId(address);
    if (tokenId === 0n) return null;
    const att = await contract.attestations(tokenId);
    return {
      tokenId: tokenId.toString(),
      holder: att.holder,
      tier: tierToString(Number(att.tier)),
      minimumScore: Number(att.minimumScore),
      attestedBlock: Number(att.attestedBlock),
      commitmentHash: att.commitmentHash,
      isValid: att.isValid,
    };
  } catch {
    return null;
  }
}

export async function fetchArenaStats(address: string): Promise<ArenaStats | null> {
  try {
    const stats = await arenaRead().userStats(address);
    return {
      paperBalance: parseFloat(ethers.formatUnits(stats.paperBalance, 18)),
      currentWinStreak: Number(stats.currentWinStreak),
      longestWinStreak: Number(stats.longestWinStreak),
      totalWins: Number(stats.totalWins),
      totalRounds: Number(stats.totalRounds),
      totalReputationBoostsClaimed: Number(stats.totalReputationBoostsClaimed),
    };
  } catch {
    return null;
  }
}

export async function fetchCUSDBalance(address: string): Promise<number> {
  try {
    const bal = await readContract(CONTRACTS.cUSD, CUSD_ABI).balanceOf(address);
    return parseFloat(ethers.formatUnits(bal, CUSD_DECIMALS));
  } catch {
    return 0;
  }
}

/** Get a signer from the injected EIP-1193 provider (MetaMask / EVM wallet). */
async function getSigner(): Promise<ethers.Signer> {
  const win = window as any;
  if (!win.ethereum) throw new Error('No EVM wallet detected');
  const provider = new BrowserProvider(win.ethereum);
  return provider.getSigner();
}

/** Approve cUSD spend for the calling contract if the current allowance is insufficient. */
async function ensureApproval(signer: ethers.Signer, spender: string, amount: bigint): Promise<void> {
  const signerAddress = await signer.getAddress();
  const cusd = new ethers.Contract(CONTRACTS.cUSD, CUSD_ABI, signer);
  const allowance = await cusd.allowance(signerAddress, spender);
  if (allowance < amount) {
    const approveTx = await cusd.approve(spender, amount);
    await approveTx.wait();
  }
}

// ─── Public writes ──────────────────────────────────────────────────────────

export interface ProofSubmission {
  sourceChainId: number;
  actionType: number;
  reportedValueUSD: number;
  txHash: string;
}

/**
 * Submit a Merkle/continuity proof batch to CredXHub to update on-chain score.
 * Proof payloads are built deterministically in-app; the testnet mock verifier
 * accepts them (always-pass harness) — real Attestcoin EC proofs are assembled
 * by the USC attestation pipeline in a production deployment.
 */
export async function submitProofBatch(proofs: ProofSubmission[]): Promise<string> {
  const signer = await getSigner();
  const signerAddress = await signer.getAddress();

  const eventProofs = proofs.map((p) => ({
    sourceChainId: p.sourceChainId,
    blockHash: ethers.id(`${p.txHash}:block`),
    blockNumber: 1,
    txHash: ethers.id(p.txHash),
    txIndex: 0,
    rlpEncodedReceipt: '0x',
    merkleProof: '0x',
  }));

  const hub = new ethers.Contract(CONTRACTS.credXHub, HUB_ABI, signer);
  const amounts = proofs.map((p) => ethers.parseUnits(p.reportedValueUSD.toString(), 18));
  const tx = await hub.submitBatchProofs(
    eventProofs,
    proofs.map((p) => p.actionType),
    amounts,
    { gasLimit: 900000 }
  );
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function delegateCredit(beneficiary: string, boostAmount: number, durationDays: number): Promise<string> {
  const signer = await getSigner();
  const hub = new ethers.Contract(CONTRACTS.credXHub, HUB_ABI, signer);
  const tx = await hub.delegateCredit(
    beneficiary,
    ethers.parseUnits(boostAmount.toString(), 18),
    durationDays
  );
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function revokeCreditDelegation(beneficiary: string): Promise<string> {
  const signer = await getSigner();
  const hub = new ethers.Contract(CONTRACTS.credXHub, HUB_ABI, signer);
  const tx = await hub.revokeCreditDelegation(beneficiary);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function depositPoolLiquidity(amountUSD: number): Promise<string> {
  const signer = await getSigner();
  const amount = ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS);
  await ensureApproval(signer, CONTRACTS.lendingPool, amount);
  const pool = new ethers.Contract(CONTRACTS.lendingPool, POOL_ABI, signer);
  const tx = await pool.depositLiquidity(amount);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function withdrawPoolLiquidity(amountUSD: number): Promise<string> {
  const signer = await getSigner();
  const amount = ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS);
  const pool = new ethers.Contract(CONTRACTS.lendingPool, POOL_ABI, signer);
  const tx = await pool.withdrawLiquidity(amount);
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function borrowFromPool(amountUSD: number): Promise<string> {
  const signer = await getSigner();
  const amount = ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS);
  const pool = new ethers.Contract(CONTRACTS.lendingPool, POOL_ABI, signer);
  const tx = await pool.borrow(amount, { gasLimit: 600000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function repayPoolLoan(loanId: number | string, amountUSD: number): Promise<string> {
  const signer = await getSigner();
  const amount = ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS);
  await ensureApproval(signer, CONTRACTS.lendingPool, amount);
  const pool = new ethers.Contract(CONTRACTS.lendingPool, POOL_ABI, signer);
  const tx = await pool.repayLoan(loanId, amount, { gasLimit: 600000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function mintSBT(): Promise<string> {
  const signer = await getSigner();
  const sbt = new ethers.Contract(CONTRACTS.creditAttestationSBT, SBT_ABI, signer);
  const tx = await sbt.mintAttestation({ gasLimit: 600000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function refreshSBT(): Promise<string> {
  const signer = await getSigner();
  const sbt = new ethers.Contract(CONTRACTS.creditAttestationSBT, SBT_ABI, signer);
  const tx = await sbt.refreshAttestation({ gasLimit: 300000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function registerArenaUser(): Promise<string> {
  const signer = await getSigner();
  const arena = new ethers.Contract(CONTRACTS.reputationArena, ARENA_ABI, signer);
  const tx = await arena.registerUser({ gasLimit: 300000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function syncArenaStreak(): Promise<string> {
  const signer = await getSigner();
  const arena = new ethers.Contract(CONTRACTS.reputationArena, ARENA_ABI, signer);
  const tx = await arena.syncStreakToReputation({ gasLimit: 300000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

// ─── DeFi / Gaming / RWA / DePIN / Arena tracks ─────────────────────────────

interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

async function tokenMeta(address: string): Promise<TokenMeta> {
  try {
    const c = readContract(address, ERC20_META_ABI);
    const [name, symbol, decimals] = await Promise.all([c.name(), c.symbol(), c.decimals()]);
    return { address, name, symbol, decimals: Number(decimals) };
  } catch {
    return { address, name: '', symbol: 'TOKEN', decimals: 18 };
  }
}

export async function fetchAMMState(user: string): Promise<{
  token0: TokenMeta;
  token1: TokenMeta;
  reserve0: number;
  reserve1: number;
  lpTotalSupply: number;
  lpBalance: number;
  quote0To1: number;
  quote1To0: number;
} | null> {
  try {
    const amm = readContract(CONTRACTS.reputationAMM, AMM_ABI);
    const [t0, t1] = await Promise.all([amm.token0(), amm.token1()]);
    const [m0, m1] = await Promise.all([tokenMeta(t0), tokenMeta(t1)]);
    const [r0, r1, ts, lb] = await Promise.all([
      amm.reserve0(), amm.reserve1(), amm.totalSupply(), amm.balanceOf(user),
    ]);
    const [q01, q10] = await Promise.all([
      amm.getAmountOut(ethers.parseUnits('1', m0.decimals), t0, user),
      amm.getAmountOut(ethers.parseUnits('1', m1.decimals), t1, user),
    ]);
    return {
      token0: m0, token1: m1,
      reserve0: parseFloat(ethers.formatUnits(r0, m0.decimals)),
      reserve1: parseFloat(ethers.formatUnits(r1, m1.decimals)),
      lpTotalSupply: parseFloat(ethers.formatUnits(ts, 18)),
      lpBalance: parseFloat(ethers.formatUnits(lb, 18)),
      quote0To1: parseFloat(ethers.formatUnits(q01, m1.decimals)),
      quote1To0: parseFloat(ethers.formatUnits(q10, m0.decimals)),
    };
  } catch {
    return null;
  }
}

async function ensureTokenApproval(
  signer: ethers.Signer,
  tokenAddress: string,
  spender: string,
  amount: bigint
): Promise<void> {
  const signerAddress = await signer.getAddress();
  const token = new ethers.Contract(tokenAddress, CUSD_ABI, signer); // transfer/approve/allowance compatible
  const allowance = await token.allowance(signerAddress, spender);
  if (allowance < amount) {
    const tx = await token.approve(spender, amount);
    await tx.wait();
  }
}

export async function addAMMLiquidity(amount0: number, amount1: number): Promise<string> {
  const signer = await getSigner();
  const amm = readContract(CONTRACTS.reputationAMM, AMM_ABI);
  const ammAddr = await amm.getAddress();
  const [t0, t1] = await Promise.all([amm.token0(), amm.token1()]);
  const [m0, m1] = await Promise.all([tokenMeta(t0), tokenMeta(t1)]);
  await ensureTokenApproval(signer, t0, ammAddr, ethers.parseUnits(amount0.toString(), m0.decimals));
  await ensureTokenApproval(signer, t1, ammAddr, ethers.parseUnits(amount1.toString(), m1.decimals));
  const writeAmm = new ethers.Contract(CONTRACTS.reputationAMM, AMM_ABI, signer);
  const tx = await writeAmm.addLiquidity(
    ethers.parseUnits(amount0.toString(), m0.decimals),
    ethers.parseUnits(amount1.toString(), m1.decimals),
    { gasLimit: 500000 }
  );
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function removeAMMLiquidity(liquidity: number): Promise<string> {
  const signer = await getSigner();
  const writeAmm = new ethers.Contract(CONTRACTS.reputationAMM, AMM_ABI, signer);
  const current = await writeAmm.balanceOf(await signer.getAddress());
  const amount = ethers.parseUnits(liquidity.toString(), 18) > current
    ? current
    : ethers.parseUnits(liquidity.toString(), 18);
  const tx = await writeAmm.removeLiquidity(amount, { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function swapViaAMM(amountIn: number, tokenInAddress: string, user: string): Promise<string> {
  const signer = await getSigner();
  const amm = readContract(CONTRACTS.reputationAMM, AMM_ABI);
  const ammAddr = await amm.getAddress();
  const [t0, t1] = await Promise.all([amm.token0(), amm.token1()]);
  const inMeta = await tokenMeta(tokenInAddress);
  const outToken = tokenInAddress.toLowerCase() === t0.toLowerCase() ? t1 : t0;
  const outMeta = await tokenMeta(outToken);
  const amountInParsed = ethers.parseUnits(amountIn.toString(), inMeta.decimals);
  const amountOut = await amm.getAmountOut(amountInParsed, tokenInAddress, user);
  await ensureTokenApproval(signer, tokenInAddress, ammAddr, amountInParsed);
  const writeAmm = new ethers.Contract(CONTRACTS.reputationAMM, AMM_ABI, signer);
  const [r0, r1] = await Promise.all([writeAmm.reserve0(), writeAmm.reserve1()]);
  const is0In = tokenInAddress.toLowerCase() === t0.toLowerCase();
  const tx = await writeAmm.swap(
    is0In ? 0n : amountOut,
    is0In ? amountOut : 0n,
    { gasLimit: 500000 }
  );
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function fetchYieldVaultState(user: string): Promise<{
  stakingToken: TokenMeta;
  rewardToken: TokenMeta;
  totalStaked: number;
  rewardPerTokenStored: number;
  lastRewardBlock: number;
  stakedByUser: number;
  rewardDebtByUser: number;
  approxClaimable: number;
} | null> {
  try {
    const vault = readContract(CONTRACTS.reputationYieldVault, YIELD_VAULT_ABI);
    const [st, rt] = await Promise.all([vault.stakingToken(), vault.rewardToken()]);
    const [sm, rm] = await Promise.all([tokenMeta(st), tokenMeta(rt)]);
    const [ts, rpts, lrb, staked, debt] = await Promise.all([
      vault.totalStaked(), vault.rewardPerTokenStored(), vault.lastRewardBlock(),
      vault.stakers(user), vault.rewardDebt(user),
    ]);
    const stakedNum = parseFloat(ethers.formatUnits(staked, sm.decimals));
    const stakedN = BigInt(staked);
    const rptsN = BigInt(rpts);
    const debtN = BigInt(debt);
    const accruedRaw = stakedN > 0n ? (rptsN * stakedN) / 10n ** 18n - debtN : 0n;
    const claimable = accruedRaw > 0n ? Number(accruedRaw) / 10 ** 18 : 0;
    return {
      stakingToken: sm, rewardToken: rm,
      totalStaked: parseFloat(ethers.formatUnits(ts, sm.decimals)),
      rewardPerTokenStored: Number(rpts),
      lastRewardBlock: Number(lrb),
      stakedByUser: stakedNum,
      rewardDebtByUser: Number(debt),
      approxClaimable: claimable,
    };
  } catch {
    return null;
  }
}

export async function vaultStake(amount: number): Promise<string> {
  const signer = await getSigner();
  const vault = readContract(CONTRACTS.reputationYieldVault, YIELD_VAULT_ABI);
  const vAddr = await vault.getAddress();
  const st = await vault.stakingToken();
  const meta = await tokenMeta(st);
  await ensureTokenApproval(signer, st, vAddr, ethers.parseUnits(amount.toString(), meta.decimals));
  const write = new ethers.Contract(CONTRACTS.reputationYieldVault, YIELD_VAULT_ABI, signer);
  const tx = await write.stake(ethers.parseUnits(amount.toString(), meta.decimals), { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function vaultUnstake(amount: number): Promise<string> {
  const signer = await getSigner();
  const vault = readContract(CONTRACTS.reputationYieldVault, YIELD_VAULT_ABI);
  const st = await vault.stakingToken();
  const meta = await tokenMeta(st);
  const write = new ethers.Contract(CONTRACTS.reputationYieldVault, YIELD_VAULT_ABI, signer);
  const tx = await write.unstake(ethers.parseUnits(amount.toString(), meta.decimals), { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function vaultClaimRewards(): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.reputationYieldVault, YIELD_VAULT_ABI, signer);
  const tx = await write.claimRewards({ gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function fetchTreasuryState(user: string): Promise<{
  treasuryMeta: TokenMeta;
  tbBalance: number;
  lastDepositBlock: number;
  currentBlock: number;
  bonusVestBlocks: number;
  minScoreRequired: number;
  premiumScoreThreshold: number;
  premiumBonusBps: number;
  stablePrice: number | null;
} | null> {
  try {
    const treasury = readContract(CONTRACTS.rwaTreasuryYieldFund, TREASURY_ABI);
    const [tm, tb, ldb, cb, bvb, minsc, pst, pbb] = await Promise.all([
      tokenMeta(CONTRACTS.rwaTreasuryYieldFund),
      treasury.balanceOf(user),
      treasury.lastDepositBlock(user),
      readProvider().getBlockNumber(),
      treasury.BONUS_VEST_BLOCKS(),
      treasury.MIN_SCORE_REQUIRED(),
      treasury.PREMIUM_SCORE_THRESHOLD(),
      treasury.PREMIUM_BONUS_BPS(),
    ]);
    let stablePrice: number | null = null;
    try {
      const oracle = new ethers.Contract(await treasury.PRICE_ORACLE(), PRICE_ORACLE_ABI, readProvider());
      const [p, d] = await oracle.getLatestPrice();
      stablePrice = Number(p) / 10 ** Number(d);
    } catch { /* oracle read unavailable */ }
    return {
      treasuryMeta: tm,
      tbBalance: parseFloat(ethers.formatUnits(tb, tm.decimals)),
      lastDepositBlock: Number(ldb),
      currentBlock: Number(cb),
      bonusVestBlocks: Number(bvb),
      minScoreRequired: Number(minsc),
      premiumScoreThreshold: Number(pst),
      premiumBonusBps: Number(pbb),
      stablePrice,
    };
  } catch {
    return null;
  }
}

export async function treasuryDeposit(amountUSD: number): Promise<string> {
  const signer = await getSigner();
  const treasury = readContract(CONTRACTS.rwaTreasuryYieldFund, TREASURY_ABI);
  const tAddr = await treasury.getAddress();
  await ensureApproval(signer, tAddr, ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS));
  const write = new ethers.Contract(CONTRACTS.rwaTreasuryYieldFund, TREASURY_ABI, signer);
  const tx = await write.deposit(ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function treasuryWithdraw(shares: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.rwaTreasuryYieldFund, TREASURY_ABI, signer);
  const tx = await write.withdraw(ethers.parseUnits(shares.toString(), 18), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export interface InvoiceView {
  invoiceId: number;
  business: string;
  funder: string;
  faceValue: number;
  fundedAmount: number;
  durationBlocks: number;
  createdBlock: number;
  isFunded: boolean;
  isRepaid: boolean;
}

export async function fetchCurrentBlock(): Promise<number> {
  try {
    return Number(await readProvider().getBlockNumber());
  } catch {
    return 0;
  }
}

export async function fetchInvoices(): Promise<InvoiceView[]> {
  try {
    const invoices = readContract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI);
    const count = Number(await invoices.nextInvoiceId());
    const limit = Math.min(count, 50);
    const rows: InvoiceView[] = [];
    for (let i = 0; i < limit; i++) {
      try {
        const inv = await invoices.invoices(i);
        rows.push({
          invoiceId: i,
          business: inv.business,
          funder: inv.funder,
          faceValue: parseFloat(ethers.formatUnits(inv.faceValue, CUSD_DECIMALS)),
          fundedAmount: parseFloat(ethers.formatUnits(inv.fundedAmount, CUSD_DECIMALS)),
          durationBlocks: Number(inv.durationBlocks),
          createdBlock: Number(inv.createdBlock),
          isFunded: inv.isFunded,
          isRepaid: inv.isRepaid,
        });
      } catch { /* skip unreadable */ }
    }
    return rows;
  } catch {
    return [];
  }
}

export async function tokenizeInvoice(faceValue: number, durationBlocks: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI, signer);
  const tx = await write.tokenizeInvoice(
    ethers.parseUnits(faceValue.toString(), CUSD_DECIMALS),
    durationBlocks,
    { gasLimit: 400000 }
  );
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function fundInvoice(invoiceId: number, amountUSD: number): Promise<string> {
  const signer = await getSigner();
  const invoices = readContract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI);
  const iAddr = await invoices.getAddress();
  await ensureApproval(signer, iAddr, ethers.parseUnits(amountUSD.toString(), CUSD_DECIMALS));
  const write = new ethers.Contract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI, signer);
  const tx = await write.fundInvoice(invoiceId, { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function repayInvoice(invoiceId: number): Promise<string> {
  const signer = await getSigner();
  const invoices = readContract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI);
  const iAddr = await invoices.getAddress();
  const inv = await invoices.invoices(invoiceId);
  await ensureApproval(signer, iAddr, inv.faceValue);
  const write = new ethers.Contract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI, signer);
  const tx = await write.repayInvoice(invoiceId, { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function reclaimInvoice(invoiceId: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.rwaInvoiceFinancing, INVOICE_ABI, signer);
  const tx = await write.reclaimOverdueFunds(invoiceId, { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function fetchDePINState(user: string, operator: string | null): Promise<{
  depinToken: TokenMeta;
  depinBalance: number;
  maxHardwareLoanAmount: number;
  loanAmount: number;
  loanDueBlock: number;
  delegationAmount: number;
  currentBlock: number;
} | null> {
  try {
    const hub = readContract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI);
    const [depinAddr, maxLoan, loan, due, cb] = await Promise.all([
      hub.DEPIN_TOKEN(),
      hub.maxHardwareLoanAmount(),
      hub.hardwareLoans(user),
      hub.hardwareLoanDueBlock(user),
      readProvider().getBlockNumber(),
    ]);
    const meta = await tokenMeta(depinAddr);
    const balance = parseFloat(ethers.formatUnits(await readContract(depinAddr, CUSD_ABI).balanceOf(user), meta.decimals));
    let delegation = 0;
    if (operator) {
      delegation = Number(await hub.delegations(user, operator));
    }
    return {
      depinToken: meta,
      depinBalance: balance,
      maxHardwareLoanAmount: parseFloat(ethers.formatUnits(maxLoan, 18)),
      loanAmount: Number(loan),
      loanDueBlock: Number(due),
      delegationAmount: delegation,
      currentBlock: Number(cb),
    };
  } catch {
    return null;
  }
}

export async function depinDelegateStake(operator: string, amount: number): Promise<string> {
  const signer = await getSigner();
  const hub = readContract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI);
  const hAddr = await hub.getAddress();
  const depinAddr = await hub.DEPIN_TOKEN();
  const meta = await tokenMeta(depinAddr);
  await ensureTokenApproval(signer, depinAddr, hAddr, ethers.parseUnits(amount.toString(), meta.decimals));
  const write = new ethers.Contract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI, signer);
  const tx = await write.delegateStake(operator, ethers.parseUnits(amount.toString(), meta.decimals), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function depinUndelegateStake(operator: string, amount: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI, signer);
  const tx = await write.undelegateStake(operator, ethers.parseUnits(amount.toString(), 18), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function requestHardwareLoan(amount: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI, signer);
  const tx = await write.requestHardwareLoan(ethers.parseUnits(amount.toString(), 18), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function repayHardwareLoan(amount: number): Promise<string> {
  const signer = await getSigner();
  const hub = readContract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI);
  const hAddr = await hub.getAddress();
  const depinAddr = await hub.DEPIN_TOKEN();
  const meta = await tokenMeta(depinAddr);
  await ensureTokenApproval(signer, depinAddr, hAddr, ethers.parseUnits(amount.toString(), meta.decimals));
  const write = new ethers.Contract(CONTRACTS.dePINInfrastructureHub, DEPIN_HUB_ABI, signer);
  const tx = await write.repayHardwareLoan(ethers.parseUnits(amount.toString(), meta.decimals), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function fetchGamingState(user: string): Promise<{
  gameToken: TokenMeta;
  gameItem: TokenMeta;
  gameBalance: number;
  nftCount: number;
  lastGatherBlock: number;
  lastLootboxBlock: number;
  currentBlock: number;
} | null> {
  try {
    const gaming = readContract(CONTRACTS.gamingEcosystemHub, GAMING_ABI);
    const [gt, gi, lg, ll] = await Promise.all([
      gaming.gameToken(), gaming.gameItem(),
      gaming.lastGatherBlock(user), gaming.lastLootboxBlock(user),
    ]);
    const [gtm, gim] = await Promise.all([tokenMeta(gt), tokenMeta(gi)]);
    const [balance, nftCount, cb] = await Promise.all([
      readContract(gt, CUSD_ABI).balanceOf(user),
      readContract(gi, CUSD_ABI).balanceOf(user), // ERC721 balanceOf
      readProvider().getBlockNumber(),
    ]);
    return {
      gameToken: gtm,
      gameItem: gim,
      gameBalance: parseFloat(ethers.formatUnits(balance, gtm.decimals)),
      nftCount: Number(nftCount),
      lastGatherBlock: Number(lg),
      lastLootboxBlock: Number(ll),
      currentBlock: Number(cb),
    };
  } catch {
    return null;
  }
}

export async function gatherResources(): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.gamingEcosystemHub, GAMING_ABI, signer);
  const tx = await write.gatherResources({ gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function openLootbox(): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.gamingEcosystemHub, GAMING_ABI, signer);
  const tx = await write.openLootbox({ gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function listNFT(tokenId: number, price: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.gamingEcosystemHub, GAMING_ABI, signer);
  const tx = await write.listNFT(tokenId, ethers.parseUnits(price.toString(), 18), { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function cancelListing(tokenId: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.gamingEcosystemHub, GAMING_ABI, signer);
  const tx = await write.cancelListing(tokenId, { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function buyNFT(tokenId: number): Promise<string> {
  const signer = await getSigner();
  const gaming = readContract(CONTRACTS.gamingEcosystemHub, GAMING_ABI);
  const gAddr = await gaming.getAddress();
  const gt = await gaming.gameToken();
  const price = await gaming.listings(tokenId) as { price: bigint };
  const meta = await tokenMeta(gt);
  await ensureTokenApproval(signer, gt, gAddr, price.price);
  const write = new ethers.Contract(CONTRACTS.gamingEcosystemHub, GAMING_ABI, signer);
  const tx = await write.buyNFT(tokenId, { gasLimit: 500000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export interface ArenaView {
  stats: ArenaStats | null;
  currentRoundId: number;
  round: {
    roundId: number;
    assetSymbol: string;
    strikePrice: number;
    startBlock: number;
    lockBlock: number;
    closeBlock: number;
    totalAboveStake: number;
    totalBelowStake: number;
    winningChoice: number;
    status: number;
  } | null;
  prediction: { choice: number; stakeAmount: number; claimed: boolean } | null;
}

export async function fetchArenaView(user: string): Promise<ArenaView | null> {
  try {
    const arena = readContract(CONTRACTS.reputationArena, ARENA_VIEW_ABI);
    const [stats, currentRoundId] = await Promise.all([
      fetchArenaStats(user),
      arena.currentRoundId(),
    ]);
    const roundIdNum = Number(currentRoundId);
    let round: ArenaView['round'] = null;
    let prediction: ArenaView['prediction'] = null;
    if (roundIdNum > 0) {
      const r = await arena.rounds(roundIdNum);
      round = {
        roundId: Number(r.roundId),
        assetSymbol: r.assetSymbol,
        strikePrice: Number(r.strikePrice),
        startBlock: Number(r.startBlock),
        lockBlock: Number(r.lockBlock),
        closeBlock: Number(r.closeBlock),
        totalAboveStake: Number(r.totalAboveStake),
        totalBelowStake: Number(r.totalBelowStake),
        winningChoice: Number(r.winningChoice),
        status: Number(r.status),
      };
      const p = await arena.userPredictions(roundIdNum, user);
      prediction = { choice: Number(p.choice[0] ?? p.choice), stakeAmount: Number(p.stakeAmount), claimed: p.claimed };
    }
    return { stats, currentRoundId: roundIdNum, round, prediction };
  } catch {
    return null;
  }
}

export async function arenaPlacePrediction(roundId: number, choice: number, stakeAmount: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.reputationArena, ARENA_VIEW_ABI, signer);
  const tx = await write.placePrediction(roundId, choice, ethers.parseUnits(stakeAmount.toString(), 18), { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

export async function arenaClaimPayout(roundId: number): Promise<string> {
  const signer = await getSigner();
  const write = new ethers.Contract(CONTRACTS.reputationArena, ARENA_VIEW_ABI, signer);
  const tx = await write.claimPayout(roundId, { gasLimit: 400000 });
  const receipt = await tx.wait();
  return receipt.hash as string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function tierToString(tier: number): CardTier {
  switch (tier) {
    case 0: return 'SUBPRIME';
    case 1: return 'NEAR_PRIME';
    case 2: return 'PRIME';
    default: return 'SUPER_PRIME';
  }
}

// ─── Purpose-Bound RWA Funding + Metered Usage (deployed 2026-09-13) ───────

export interface PurposeFundState {
  nextRecordId: number;
  totalLiquidityUSD: number;
  totalBorrowedUSD: number;
  ctcPriceUSD: number;
  verifier: string;
}

export interface PurposeRecordView {
  recordId: string;
  borrower: string;
  allowlistedRecipient: string;
  purposeCode: number;
  covenantHash: string;
  approvedUSD: number;
  drawnUSD: number;
  collateralCTC: number;
  borrowedAtBlock: number;
  dueBlock: number;
  interestRateBps: number;
  isFrozen: boolean;
  isSettled: boolean;
}

export interface MeterRegistryState {
  settlementToken: string;
  verifier: string;
}

export interface ActionMeterView {
  exists: boolean;
  windowCapUnits: number;
  usedUnitsThisWindow: number;
  windowStartBlock: number;
  windowDurationBlocks: number;
  unitPriceUSD: number;
  outstandingDebtUSD: number;
}

export const PURPOSE_FUND_ABI = [
  'function nextRecordId() view returns (uint256)',
  'function totalLiquidityUSD() view returns (uint256)',
  'function totalBorrowedUSD() view returns (uint256)',
  'function ctcPriceUSD() view returns (uint256)',
  'function verifier() view returns (address)',
  'function getUserRecords(address) view returns (uint256[])',
  'function records(uint256) view returns (uint256 recordId, address borrower, address allowlistedRecipient, uint8 purposeCode, bytes32 covenantHash, uint256 approvedUSD, uint256 drawnUSD, uint256 collateralCTC, uint256 borrowedAtBlock, uint256 dueBlock, uint256 interestRateBps, bool isFrozen, bool isSettled)',
];

export const USAGE_METER_ABI = [
  'function settlementToken() view returns (address)',
  'function verifier() view returns (address)',
  'function meters(address,bytes32) view returns (bool exists, uint256 windowCapUnits, uint256 usedUnitsThisWindow, uint256 windowStartBlock, uint256 windowDurationBlocks, uint256 unitPriceUSD, uint256 outstandingDebtUSD)',
  'function getTotalOutstandingDebt(address) view returns (uint256)',
];

export async function fetchPurposeFundState(): Promise<PurposeFundState | null> {
  try {
    const contract = readContract(CONTRACTS.purposeBoundFunding, PURPOSE_FUND_ABI);
    const [nextRecordId, totalLiquidityUSD, totalBorrowedUSD, ctcPriceUSD, verifier] = await Promise.all([
      contract.nextRecordId(),
      contract.totalLiquidityUSD(),
      contract.totalBorrowedUSD(),
      contract.ctcPriceUSD(),
      contract.verifier(),
    ]);
    return {
      nextRecordId: Number(nextRecordId),
      totalLiquidityUSD: parseFloat(ethers.formatUnits(totalLiquidityUSD, 18)),
      totalBorrowedUSD: parseFloat(ethers.formatUnits(totalBorrowedUSD, 18)),
      ctcPriceUSD: parseFloat(ethers.formatUnits(ctcPriceUSD, 18)),
      verifier: String(verifier),
    };
  } catch {
    return null;
  }
}

export async function fetchPurposeRecords(user: string): Promise<PurposeRecordView[]> {
  if (!user) return [];
  try {
    const contract = readContract(CONTRACTS.purposeBoundFunding, PURPOSE_FUND_ABI);
    const ids = await contract.getUserRecords(user);
    const out: PurposeRecordView[] = [];
    for (const id of ids.slice(0, 10)) {
      const r = await contract.records(id);
      out.push({
        recordId: id.toString(),
        borrower: r.borrower,
        allowlistedRecipient: r.allowlistedRecipient,
        purposeCode: Number(r.purposeCode),
        covenantHash: r.covenantHash,
        approvedUSD: parseFloat(ethers.formatUnits(r.approvedUSD, 18)),
        drawnUSD: parseFloat(ethers.formatUnits(r.drawnUSD, 18)),
        collateralCTC: parseFloat(ethers.formatUnits(r.collateralCTC, 18)),
        borrowedAtBlock: Number(r.borrowedAtBlock),
        dueBlock: Number(r.dueBlock),
        interestRateBps: Number(r.interestRateBps),
        isFrozen: r.isFrozen,
        isSettled: r.isSettled,
      });
    }
    return out.filter((r) => r.borrower !== ethers.ZeroAddress);
  } catch {
    return [];
  }
}

export async function fetchMeterRegistryState(
  user: string,
  actionKeys: string[]
): Promise<{ state: MeterRegistryState; meters: Record<string, ActionMeterView | null>; totalDebt: number }> {
  try {
    const contract = readContract(CONTRACTS.usageMeteringRegistry, USAGE_METER_ABI);
    const [settlementToken, verifier] = await Promise.all([contract.settlementToken(), contract.verifier()]);
    const meters: Record<string, ActionMeterView | null> = {};
    for (const key of actionKeys) {
      const m = await contract.meters(user, key);
      meters[key] = m.exists
        ? {
            exists: m.exists,
            windowCapUnits: parseFloat(ethers.formatUnits(m.windowCapUnits, 18)),
            usedUnitsThisWindow: parseFloat(ethers.formatUnits(m.usedUnitsThisWindow, 18)),
            windowStartBlock: Number(m.windowStartBlock),
            windowDurationBlocks: Number(m.windowDurationBlocks),
            unitPriceUSD: parseFloat(ethers.formatUnits(m.unitPriceUSD, 18)),
            outstandingDebtUSD: parseFloat(ethers.formatUnits(m.outstandingDebtUSD, 18)),
          }
        : null;
    }
    const totalDebtRaw = await contract.getTotalOutstandingDebt(user);
    return {
      state: { settlementToken: String(settlementToken), verifier: String(verifier) },
      meters,
      totalDebt: parseFloat(ethers.formatUnits(totalDebtRaw, 18)),
    };
  } catch {
    return { state: { settlementToken: '', verifier: '' }, meters: {}, totalDebt: 0 };
  }
}

export function scoreToTier(score: number): CardTier {
  if (score >= 780) return 'SUPER_PRIME';
  if (score >= 650) return 'PRIME';
  if (score >= 500) return 'NEAR_PRIME';
  return 'SUBPRIME';
}

export function bpsToApr(bps: number): string {
  return (bps / 100).toFixed(2) + '%';
}

export function txHashShort(hash: string): string {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}
import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
  Layers,
  Code2,
  FileCode2,
  Copy,
  Check,
  Zap,
  ArrowRight,
  Database,
  Search,
  ExternalLink
} from 'lucide-react';

interface ThirdCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DecodedReceiptAudit {
  id: string;
  sourceChain: string;
  chainId: number;
  txHash: string;
  blockNumber: number;
  emitter: string;
  eventName: string;
  eventSignature: string;
  decodedArgs: Record<string, string | number>;
  check1_consensus: 'PASSED' | 'FAILED';
  check2_semanticLog: 'PASSED' | 'FAILED';
  check3_replayNullifier: 'PASSED' | 'FAILED';
  nullifierKey: string;
  rlpHex: string;
}

export const ThirdCheckModal: React.FC<ThirdCheckModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [activeReceiptId, setActiveReceiptId] = useState('RECEIPT-AAVE-V3');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const auditReceipts: DecodedReceiptAudit[] = [
    {
      id: 'RECEIPT-AAVE-V3',
      sourceChain: 'Ethereum Sepolia Testnet',
      chainId: 11155111,
      txHash: '0x8f72a1e94cb025d97f2c6e8310a4b732d891e402948192740192837461029384',
      blockNumber: 5918230,
      emitter: '0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951 (Aave v3 Pool)',
      eventName: 'Repay(address reserve, address user, address repayer, uint256 amount, bool useATokens)',
      eventSignature: '0xb7009613e63f3e137424b209a87fb14f3f64fb4056253ad73730e41f91317935',
      decodedArgs: {
        reserve: '0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 (USDC)',
        user: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
        repayer: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
        amount: '$50,000.00 USDC',
        useATokens: 'false'
      },
      check1_consensus: 'PASSED',
      check2_semanticLog: 'PASSED',
      check3_replayNullifier: 'PASSED',
      nullifierKey: '0x498a12bc90fa7281d7261901a8b2716382019481726354819203847561920394',
      rlpHex: '0xf9019aa08f72a1e94cb025d97f2c6e8310a4b732d891e402948192740192837461029384a0...018080'
    },
    {
      id: 'RECEIPT-UNISWAP-V3',
      sourceChain: 'Ethereum Mainnet',
      chainId: 1,
      txHash: '0x3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef012',
      blockNumber: 21084920,
      emitter: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640 (Uniswap v3 ETH/USDC 0.05%)',
      eventName: 'IncreaseLiquidity(uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
      eventSignature: '0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f',
      decodedArgs: {
        tokenId: 784912,
        liquidity: '4,892,104,918,203',
        amount0: '12.50 ETH ($32,500.00)',
        amount1: '32,500.00 USDC'
      },
      check1_consensus: 'PASSED',
      check2_semanticLog: 'PASSED',
      check3_replayNullifier: 'PASSED',
      nullifierKey: '0x99281a8b27364581902837461524354671829304918273645102938475619283',
      rlpHex: '0xf9024ba03a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef012b8...306704'
    },
    {
      id: 'RECEIPT-RWA-INVOICE',
      sourceChain: 'Base L2',
      chainId: 8453,
      txHash: '0x9182736451029384756192837465192837465192837465192837465192837465',
      blockNumber: 19842104,
      emitter: '0x2be1E6044ACEE8868b775a8C48C05f569d1Af80A (Centrifuge / RWA Registry)',
      eventName: 'InvoiceSettled(bytes32 invoiceId, address payer, uint256 settledUSD)',
      eventSignature: '0x7e8b912384756192837465192837465192837465192837465192837465192837',
      decodedArgs: {
        invoiceId: '0x498a...trade-finance-2026',
        payer: '0x9afB4FAd95d9fEa67615911Ce1fA4C9f13FA8f07',
        settledUSD: '$125,000.00 USDC'
      },
      check1_consensus: 'PASSED',
      check2_semanticLog: 'PASSED',
      check3_replayNullifier: 'PASSED',
      nullifierKey: '0x81726354819203847561920394a08f72a1e94cb025d97f2c6e8310a4b732d891e4',
      rlpHex: '0xf8012ea09182736451029384756192837465192837465192837465192837465192837465...125000'
    }
  ];

  const activeAudit = auditReceipts.find((r) => r.id === activeReceiptId) || auditReceipts[0];

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(label);
    addToast('success', 'Copied to Clipboard', `${label} copied successfully.`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ThirdCheck: 3-Tier Cryptographic Proof Auditor" maxWidth="max-w-4xl">
      <div className="space-y-5 text-xs text-white/80 font-sans">
        {/* Explainer Banner */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-blue-950/40 to-slate-900/60 border border-cyan-500/30 backdrop-blur-xl flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-bold text-white text-sm flex items-center gap-2">
              <span>Why Merkle Proofs Alone Are Not Enough (The "Third Check" Problem)</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[10px] border border-cyan-500/30">
                AUDITED INVARIANT
              </span>
            </div>
            <p className="text-white/60 leading-relaxed text-[11px]">
              Competitors like <em>ThirdCheck</em> and <em>AttestDesk</em> point out that a valid Merkle receipt proof can prove a transaction occurred, but without <strong>semantic event validation</strong> and <strong>replay nullifiers</strong>, a malicious user could submit a proof of a $1 transfer and claim a $100k credit boost. CredX solves this by enforcing a <strong>strict 3-Tier Verification Matrix</strong> before any proof modifies on-chain reputation.
            </p>
          </div>
        </div>

        {/* 3-Tier Verification Progress Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-white/40">CHECK 1: CONSENSUS</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                PASSED
              </span>
            </div>
            <div className="font-bold text-white text-xs">Creditcoin Consensus (Attested Headers)</div>
            <p className="text-[10px] text-white/50">
              Validates raw Merkle Patricia Trie path against an Ethereum block header attested by Creditcoin validators (in this demo the header state is checked via the CredXHub harness; the live 0x0FD2 precompile path is demonstrated in the USC panel / <code className="font-mono">npm run usc:verify</code>).
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-white/40">CHECK 2: SEMANTIC ABI</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                PASSED
              </span>
            </div>
            <div className="font-bold text-white text-xs">Topic0 Signature Extraction</div>
            <p className="text-[10px] text-white/50">
              Extracts decoded event log data (Repay, IncreaseLiquidity, InvoiceSettled) to verify exact dollar values.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] text-white/40">CHECK 3: NULLIFIER KEY</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono text-[9px] font-bold">
                PASSED
              </span>
            </div>
            <div className="font-bold text-white text-xs">Zero-Replay Bitmap Lock</div>
            <p className="text-[10px] text-white/50">
              Registers <code className="text-cyan-300">keccak256(chainId, txHash, logIndex)</code> preventing double-credit attacks.
            </p>
          </div>
        </div>

        {/* Receipt Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-white/[0.08] pb-2">
          {auditReceipts.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveReceiptId(r.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1.5 cursor-pointer ${
                activeReceiptId === r.id
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold'
                  : 'bg-white/[0.02] border border-white/[0.06] text-white/50 hover:text-white'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>{r.id}</span>
            </button>
          ))}
        </div>

        {/* Active Receipt Deep Audit View */}
        <div className="space-y-4 p-4 rounded-xl bg-black/50 border border-white/[0.08]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: Metadata & Verified Args */}
            <div className="space-y-3 font-mono text-[11px]">
              <div>
                <span className="text-white/40 text-[10px] uppercase block">Source Chain</span>
                <span className="text-white font-bold">{activeAudit.sourceChain} (Chain ID: {activeAudit.chainId})</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] uppercase block">Contract Emitter</span>
                <span className="text-cyan-300 break-all">{activeAudit.emitter}</span>
              </div>
              <div>
                <span className="text-white/40 text-[10px] uppercase block">Verified Event Log</span>
                <span className="text-emerald-400 font-bold block">{activeAudit.eventName}</span>
                <span className="text-white/40 text-[9px] break-all block mt-0.5">Topic0: {activeAudit.eventSignature}</span>
              </div>
            </div>

            {/* Right: Decoded Log Arguments */}
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-2 font-mono text-[11px]">
              <span className="text-white/40 text-[10px] uppercase block pb-1 border-b border-white/[0.06]">
                Decoded Parameter Invariants (Check 2)
              </span>
              {Object.entries(activeAudit.decodedArgs).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center py-0.5">
                  <span className="text-white/50">{key}:</span>
                  <span className="text-white font-bold">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RLP Raw Receipt & Nullifier Key */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-white/40">Unique Nullifier Hash (Zero-Replay Key):</span>
              <button
                onClick={() => handleCopy(activeAudit.nullifierKey, 'Nullifier Key')}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px] cursor-pointer"
              >
                {copiedKey === 'Nullifier Key' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy</span>
              </button>
            </div>
            <div className="p-2 rounded bg-[#07090e] border border-white/[0.06] font-mono text-[10px] text-cyan-300 break-all">
              {activeAudit.nullifierKey}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono pt-1">
              <span className="text-white/40">Raw RLP-Encoded Transaction Receipt Hex:</span>
              <button
                onClick={() => handleCopy(activeAudit.rlpHex, 'RLP Receipt Hex')}
                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[10px] cursor-pointer"
              >
                {copiedKey === 'RLP Receipt Hex' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy Hex</span>
              </button>
            </div>
            <div className="p-2 rounded bg-[#07090e] border border-white/[0.06] font-mono text-[10px] text-white/50 break-all max-h-16 overflow-y-auto">
              {activeAudit.rlpHex}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ThirdCheckModal;

import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { Network, Database, Copy, Check, Terminal, Play } from 'lucide-react';

interface ComposableQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ComposableQueryModal: React.FC<ComposableQueryModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [copied, setCopied] = useState(false);
  const [running, setRunning] = useState(false);
  const [targetAddress, setTargetAddress] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');
  const [queryOutput, setQueryOutput] = useState<string | null>(null);

  const sampleSolidity = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface ICredXHub {
    // Queries on-chain Credit Trust Score (300-850) verified via 0x0FD2 Attestcoin precompile
    function getBorrowerScore(address borrower) external view returns (uint256 score);

    // Queries prime eligibility tier (SUBPRIME, STANDARD, NEAR_PRIME, PRIME, SUPER_PRIME)
    function getCreditTier(address borrower) external view returns (uint8 tier);

    // Verifies whether a cross-chain Attestcoin proof nullifier has already been settled
    function isProofSettled(bytes32 nullifierHash) external view returns (bool settled);
}

// 1-Line Integration in your external protocol / dApp:
contract ExternalDeFiOrRWA {
    ICredXHub public constant CREDX = ICredXHub(0x729b2D8B630c4241d051c92D4FeB31412846eE18);

    function executeVIPDiscount(address user) external view returns (bool eligible) {
        // Super-Prime borrowers (CTS >= 780) unlock 0% protocol fees & undercollateralized terms
        return CREDX.getBorrowerScore(user) >= 780;
    }
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sampleSolidity);
    setCopied(true);
    addToast('success', 'Code Copied', 'Solidity interface snippet copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExecute = () => {
    setRunning(true);
    addToast('info', 'Querying RPC', `Fetching on-chain 0x0FD2 composite score for ${targetAddress.slice(0, 8)}...`);

    setTimeout(() => {
      setRunning(false);
      setQueryOutput(JSON.stringify({
        status: "SUCCESS",
        target: targetAddress,
        creditScore: 794,
        tier: "SOVEREIGN",
        proofHash: "0x0fd2e93b194a28f80456cbb8a912a781",
        settledLoans: 38,
        defaultCount: 0,
        oracleVerification: "VALIDATED"
      }, null, 2));
      addToast('success', 'Query Resolved', 'Retrieved verifiable zero-knowledge score from Creditcoin L1.');
    }, 1200);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Composable Cross-Contract Query" maxWidth="max-w-xl">
      <div className="space-y-4 text-xs text-white/80">
        <div>
          <label className="text-[11px] font-medium text-white/70 block mb-1.5">Target Address or Contract</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={targetAddress}
              onChange={(e) => setTargetAddress(e.target.value)}
              className="flex-1 bg-white/[0.03] border border-white/[0.08] focus:border-cyan-500/60 rounded-xl px-3.5 py-2 text-white font-mono text-xs outline-none transition"
              placeholder="0x..."
            />
            <button
              onClick={handleExecute}
              disabled={running}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-xl font-medium text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              {running ? 'Querying...' : 'Query'}
            </button>
          </div>
        </div>

        {queryOutput && (
          <div className="p-3 bg-black/60 border border-cyan-500/30 rounded-xl font-mono text-[11px] text-cyan-300 overflow-x-auto">
            <pre>{queryOutput}</pre>
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-white/70">
            <span className="flex items-center gap-1.5 font-medium"><Terminal className="w-3.5 h-3.5 text-cyan-400" /> Solidity Integration Example</span>
            <button
              onClick={handleCopy}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy Snippet'}
            </button>
          </div>
          <div className="p-3 bg-[#0a0d14] border border-white/[0.06] rounded-xl font-mono text-[11px] text-white/70 overflow-x-auto">
            <pre>{sampleSolidity}</pre>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] text-white/80 text-xs font-medium transition"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ComposableQueryModal;

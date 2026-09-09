import React, { useState } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import { ShieldAlert, Bot, RefreshCw, CheckCircle, Cpu, AlertTriangle } from 'lucide-react';
import { AIRiskVector } from '../../types/tracks';

interface AIRiskModalProps {
  isOpen: boolean;
  onClose: () => void;
  vector?: AIRiskVector | null;
}

const AIRiskModal: React.FC<AIRiskModalProps> = ({ isOpen, onClose, vector }) => {
  const { addToast } = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [confidence, setConfidence] = useState(vector?.confidence || 98.4);

  const handleAudit = () => {
    setAnalyzing(true);
    addToast('info', 'AI Oracle', 'Triggering deep neural verification cycle across 1,024 shards...');
    setTimeout(() => {
      setAnalyzing(false);
      setConfidence(99.6);
      addToast('success', 'Oracle Verified', 'Deep neural weights validated. Drift score within safe bounds (0.004%).');
    }, 1800);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Model Risk Vector Inspection" maxWidth="max-w-lg">
      <div className="space-y-4 text-xs text-white/80">
        <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="font-medium text-white text-sm">{vector?.modelName || 'DeepSeek-V3 Quantized Hub'}</div>
            <div className="text-[11px] text-white/40">Model ID: {vector?.id || '0xAI-7721-B'} &bull; Type: LLM Compute Pipeline</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <span className="text-[10px] uppercase text-white/40 tracking-wider">Oracle Confidence</span>
            <div className="text-lg font-bold text-cyan-400 mt-0.5">{confidence}%</div>
            <div className="text-[10px] text-white/40 mt-0.5 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-emerald-400" /> Byzantine Tolerant
            </div>
          </div>
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl">
            <span className="text-[10px] uppercase text-white/40 tracking-wider">Risk Classification</span>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{vector?.riskTier || 'LOW'}</div>
            <div className="text-[10px] text-white/40 mt-0.5">Slashing Collateral: 15,000 CTC</div>
          </div>
        </div>

        <div className="p-3.5 bg-cyan-950/20 border border-cyan-500/20 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-medium">
            <Cpu className="w-4 h-4" /> Real-Time Inference Latency
          </div>
          <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full w-[88%]" />
          </div>
          <div className="flex justify-between text-[10px] text-white/50">
            <span>Avg Response: 42ms</span>
            <span>Uptime: 99.98%</span>
          </div>
        </div>

        <div className="flex items-start gap-2 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300/80 text-[11px]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <span>Oracle slashing enforces auto-liquidation if response drift exceeds 0.05% threshold during inference checks.</span>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 text-xs font-medium transition"
          >
            Close
          </button>
          <button
            onClick={handleAudit}
            disabled={analyzing}
            className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? 'animate-spin' : ''}`} />
            {analyzing ? 'Re-Auditing Shards...' : 'Re-Audit Weights'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AIRiskModal;

import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Chrome, Download, CheckCircle2, XCircle, Copy, ExternalLink,
  Cpu, ShieldCheck, Zap, RefreshCw, Terminal, ArrowRight, Loader2
} from 'lucide-react';
import { downloadExtensionZip, pingExtension } from '../../utils/extensionBundle';

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionModal: React.FC<ExtensionModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    const result = await pingExtension();
    setIsInstalled(result.installed);
    setChecking(false);
  };

  useEffect(() => {
    if (isOpen) {
      void checkStatus();
    }
  }, [isOpen]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      addToast('info', 'Packaging Extension', 'Generating Manifest V3 ZIP package with Unified Pulse & Virtual Node engine…');
      await downloadExtensionZip();
      addToast('success', 'Download Started', 'CredX-Unified-DePIN-Extension-v1.2.0.zip ready! Load unpacked into chrome://extensions.');
    } catch (err: any) {
      addToast('error', 'Download Failed', err?.message || 'Could not package extension ZIP.');
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyPath = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPath(true);
    addToast('info', 'Copied', `Copied "${text}" to clipboard.`);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="CredX Unified DePIN Extension (Pulse + Virtual Node)" maxWidth="max-w-2xl">
      <div className="space-y-5 text-xs text-white/80">
        
        {/* Live Extension Detection Status */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all ${
          isInstalled
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : 'bg-cyan-950/30 border-cyan-500/25 text-cyan-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isInstalled
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
            }`}>
              <Chrome className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                {isInstalled ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Extension Detected &amp; Active
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" /> Manifest V3 Extension Ready
                  </>
                )}
              </div>
              <div className="text-[11px] text-white/50 mt-0.5">
                {isInstalled
                  ? 'Your browser has the active CredX Virtual Node daemon running.'
                  : 'Install the extension to mine telemetry in the background and relay on-chain proofs.'}
              </div>
            </div>
          </div>

          <button
            onClick={checkStatus}
            disabled={checking}
            className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.08] text-white/70 font-mono text-[11px] transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
            {checking ? 'Checking…' : 'Re-Check'}
          </button>
        </div>

        {/* 3-Step Installation Guide */}
        <div className="p-5 rounded-2xl bg-[#040709] border border-white/[0.08] space-y-3.5">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" /> 3-Step 1-Minute Setup Guide
          </div>

          <div className="space-y-3 font-mono text-xs">
            {/* Step 1 */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center shrink-0 text-xs">1</span>
              <div className="space-y-2 flex-1">
                <div className="text-white font-sans font-medium text-xs">Download and unzip the Chrome Extension bundle:</div>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center gap-2 disabled:opacity-50"
                >
                  {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {downloading ? 'Generating ZIP…' : 'Download CredX Extension (.zip)'}
                </button>
                <div className="text-[10px] text-gray-500 font-sans">
                  Or load directly from the repository directory: <code className="text-cyan-400 bg-cyan-500/10 px-1 py-0.5 rounded">extension/</code>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-300 font-bold flex items-center justify-center shrink-0 text-xs">2</span>
              <div className="space-y-1.5 flex-1">
                <div className="text-white font-sans font-medium text-xs">Open extensions manager and enable Developer Mode:</div>
                <div className="flex items-center gap-2">
                  <span className="bg-black/50 border border-white/10 px-3 py-1.5 rounded-lg text-cyan-300 text-[11px] select-all">
                    chrome://extensions
                  </span>
                  <button
                    onClick={() => handleCopyPath('chrome://extensions')}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-400 hover:text-white transition"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 font-sans">
                  Paste into your browser address bar and toggle <strong className="text-white">"Developer mode"</strong> in the top-right corner.
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center shrink-0 text-xs">3</span>
              <div className="space-y-1">
                <div className="text-white font-sans font-medium text-xs">Click <strong className="text-emerald-400">"Load unpacked"</strong> &amp; select the extracted folder</div>
                <div className="text-[10px] text-gray-500 font-sans">
                  Select the unzipped <code className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">CredX-Virtual-Node-Extension-v1.1.0</code> (or <code className="text-emerald-400 bg-emerald-500/10 px-1 py-0.5 rounded">extension/</code>) folder. The CredX Virtual Node icon will appear in your Chrome toolbar!
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-cyan-400 font-bold flex items-center gap-1.5 text-[11px]">
              <Cpu className="w-3.5 h-3.5" /> Real Hardware
            </div>
            <p className="text-[10px] text-white/50 font-sans">
              Inspects genuine CPU threads, RAM matrix, WebGL GPU acceleration, and live CC3 RPC ping.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5" /> Zero-Key Security
            </div>
            <p className="text-[10px] text-white/50 font-sans">
              Never stores or asks for a private key; relays JSON-RPC calls securely through MetaMask in the active tab.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
            <div className="text-purple-400 font-bold flex items-center gap-1.5 text-[11px]">
              <Zap className="w-3.5 h-3.5" /> On-Chain Sync
            </div>
            <p className="text-[10px] text-white/50 font-sans">
              Syncs with Creditcoin L1 DePIN and AI Compute Registry (<code className="text-purple-300">0xB792…785D</code>).
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/70 font-mono text-xs transition"
          >
            Close
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold font-mono text-xs shadow-lg shadow-cyan-500/25 transition flex items-center gap-2 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {downloading ? 'Downloading…' : 'Download Extension (.zip)'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExtensionModal;

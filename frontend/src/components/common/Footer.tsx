import React from 'react';
import { ShieldCheck, ArrowUpRight, Github, Twitter, Send, Disc as Discord, MessageSquare } from 'lucide-react';

interface FooterProps {
  onNavigate?: (route: 'landing' | 'app' | 'arena') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  return (
    <footer className="border-t border-cyan-500/20 bg-[#01070a] py-12 text-slate-400 text-xs mt-20 relative overflow-hidden">
      {/* Subtle top teal ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Protocol Info */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-black border border-cyan-500/40 flex items-center justify-center shadow-[0_0_12px_rgba(6,182,212,0.3)] overflow-hidden">
              <img
                src="/images/credx-butterfly-logo.png"
                alt="CredX Butterfly Logo"
                className="w-full h-full object-cover scale-125"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-white tracking-wide">CredX</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                  v2.4
                </span>
              </div>
              <p className="text-[11px] text-cyan-200/50 font-mono">
                Cross-Chain Trustless Credit Bureau &middot; Chain ID 102031
              </p>
            </div>
          </div>

          {/* Nav Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-cyan-100/70 font-medium text-sm">
            {onNavigate && (
              <>
                <button onClick={() => onNavigate('landing')} className="hover:text-cyan-300 transition-colors cursor-pointer">
                  Product
                </button>
                <button onClick={() => onNavigate('app')} className="hover:text-cyan-300 transition-colors cursor-pointer">
                  Protocol Terminal
                </button>
                <button onClick={() => onNavigate('arena')} className="text-amber-400 hover:text-amber-300 transition-colors font-bold cursor-pointer">
                  PredictBay Arena ⚔️
                </button>
              </>
            )}
            <a
              href="https://dorahacks.io"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white flex items-center gap-1 transition-colors text-xs font-mono text-cyan-400"
            >
              <span>BUIDL 2026</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Social Icons matching Dribbble Sentra footer */}
          <div className="flex items-center gap-3">
            <a
              href="https://t.me/b1xckk"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-300 flex items-center justify-center transition-colors"
              title="Telegram (@b1xckk)"
            >
              <Send className="w-4 h-4" />
            </a>
            <a
              href="https://x.com/tdeaddddd"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-300 flex items-center justify-center transition-colors"
              title="Twitter / X (@tdeaddddd)"
            >
              <Twitter className="w-4 h-4" />
            </a>
            <a
              href="https://discord.com/users/718954737742905355"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-300 flex items-center justify-center transition-colors"
              title="Discord (@tdeadddd)"
            >
              <Discord className="w-4 h-4" />
            </a>
            <a
              href="https://github.com/tondays52"
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 rounded-lg bg-cyan-950/40 border border-cyan-500/30 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-300 flex items-center justify-center transition-colors"
              title="GitHub (@tondays52)"
            >
              <Github className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-cyan-500/10 text-[11px] text-cyan-300/40 font-mono">
          <div>
            &copy; {new Date().getFullYear()} CredX Protocol. All rights reserved. Precompile 0x0FD2.
          </div>
          <div className="flex items-center gap-4">
            <span className="hover:text-cyan-300 transition-colors cursor-pointer">Privacy Policy</span>
            <span>&bull;</span>
            <span className="hover:text-cyan-300 transition-colors cursor-pointer">Terms of Service</span>
            <span>&bull;</span>
            <span className="hover:text-cyan-300 transition-colors cursor-pointer">Docs</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

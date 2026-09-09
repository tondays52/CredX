import React, { useState } from 'react';
import { ShieldCheck, Wallet, ArrowUpRight, Swords, Menu, X } from 'lucide-react';
import { useWeb3 } from '../../context/Web3Context';

interface NavbarProps {
  currentRoute: 'landing' | 'app' | 'arena';
  onNavigate: (route: 'landing' | 'app' | 'arena') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentRoute, onNavigate }) => {
  const { isConnected, address, toggleConnect } = useWeb3();
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleHomeClick = () => {
    setMobileMenuOpen(false);
    if (currentRoute === 'landing') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onNavigate('landing');
    }
  };

  const handleEcosystemClick = () => {
    setMobileMenuOpen(false);
    if (currentRoute === 'landing') {
      const el = document.getElementById('ecosystem');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    onNavigate('app');
  };

  const handleRoadmapClick = () => {
    setMobileMenuOpen(false);
    if (currentRoute === 'landing') {
      const el = document.getElementById('roadmap');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    onNavigate('app');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#07080a]/90 backdrop-blur-xl shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo */}
        <div
          className="flex items-center space-x-3 cursor-pointer group shrink-0"
          onClick={handleHomeClick}
        >
          <div className="w-11 h-11 rounded-xl bg-black border border-[#00FF66]/30 flex items-center justify-center shadow-[0_0_15px_rgba(0,255,102,0.25)] group-hover:scale-105 group-hover:border-[#00FF66] group-hover:shadow-[0_0_20px_rgba(0,255,102,0.45)] transition-all duration-300 relative overflow-hidden">
            <img
              src="/images/credx-butterfly-logo.png"
              alt="CredX Logo"
              className="w-full h-full object-cover scale-125 group-hover:scale-135 transition-transform duration-300"
            />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xl font-black tracking-tight text-white group-hover:text-[#00FF66] transition-colors">
                CREDX
              </span>
              <span className="text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[#00FF66]/10 text-[#00FF66] border border-[#00FF66]/30 font-mono">
                OCCR L1
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:flex items-center gap-1.5">
              <span>Creditcoin Testnet</span>
              <span className="text-slate-600">&bull;</span>
              <span className="text-[#00FF66] font-bold">0x0FD2 Precompile</span>
            </p>
          </div>
        </div>

        {/* Center Route Links (Visible on all screens sm and up) */}
        <nav className="hidden sm:flex items-center space-x-6 md:space-x-8 text-xs font-semibold text-slate-300">
          <button
            onClick={handleHomeClick}
            className={`transition-colors hover:text-[#00FF66] cursor-pointer py-1 ${
              currentRoute === 'landing' ? 'text-[#00FF66] font-bold' : 'text-white/80'
            }`}
          >
            Home
          </button>

          <button
            onClick={handleEcosystemClick}
            className="transition-colors hover:text-[#00FF66] cursor-pointer text-white/80 py-1"
          >
            Ecosystem
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigate('arena');
            }}
            className={`transition-colors hover:text-amber-300 flex items-center gap-1.5 cursor-pointer py-1 ${
              currentRoute === 'arena' ? 'text-amber-400 font-bold' : 'text-amber-400/90'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Arena</span>
          </button>

          <button
            onClick={handleRoadmapClick}
            className="transition-colors hover:text-[#00FF66] cursor-pointer text-white/80 py-1"
          >
            Roadmap
          </button>
        </nav>

        {/* Right Actions: Connect Wallet + Launch App + Mobile Hamburger */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <button
            onClick={toggleConnect}
            className={`hidden md:inline-flex px-4 py-2 rounded-xl text-xs font-semibold border transition-all items-center gap-2 cursor-pointer ${
              isConnected
                ? 'text-[#00FF66] bg-[#00FF66]/10 border-[#00FF66]/30 hover:bg-[#00FF66]/20'
                : 'text-white/80 bg-white/[0.04] hover:bg-white/[0.08] border-white/10'
            }`}
          >
            {isConnected ? (
              <span className="w-2 h-2 rounded-full bg-[#00FF66] animate-pulse shadow-[0_0_8px_#00FF66]" />
            ) : (
              <Wallet className="w-3.5 h-3.5 text-white/70" />
            )}
            <span>{isConnected ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}</span>
          </button>

          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigate('app');
            }}
            className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-black text-xs bg-[#00FF66] hover:bg-[#00e65c] text-black shadow-lg shadow-[#00FF66]/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <span>Launch App</span>
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
          </button>

          {/* Mobile Menu Toggle Button (< sm) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-xl bg-white/[0.05] border border-white/10 text-white hover:text-[#00FF66] transition-colors cursor-pointer"
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown (< sm) */}
      {mobileMenuOpen && (
        <div className="sm:hidden px-4 pt-2 pb-6 bg-[#07080a] border-b border-white/[0.08] space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col space-y-2 text-sm font-semibold pt-2">
            <button
              onClick={handleHomeClick}
              className={`text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] transition-colors ${
                currentRoute === 'landing' ? 'text-[#00FF66] font-bold' : 'text-white/80'
              }`}
            >
              Home
            </button>
            <button
              onClick={handleEcosystemClick}
              className="text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] text-white/80 transition-colors"
            >
              Ecosystem
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('arena');
              }}
              className="text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] text-amber-400 flex items-center gap-2 transition-colors"
            >
              <Swords className="w-4 h-4" />
              <span>PredictBay Arena</span>
            </button>
            <button
              onClick={handleRoadmapClick}
              className="text-left px-3 py-2 rounded-lg hover:bg-white/[0.05] text-white/80 transition-colors"
            >
              Roadmap
            </button>
          </div>

          <div className="pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                toggleConnect();
              }}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border border-white/10 bg-white/[0.04] text-white flex items-center justify-center gap-2"
            >
              <Wallet className="w-4 h-4 text-[#00FF66]" />
              <span>{isConnected ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;

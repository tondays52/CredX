import React, { useState, useEffect } from 'react';
import { ToastProvider } from './context/ToastContext';
import { Web3Provider } from './context/Web3Context';
import { WalletPickerProvider } from './context/WalletPickerContext';
import { ProtocolProvider } from './context/ProtocolContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import ToastContainer from './components/common/ToastContainer';
import LandingPage from './pages/LandingPage';
import TerminalPage from './pages/TerminalPage';
import ArenaPage from './pages/ArenaPage';

const AppContent: React.FC = () => {
  const getInitialRoute = (): 'landing' | 'app' | 'arena' => {
    const hash = window.location.hash.toLowerCase();
    if (hash.includes('arena')) return 'arena';
    if (hash.includes('landing') || hash === '#/product') return 'landing';
    // Default directly to terminal app (DePIN / Pulse / Nexus)
    return 'app';
  };

  const [currentRoute, setCurrentRoute] = useState<'landing' | 'app' | 'arena'>(getInitialRoute);

  // URL hash syncing for direct linking (#/depin, #/pulse, #/nexus, #/app, #/arena, #/landing)
  useEffect(() => {
    // If user enters with empty or root hash, direct straight into #/depin
    if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
      window.location.hash = '#/depin';
    }

    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash.includes('arena')) {
        setCurrentRoute('arena');
      } else if (hash.includes('landing') || hash === '#/product') {
        setCurrentRoute('landing');
      } else {
        // Direct route to the app terminal for all terminal tabs
        setCurrentRoute('app');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (route: 'landing' | 'app' | 'arena') => {
    setCurrentRoute(route);
    if (route === 'landing') window.location.hash = '/landing';
    else if (route === 'app') window.location.hash = '/depin';
    else if (route === 'arena') window.location.hash = '/arena';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#06080e] text-white flex flex-col justify-between selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-cyan-500/[0.04] rounded-full blur-[140px]" />
        <div className="absolute top-[600px] right-0 w-[500px] h-[500px] bg-purple-500/[0.03] rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar currentRoute={currentRoute} onNavigate={handleNavigate} />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 w-full">
          {currentRoute === 'landing' && <LandingPage onNavigate={handleNavigate} />}
          {currentRoute === 'app' && <TerminalPage />}
          {currentRoute === 'arena' && <ArenaPage />}
        </main>

        <Footer onNavigate={handleNavigate} />
      </div>

      <ToastContainer />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Web3Provider>
        <WalletPickerProvider>
          <ProtocolProvider>
            <AppContent />
          </ProtocolProvider>
        </WalletPickerProvider>
      </Web3Provider>
    </ToastProvider>
  );
};

export default App;

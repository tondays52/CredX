import React, { useState, useEffect, useRef } from 'react';

interface CoinData {
  id: string;
  name: string;
  symbol: string;
  color: string;
  iconSvg: string;
  glow: string;
}

const COINS: CoinData[] = [
  {
    id: 'btc',
    name: 'Bitcoin',
    symbol: '₿',
    color: '#00FF66',
    glow: 'rgba(0, 255, 102, 0.4)',
    iconSvg: '₿'
  },
  {
    id: 'eth',
    name: 'Ethereum',
    symbol: 'Ξ',
    color: '#00E5FF',
    glow: 'rgba(0, 229, 255, 0.4)',
    iconSvg: 'Ξ'
  },
  {
    id: 'ctc',
    name: 'Creditcoin',
    symbol: 'CTC',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.5)',
    iconSvg: 'C'
  },
  {
    id: 'bnb',
    name: 'BNB',
    symbol: '⬡',
    color: '#F59E0B',
    glow: 'rgba(245, 158, 11, 0.4)',
    iconSvg: '⬡'
  },
  {
    id: 'ton',
    name: 'Telegram TON',
    symbol: '✈',
    color: '#00D2FF',
    glow: 'rgba(0, 210, 255, 0.4)',
    iconSvg: '✈'
  },
  {
    id: 'usdt',
    name: 'Tether',
    symbol: '₮',
    color: '#26A17B',
    glow: 'rgba(38, 161, 123, 0.4)',
    iconSvg: '₮'
  },
  {
    id: 'usdc',
    name: 'USD Coin',
    symbol: '$',
    color: '#2775CA',
    glow: 'rgba(39, 117, 202, 0.4)',
    iconSvg: '$'
  },
  {
    id: 'sol',
    name: 'Solana',
    symbol: '◎',
    color: '#9945FF',
    glow: 'rgba(153, 69, 255, 0.4)',
    iconSvg: '◎'
  }
];

export const RyzenCoinOrbit: React.FC = () => {
  const [angleOffset, setAngleOffset] = useState<number>(0);
  const [mouseOffset, setMouseOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [useVideoBg, setUseVideoBg] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth continuous rotation loop using requestAnimationFrame
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;
      // Rotate ~1 full turn every 18 seconds (matching video speed)
      setAngleOffset((prev) => (prev + delta * (Math.PI * 2 / 18)) % (Math.PI * 2));
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Mouse parallax interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    setMouseOffset({ x: nx * 15, y: ny * 15 });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  // Ellipse dimensions
  const radiusX = 220; // horizontal radius in px
  const radiusY = 160; // vertical radius in px

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-[560px] aspect-square mx-auto flex items-center justify-center select-none overflow-visible"
    >
      {/* Background High-Def Video Loop Layer from Ali Hyder's Dribbble */}
      <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none opacity-90 z-0">
        <video
          src="/ryzen-hero.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover mix-blend-screen scale-110"
        />
        {/* Subtle dark gradient overlay to blend into website background */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#07080a] via-transparent to-[#07080a] opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07080a] via-transparent to-[#07080a] opacity-60" />
      </div>

      {/* Floating 3D Coin Orbit Mathematical Layer */}
      <div
        className="relative w-full h-full flex items-center justify-center pointer-events-none z-10 transition-transform duration-300 ease-out"
        style={{
          transform: `perspective(1000px) rotateX(${62 + mouseOffset.y}deg) rotateZ(${-22 + mouseOffset.x}deg)`
        }}
      >
        {/* The Orbit Track Guide Ring */}
        <div
          className="absolute rounded-full border border-[#00FF66]/20 shadow-[0_0_30px_rgba(0,255,102,0.15)]"
          style={{
            width: `${radiusX * 2}px`,
            height: `${radiusY * 2}px`
          }}
        />

        {/* Orbiting Coins */}
        {COINS.map((coin, index) => {
          const coinAngle = angleOffset + (index * (Math.PI * 2) / COINS.length);
          const x = radiusX * Math.cos(coinAngle);
          const y = radiusY * Math.sin(coinAngle);

          // Depth calculations based on sin(angle)
          // Top of ellipse is back (sin < 0), bottom is front (sin > 0)
          const depth = Math.sin(coinAngle);
          const scale = 0.8 + 0.35 * ((depth + 1) / 2); // 0.8 to 1.15
          const opacity = 0.5 + 0.5 * ((depth + 1) / 2); // 0.5 to 1.0
          const zIndex = Math.floor((depth + 1) * 50);

          return (
            <div
              key={coin.id}
              className="absolute pointer-events-auto cursor-pointer group"
              style={{
                transform: `translate3d(${x}px, ${y}px, 0px) rotateZ(${22 - mouseOffset.x}deg) rotateX(${-62 - mouseOffset.y}deg) scale(${scale})`,
                zIndex,
                opacity
              }}
            >
              {/* 3D Coin Cylinder & Hologram */}
              <div
                className="w-16 h-16 rounded-full border-2 border-[#00FF66]/60 flex items-center justify-center font-black text-xl transition-transform duration-300 group-hover:scale-125 relative"
                style={{
                  background: 'radial-gradient(circle, rgba(16,185,129,0.3) 0%, rgba(6,78,59,0.8) 70%, rgba(2,44,34,1) 100%)',
                  boxShadow: `0 0 25px ${coin.glow}, inset 0 0 15px rgba(0,255,102,0.4)`
                }}
              >
                {/* Outer Coin Edge Ridges */}
                <div className="absolute inset-0 rounded-full border border-dashed border-[#00FF66]/40 animate-[spin_10s_linear_infinite]" />

                {/* Coin Face Emblem */}
                <span className="text-white drop-shadow-[0_0_8px_rgba(0,255,102,0.9)] font-mono">
                  {coin.symbol}
                </span>

                {/* Tooltip on Hover */}
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/90 border border-[#00FF66]/40 text-[9px] font-mono text-[#00FF66] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                  {coin.name} &bull; CTS Verified
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Holographic Pulse Core */}
      <div className="absolute w-24 h-24 rounded-full bg-[#00FF66]/10 border border-[#00FF66]/30 flex items-center justify-center animate-pulse pointer-events-none shadow-[0_0_40px_rgba(0,255,102,0.2)]">
        <div className="w-12 h-12 rounded-full bg-[#00FF66]/20 border border-[#00FF66]/50 flex items-center justify-center text-xs font-mono font-bold text-[#00FF66]">
          OCCR
        </div>
      </div>
    </div>
  );
};

export default RyzenCoinOrbit;

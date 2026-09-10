import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import ThreeCoinStage from './ThreeCoinStage';

interface RyzenHeroProps {
  onLaunchApp: () => void;
  onExploreArena: () => void;
}

export const RyzenHero: React.FC<RyzenHeroProps> = ({ onLaunchApp, onExploreArena }) => {
  return (
    <section className="relative w-full min-h-[580px] lg:min-h-[660px] flex items-center pt-4 pb-12 select-none overflow-hidden">
      {/* 
        Procedural 3D Floating Coins Animation (Three.js WebGL Stage)
        Replaces the previous video animation.
        Floats dynamically across the entire scene and beneath the words with 100% transparency.
      */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0">
        <ThreeCoinStage className="w-full h-full opacity-90" />
      </div>

      {/* Foreground Content: Clean Typography, Description, Pill Buttons & Socials */}
      <div className="relative z-10 max-w-2xl lg:max-w-3xl space-y-6 text-left">
        {/* Headline matching exact Ali Hyder Ryzen typography & sizing */}
        <h1 className="text-4xl sm:text-5xl lg:text-[66px] font-black text-white tracking-tight uppercase leading-[1.06] drop-shadow-lg">
          PIONEERING REPUTATION-DRIVEN <br />
          <span className="text-white">
            BLOCKCHAIN SOLUTIONS
          </span>
        </h1>

        {/* Subtitle with green highlighted keywords */}
        <p className="text-sm sm:text-base text-gray-300/95 leading-relaxed max-w-xl font-normal drop-shadow-md">
          CredX pioneers Decentralized Credit Infrastructure as a Service (Credit-IaaS) for the{' '}
          <span className="text-[#00FF66] font-semibold">Creditcoin</span> ecosystem. By leveraging Creditcoin L1&apos;s{' '}
          <span className="text-[#00FF66] font-semibold">0x0FD2</span> native precompile and state verification, we empower
          developers to create scalable, uncollateralized lending, DePIN meshes, and high-performance solutions that push the
          limits of blockchain <span className="text-[#00FF66] font-semibold">technology</span>.
        </p>

        {/* Pill Buttons matching the exact Ryzen Dribbble design */}
        <div className="flex flex-wrap items-center gap-4 pt-2">
          <button
            onClick={onLaunchApp}
            className="px-8 py-3.5 rounded-full bg-[#00FF66] hover:bg-[#00e65c] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_0_30px_rgba(0,255,102,0.4)] hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            <span>Launch App</span>
            <ArrowUpRight className="w-4 h-4 stroke-[3]" />
          </button>

          <button
            onClick={onExploreArena}
            className="px-8 py-3.5 rounded-full bg-[#07090e]/80 hover:bg-white/[0.08] text-white border border-white/20 hover:border-[#00FF66]/50 font-bold text-xs uppercase tracking-wider backdrop-blur-md transition-all cursor-pointer"
          >
            <span>Explore Arena</span>
          </button>
        </div>

        {/* Social Pill Circles below buttons matching Dribbble shot */}
        <div className="flex items-center space-x-3 pt-3">
          {[
            {
              name: 'X (Twitter)',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              ),
              href: 'https://x.com/tdeaddddd'
            },
            {
              name: 'Telegram',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                </svg>
              ),
              href: 'https://t.me/b1xckk'
            },
            {
              name: 'GitHub',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
              ),
              href: 'https://github.com/tondays52'
            },
            {
              name: 'Discord',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.894.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
              ),
              href: 'https://discord.com/users/718954737742905355'
            }
          ].map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="w-9 h-9 rounded-full bg-white/[0.04] border border-white/10 hover:border-[#00FF66]/70 hover:text-[#00FF66] text-white/70 flex items-center justify-center transition-all cursor-pointer"
                title={social.name}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
    </section>
  );
};

export default RyzenHero;

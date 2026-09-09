import React from 'react';

export const PartnerMarquee: React.FC = () => {
  const partners = [
    { name: 'CREDITCOIN TESTNET', color: 'text-cyan-400' },
    { name: 'ATTESTCOIN 0x0FD2', color: 'text-purple-400' },
    { name: 'ETHEREUM MAINNET', color: 'text-emerald-400' },
    { name: 'ARBITRUM ONE', color: 'text-blue-400' },
    { name: 'BASE L2', color: 'text-cyan-400' },
    { name: 'PYTH ORACLE', color: 'text-amber-400' },
    { name: 'UNISWAP V3', color: 'text-pink-400' },
    { name: 'AAVE V3', color: 'text-emerald-400' }
  ];

  return (
    <div className="border-y border-white/5 bg-white/[0.01] py-6 overflow-hidden">
      <div className="max-w-6xl mx-auto px-4">
        <div className="qclay-marquee">
          <div className="qclay-marquee-inner font-mono text-xs font-bold text-slate-400">
            {partners.concat(partners).map((p, idx) => (
              <span key={idx} className="flex items-center gap-2">
                <span className={p.color}>●</span> {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartnerMarquee;

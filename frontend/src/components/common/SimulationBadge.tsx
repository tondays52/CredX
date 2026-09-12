import React from 'react';

interface SimulationBadgeProps {
  label?: string;
  note?: string;
  className?: string;
}

/**
 * Honest "SIMULATION" indicator. Used across the demo to make it clear that a
 * given panel is a locally-simulated flow (no on-chain state, no wallet txs)
 * rather than a live interation with Creditcoin Testnet.
 */
export const SimulationBadge: React.FC<SimulationBadgeProps> = ({
  label = 'SIMULATION',
  note,
  className = '',
}) => {
  return (
    <span
      title={
        note ??
        'Local demo simulation — no on-chain transaction. Connect a wallet and use the live panels for real testnet state.'
      }
      className={`inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-amber-300 cursor-help ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
      {label}
    </span>
  );
};

export default SimulationBadge;
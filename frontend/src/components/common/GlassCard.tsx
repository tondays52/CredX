import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  interactive = false,
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`${
        interactive ? 'glass-card-interactive cursor-pointer' : 'glass-card'
      } ${className}`}
    >
      {children}
    </div>
  );
};

export default GlassCard;

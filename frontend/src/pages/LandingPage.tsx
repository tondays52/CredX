import React from 'react';
import RyzenHero from '../components/landing/RyzenHero';
import PartnerMarquee from '../components/landing/PartnerMarquee';
import RyzenWhyCredX from '../components/landing/RyzenWhyCredX';
import RyzenEcosystem from '../components/landing/RyzenEcosystem';
import RyzenTracksShowcase from '../components/landing/RyzenTracksShowcase';
import RyzenStepsLogic from '../components/landing/RyzenStepsLogic';
import RoadmapTimeline from '../components/landing/RoadmapTimeline';
import RyzenCTA from '../components/landing/RyzenCTA';

interface LandingPageProps {
  onNavigate: (route: 'landing' | 'app' | 'arena') => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  return (
    <div className="space-y-20 md:space-y-28 py-4">
      {/* 1. Hero Section: Ryzen 3D Coin Orbit, video layer & bold uppercase typography */}
      <RyzenHero
        onLaunchApp={() => onNavigate('app')}
        onExploreArena={() => onNavigate('arena')}
      />

      {/* 2. Institutional Partner & Ecosystem Marquee */}
      <PartnerMarquee />

      {/* 3. Why CredX - 6-Card Bento Grid (Cutting Edge Tech, Multi-Track Economy, AI Compute, etc.) */}
      <RyzenWhyCredX onLaunchApp={() => onNavigate('app')} />

      {/* 4. Ecosystem & Core Technology: 3D Holographic Cylinder & 0x0FD2 L1 Precompile */}
      <RyzenEcosystem onLaunchApp={() => onNavigate('app')} />

      {/* 5. Multi-Track Protocol Hubs Showcase (DeFi, DePIN, Gaming, RWA, AI Compute) */}
      <RyzenTracksShowcase onSelectTrack={() => onNavigate('app')} />

      {/* 6. Stepped Architecture Logic: 5 Numbered Cards */}
      <RyzenStepsLogic onLaunchApp={() => onNavigate('app')} />

      {/* 7. Roadmap & Vision Timeline */}
      <RoadmapTimeline />

      {/* 8. Call To Action: "CredX is evolving. Be part of the future." */}
      <RyzenCTA
        onLaunchApp={() => onNavigate('app')}
        onExploreArena={() => onNavigate('arena')}
      />
    </div>
  );
};

export default LandingPage;

import React from 'react';
import { Navbar } from './navbar';
import { HeroSection } from './hero-section';
import { PlatformSection } from './platform-section';
import { DashboardSection } from './dashboard-section';
import { PricingSection } from './pricing-section';
import { Footer } from './footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#07080B] text-neutral-100 selection:bg-brand-orange selection:text-white font-sans antialiased overflow-x-hidden relative">
      {/* Global Background Grid Pattern & Grain */}
      <div className="fixed inset-0 bg-grid-subtle pointer-events-none opacity-40 z-0" />

      {/* Atmospheric Ember Vignette */}
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(255,77,34,0.06),rgba(255,255,255,0))] pointer-events-none z-0" />

      {/* Main Page Layout */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />
        
        <main className="flex-grow">
          {/* Section 1: Hero */}
          <HeroSection />

          {/* Section 2: Platform & 3D Shield */}
          <PlatformSection />

          {/* Section 3: Monitoring Dashboard UI & Deep Checks */}
          <DashboardSection />

          {/* Section 4: Pricing & Convert */}
          <PricingSection />
        </main>

        <Footer />
      </div>
    </div>
  );
}

export default LandingPage;

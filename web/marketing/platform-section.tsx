import React from 'react';
import { Activity, Lock, History } from 'lucide-react';
import { ShieldScene } from './shield-scene';

export const PlatformSection: React.FC = () => {
  return (
    <section id="platform" className="relative py-24 sm:py-32 overflow-hidden border-t border-white/[0.06] bg-[#07080B]">
      
      {/* Background ambient gradient glow */}
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[36rem] h-[36rem] bg-brand-orange/6 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-10 w-80 h-80 bg-brand-orange/4 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Tag */}
        <div className="flex items-center gap-2.5 text-xs font-mono tracking-widest text-neutral-400 uppercase mb-8 sm:mb-12">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          <span>BUILT TO PROTECT. DESIGNED TO SCALE.</span>
        </div>

        {/* Two-Column Grid: Text & Metrics (Left) + 3D Shield (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-6 flex flex-col justify-start">
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-white tracking-[-0.03em] leading-[1.1] font-display">
              One control plane <br />
              for every WordPress site<span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 bg-brand-orange ml-1 align-baseline translate-y-[-2px]" />
            </h2>

            <p className="mt-6 text-sm sm:text-base text-neutral-400 leading-relaxed font-sans max-w-xl">
              wwatch centralizes uptime, SSL, plugin updates, backups, and incident visibility across your entire WordPress fleet—so agencies and operators can act before clients ever notice.
            </p>

            {/* 4 Stats in a row with vertical dividers */}
            <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-white/[0.08]">
              
              {/* Stat 1 */}
              <div className="flex flex-col sm:border-r sm:border-white/[0.08] sm:pr-4">
                <div className="flex items-center gap-2 text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                  <span>42,000+</span>
                </div>
                <div className="mt-1 text-[10.5px] font-mono text-neutral-500 tracking-wider uppercase">
                  CHECKS / DAY
                </div>
              </div>

              {/* Stat 2 */}
              <div className="flex flex-col sm:border-r sm:border-white/[0.08] sm:px-4">
                <div className="flex items-center gap-2 text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                  <span>1,280</span>
                </div>
                <div className="mt-1 text-[10.5px] font-mono text-neutral-500 tracking-wider uppercase">
                  SITES MONITORED
                </div>
              </div>

              {/* Stat 3 */}
              <div className="flex flex-col sm:border-r sm:border-white/[0.08] sm:px-4">
                <div className="flex items-center gap-2 text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                  <span>99.98%</span>
                </div>
                <div className="mt-1 text-[10.5px] font-mono text-neutral-500 tracking-wider uppercase">
                  UPTIME TRACKED
                </div>
              </div>

              {/* Stat 4 */}
              <div className="flex flex-col sm:pl-4">
                <div className="flex items-center gap-2 text-xl sm:text-2xl font-bold font-display text-white tracking-tight">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
                  <span>34</span>
                </div>
                <div className="mt-1 text-[10.5px] font-mono text-neutral-500 tracking-wider uppercase">
                  TEAMS
                </div>
              </div>

            </div>

            {/* 3 Bottom Feature Cards */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              
              {/* Feature 1 */}
              <div className="p-3.5 rounded-xl bg-[#0F1116]/80 hover:bg-[#141720] border border-white/[0.07] transition-all flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/[0.04] text-neutral-300 shrink-0 mt-0.5">
                  <Activity className="w-4 h-4 text-brand-orange" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white font-sans">
                    Detect issues early
                  </h3>
                  <p className="mt-1 text-[11px] text-neutral-400 leading-snug font-sans">
                    Catch problems before they impact clients.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-3.5 rounded-xl bg-[#0F1116]/80 hover:bg-[#141720] border border-white/[0.07] transition-all flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/[0.04] text-neutral-300 shrink-0 mt-0.5">
                  <Lock className="w-4 h-4 text-brand-orange" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white font-sans">
                    Stay secure by default
                  </h3>
                  <p className="mt-1 text-[11px] text-neutral-400 leading-snug font-sans">
                    SSL and core health never slip.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-3.5 rounded-xl bg-[#0F1116]/80 hover:bg-[#141720] border border-white/[0.07] transition-all flex items-start gap-3">
                <div className="p-2 rounded-lg bg-white/[0.04] text-neutral-300 shrink-0 mt-0.5">
                  <History className="w-4 h-4 text-brand-orange" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white font-sans">
                    Ship updates safely
                  </h3>
                  <p className="mt-1 text-[11px] text-neutral-400 leading-snug font-sans">
                    Automate with confidence, roll back with ease.
                  </p>
                </div>
              </div>

            </div>

          </div>

          {/* Right Column: 3D Particle Shield */}
          <div className="lg:col-span-6 flex items-center justify-center relative">
            <ShieldScene />
          </div>

        </div>

      </div>
    </section>
  );
};

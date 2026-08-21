import React from 'react';
import { 
  Globe, 
  Lock, 
  Puzzle, 
  Cloud, 
  Clock, 
  Terminal, 
  ShieldCheck, 
  ArrowRight,
  Maximize2,
  Zap,
  Sliders,
  Layers
} from 'lucide-react';
import { HeroThreeScene } from './hero-three-scene';
import { HERO_SIGNALS, HERO_RECENT_ACTIVITY } from './dashboard-data';

const iconMap: Record<string, React.ReactNode> = {
  globe: <Globe className="w-4 h-4 text-neutral-400" />,
  lock: <Lock className="w-4 h-4 text-neutral-400" />,
  puzzle: <Puzzle className="w-4 h-4 text-neutral-400" />,
  cloud: <Cloud className="w-4 h-4 text-neutral-400" />,
  clock: <Clock className="w-4 h-4 text-neutral-400" />,
  terminal: <Terminal className="w-4 h-4 text-neutral-400" />,
  shield: <ShieldCheck className="w-4 h-4 text-neutral-400" />,
};

export const HeroSection: React.FC = () => {
  return (
    <section className="relative min-h-[88vh] pt-6 pb-16 lg:pb-20 overflow-hidden flex flex-col justify-center">
      {/* 3D Background Signal Network */}
      <HeroThreeScene />

      {/* Atmospheric Ember Glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[30rem] h-[30rem] bg-brand-orange/8 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Hero Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-start pt-4 lg:pt-8">
          
          {/* Left Column: Massive Editorial Typography & CTAs (5.5 cols) */}
          <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-start">
            <h1 className="text-4xl sm:text-5xl md:text-6xl xl:text-[4.25rem] font-extrabold tracking-[-0.04em] leading-[0.98] uppercase text-white font-display select-none">
              <span className="block text-white">UNMISSABLE</span>
              <span className="block text-white">WORDPRESS</span>
              <span className="block text-white">
                MONITORING<span className="inline-block w-3 h-3 md:w-3.5 md:h-3.5 bg-brand-orange ml-1 align-baseline translate-y-[-2px]" />
              </span>
              <span className="block text-stroke-white">ZERO-</span>
              <span className="block text-stroke-white">SURPRISE</span>
              <span className="block text-stroke-white">
                OPS<span className="inline-block w-3 h-3 md:w-3.5 md:h-3.5 bg-brand-orange ml-1 align-baseline translate-y-[-2px]" />
              </span>
            </h1>

            <p className="mt-8 text-sm sm:text-base text-neutral-400 max-w-md font-sans leading-relaxed tracking-tight">
              Uptime, SSL, updates, backups, and incidents — tracked across every site you manage.
            </p>

            {/* CTA Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="/app"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover rounded-md transition-all shadow-glow-orange hover:shadow-glow-subtle active:scale-[0.98]"
              >
                <span>Start monitoring</span>
                <ArrowRight className="w-4 h-4" />
              </a>

              <a
                href="#demo"
                className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-medium text-neutral-200 bg-[#12141A]/90 hover:bg-[#1A1D24] border border-white/10 hover:border-white/20 rounded-md transition-colors active:scale-[0.98]"
              >
                Book a demo
              </a>
            </div>

            {/* Value Props Row */}
            <div className="mt-12 grid grid-cols-3 gap-4 pt-8 border-t border-white/[0.08]">
              <div>
                <div className="flex items-center gap-1.5 text-brand-orange text-xs font-mono font-medium tracking-wider uppercase">
                  <Zap className="w-3.5 h-3.5 shrink-0" />
                  <span>5-MIN SETUP</span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-400 font-sans leading-snug">
                  Connect a site in minutes.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-brand-orange text-xs font-mono font-medium tracking-wider uppercase">
                  <Sliders className="w-3.5 h-3.5 shrink-0" />
                  <span>AGENCY SCALE</span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-400 font-sans leading-snug">
                  Monitor 10 sites or 10,000.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-brand-orange text-xs font-mono font-medium tracking-wider uppercase">
                  <Layers className="w-3.5 h-3.5 shrink-0" />
                  <span>BUILT FOR WORDPRESS</span>
                </div>
                <p className="mt-1.5 text-xs text-neutral-400 font-sans leading-snug">
                  Deep checks that understand your stack.
                </p>
              </div>
            </div>
          </div>

          {/* Right Column: Monitored Signals & Event Details Card (6.5 - 7 cols) */}
          <div className="lg:col-span-7 xl:col-span-7 grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 items-start">
            
            {/* Monitored Signals Column (md: 5 cols) */}
            <div className="md:col-span-5 flex flex-col space-y-2.5">
              <div className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase font-semibold pb-1">
                MONITORED SIGNALS
              </div>

              <div className="space-y-2">
                {HERO_SIGNALS.map((signal) => (
                  <div
                    key={signal.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[#0F1116]/80 hover:bg-[#151820]/90 border border-white/[0.06] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-white/[0.04] text-neutral-300">
                        {iconMap[signal.icon] ?? <Globe className="w-4 h-4 text-neutral-400" />}
                      </div>
                      <div>
                        <div className="text-xs font-medium text-neutral-200 font-sans">
                          {signal.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 font-mono">
                          {signal.sub}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill Badge */}
                    <div>
                      {signal.status === 'healthy' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Healthy
                        </span>
                      )}
                      {signal.status === 'warning' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-amber-400 bg-amber-950/60 border border-amber-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Warning
                        </span>
                      )}
                      {signal.status === 'critical' && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium text-red-400 bg-red-950/60 border border-red-800/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                          Critical
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Details & Recent Activity Card (md: 7 cols) */}
            <div className="md:col-span-7 rounded-xl bg-[#0D0F14]/90 backdrop-blur-md border border-white/[0.09] p-4.5 sm:p-5 shadow-2xl flex flex-col space-y-4">
              
              {/* Event Details Header */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold tracking-wider uppercase text-neutral-300">
                  <span className="w-2 h-2 rounded-full bg-brand-orange animate-pulse" />
                  <span>EVENT DETAILS</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500">
                  <span>2m ago</span>
                  <Maximize2 className="w-3 h-3 text-neutral-500 hover:text-neutral-300 cursor-pointer" />
                </div>
              </div>

              {/* JSON Syntax Viewer */}
              <div className="bg-[#08090D]/90 rounded-lg p-3.5 font-mono text-[11.5px] leading-relaxed border border-white/[0.04] overflow-x-auto">
                <span className="text-neutral-500">&#123;</span>
                <div className="pl-3 space-y-0.5">
                  <div>
                    <span className="text-neutral-400">"site"</span>: <span className="text-emerald-400">"agency-example.com"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"event"</span>: <span className="text-amber-300">"plugin_update_available"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"plugin"</span>: <span className="text-emerald-400">"woocommerce"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"current"</span>: <span className="text-neutral-300">"8.6.1"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"latest"</span>: <span className="text-neutral-300">"8.7.0"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"severity"</span>: <span className="text-red-400">"critical"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"detected_at"</span>: <span className="text-neutral-300">"2025-05-27T10:24:31Z"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"url"</span>: <span className="text-sky-300 underline decoration-sky-700/50">"https://agency-example.com/wp-admin/"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"php_version"</span>: <span className="text-neutral-300">"8.1.22"</span>,
                  </div>
                  <div>
                    <span className="text-neutral-400">"environment"</span>: <span className="text-emerald-400">"production"</span>
                  </div>
                </div>
                <span className="text-neutral-500">&#125;</span>
              </div>

              {/* Recent Activity Sub-header */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-[11px] font-mono tracking-wider uppercase text-neutral-400 font-semibold flex items-center gap-1.5">
                  <span className="text-neutral-500">&gt;</span>
                  <span>RECENT ACTIVITY</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
                  <span>Live</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
              </div>

              {/* Recent Activity Stream */}
              <div className="space-y-2 pt-0.5">
                {HERO_RECENT_ACTIVITY.map((act) => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between text-xs font-mono text-neutral-300"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          act.status === 'healthy'
                            ? 'bg-emerald-400'
                            : act.status === 'warning'
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }`}
                      />
                      <span className="truncate text-neutral-300 text-[11.5px]">{act.text}</span>
                    </div>
                    <span className="text-[11px] text-neutral-500 shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>

            </div>

          </div>

        </div>

      </div>
    </section>
  );
};

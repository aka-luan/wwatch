import React from 'react';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';

export const PricingSection: React.FC = () => {
  return (
    <section id="pricing" className="relative py-24 sm:py-36 overflow-hidden border-t border-white/[0.06] bg-[#07080B]">
      
      {/* Background Ember Glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] bg-brand-orange/[0.04] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Tag */}
        <div className="flex items-center justify-center gap-2.5 text-xs font-mono tracking-widest text-neutral-400 uppercase mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          <span>PLANS &amp; PRICING</span>
        </div>

        {/* Big Editorial Headline */}
        <div className="text-center max-w-4xl mx-auto">
          <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-[4.5rem] font-extrabold tracking-[-0.04em] leading-[0.98] uppercase font-display select-none">
            <span className="block text-white">MONITOR EVERY SITE</span>
            <span className="block">
              <span className="text-brand-orange">BEFORE </span>
              <span className="text-stroke-white">SOMETHING</span>
            </span>
            <span className="block text-stroke-white">
              BREAKS<span className="inline-block w-3 h-3 md:w-3.5 md:h-3.5 bg-brand-orange ml-1.5 align-baseline translate-y-[-2px]" />
            </span>
          </h2>

          <p className="mt-8 text-sm sm:text-base text-neutral-400 font-sans max-w-xl mx-auto leading-relaxed">
            Start with a single site or bring your whole agency fleet. <br className="hidden sm:inline" />
            wwatch gives your team one unified place to watch, alert, and respond.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/app"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-brand-orange hover:bg-brand-orange-hover rounded-md transition-all shadow-glow-orange hover:shadow-glow-subtle active:scale-[0.98]"
            >
              <span>Open dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="https://github.com/aka-luan/wwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3.5 text-sm font-medium text-neutral-200 bg-[#12141A]/90 hover:bg-[#1A1D24] border border-white/10 hover:border-white/20 rounded-md transition-colors active:scale-[0.98]"
            >
              View on GitHub
            </a>
          </div>
        </div>

        {/* Pricing Cards Grid (2 Cards) */}
        <div className="mt-16 sm:mt-20 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          
          {/* 1. STARTER Card */}
          <div className="rounded-2xl bg-[#0D0F14]/90 border border-white/[0.08] p-6 sm:p-8 flex flex-col justify-between hover:border-white/15 transition-all">
            <div>
              <div className="text-xs font-mono font-semibold tracking-wider text-neutral-400 uppercase">
                STARTER
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-bold font-display text-white tracking-tight">
                  $19
                </span>
                <span className="text-xs font-mono text-neutral-400">/mo</span>
              </div>

              <p className="mt-2 text-xs font-mono text-neutral-500">
                For small teams &amp; side projects.
              </p>

              {/* Checklist */}
              <div className="mt-8 space-y-3 text-xs font-sans text-neutral-300">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Uptime monitoring (5 min intervals)</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>SSL tracking &amp; expiry alerts</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>WordPress core, plugin &amp; theme updates</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Daily backups &amp; restore verification</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Slack &amp; email notifications</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>1 team member</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>
                    Up to <span className="text-brand-orange font-semibold">10 sites</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. AGENCY Card */}
          <div className="rounded-2xl bg-[#0F1117]/95 border border-brand-orange/30 p-6 sm:p-8 flex flex-col justify-between relative shadow-glow-subtle hover:border-brand-orange/50 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-semibold tracking-wider text-neutral-400 uppercase">
                  AGENCY
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider uppercase bg-brand-orange/15 text-brand-orange border border-brand-orange/30">
                  POPULAR
                </span>
              </div>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-bold font-display text-white tracking-tight">
                  $79
                </span>
                <span className="text-xs font-mono text-neutral-400">/mo</span>
              </div>

              <p className="mt-2 text-xs font-mono text-neutral-500">
                Built for agencies &amp; growing teams.
              </p>

              {/* Checklist */}
              <div className="mt-8 space-y-3 text-xs font-sans text-neutral-300">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Everything in Starter</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Performance monitoring</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Anomaly &amp; change detection</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>White-label reports</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Priority alerts</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>Up to 5 team members</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                  <span>
                    Up to <span className="text-brand-orange font-semibold">50 sites</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Trust Badge */}
        <div className="mt-14 flex items-center justify-center gap-2 text-xs font-mono text-neutral-400">
          <ShieldCheck className="w-4 h-4 text-brand-orange" />
          <span>No monitoring agents required. Zero overhead. Just clear visibility.</span>
        </div>

      </div>
    </section>
  );
};

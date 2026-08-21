import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/[0.06] bg-[#050608] py-12 text-xs font-mono text-neutral-500">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        
        {/* Left: Brand */}
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 rounded bg-brand-orange flex items-center justify-center font-bold text-white text-[10px]">
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 5h3.5l3.5 10 3-8.5h2.5l3 8.5 3.5-10H23l-4.5 14h-3.5L12 9.5 8.9 19H5.4L4 5z" />
            </svg>
          </div>
          <span className="font-semibold text-neutral-300 font-sans">
            wwatch
          </span>
          <span className="text-neutral-700">|</span>
          <span>WordPress fleet operations &amp; observability</span>
        </div>

        {/* Center/Right: Links */}
        <div className="flex items-center gap-6 text-neutral-400">
          <a href="#platform" className="hover:text-white transition-colors">
            Platform
          </a>
          <a href="#features" className="hover:text-white transition-colors">
            Features
          </a>
          <a
            href="https://github.com/aka-luan/wwatch"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub
          </a>
          <a href="#pricing" className="hover:text-white transition-colors">
            Pricing
          </a>
          <a href="/app" className="hover:text-white transition-colors">
            Dashboard
          </a>
        </div>

        {/* Right: Operational Status */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-neutral-400">All systems operational</span>
        </div>

      </div>
    </footer>
  );
};

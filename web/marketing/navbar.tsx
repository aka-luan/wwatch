import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[#07080B]/85 border-b border-white/[0.07]">
      {/* Top Announcement Bar */}
      <div className="w-full bg-[#090B0F] border-b border-white/[0.05] py-2 px-4 text-center">
        <a
          href="#features"
          className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white transition-colors group"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange animate-pulse" />
          <span>Now live: monitor every WordPress site from one control plane</span>
          <span className="text-neutral-500 group-hover:text-brand-orange group-hover:translate-x-0.5 transition-all">
            →
          </span>
        </a>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo & Nav Links */}
        <div className="flex items-center gap-8 lg:gap-10">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-md bg-brand-orange flex items-center justify-center font-bold text-white shadow-glow-orange text-sm tracking-tighter">
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 5h3.5l3.5 10 3-8.5h2.5l3 8.5 3.5-10H23l-4.5 14h-3.5L12 9.5 8.9 19H5.4L4 5z" />
              </svg>
            </div>
            <span className="font-bold text-lg tracking-tight text-white font-sans">
              wwatch
            </span>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300 font-medium">
            <a href="#platform" className="hover:text-white transition-colors py-1">
              Platform
            </a>
            <a href="#features" className="hover:text-white transition-colors py-1">
              Features
            </a>
            <a
              href="https://github.com/aka-luan/wwatch"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors py-1"
            >
              Docs
            </a>
            <a href="#pricing" className="hover:text-white transition-colors py-1">
              Pricing
            </a>
          </nav>
        </div>

        {/* Right: Auth & CTA */}
        <div className="hidden md:flex items-center gap-5">
          <a
            href="/login"
            className="text-sm font-medium text-neutral-300 hover:text-white transition-colors"
          >
            Sign in
          </a>
          <a
            href="/app"
            className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold tracking-wide uppercase font-mono text-black bg-white rounded-md hover:bg-neutral-200 transition-colors shadow-sm active:scale-[0.98]"
          >
            Open dashboard
          </a>
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center gap-3">
          <a
            href="/app"
            className="px-3 py-1.5 text-xs font-bold font-mono text-black bg-white rounded-md"
          >
            Dashboard
          </a>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-neutral-400 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-white/[0.08] bg-[#0A0C10] px-4 py-6 space-y-4">
          <nav className="flex flex-col space-y-3 text-sm font-medium text-neutral-300">
            <a
              href="#platform"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1"
            >
              Platform
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1"
            >
              Features
            </a>
            <a
              href="https://github.com/aka-luan/wwatch"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1"
            >
              Docs
            </a>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="hover:text-white py-1"
            >
              Pricing
            </a>
          </nav>
          <div className="pt-4 border-t border-white/[0.08] flex flex-col gap-3">
            <a
              href="/login"
              className="text-center text-sm font-medium text-neutral-300 hover:text-white py-2"
            >
              Sign in
            </a>
            <a
              href="/app"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center text-xs font-bold font-mono text-black bg-white rounded-md py-2.5"
            >
              Open dashboard
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

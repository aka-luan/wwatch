import React, { useState } from 'react';
import { 
  Bell, 
  Users, 
  Clock, 
  Search, 
  ChevronDown, 
  RotateCw, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight,
  LayoutDashboard,
  Globe,
  AlertTriangle,
  FileText,
  Settings
} from 'lucide-react';
import { 
  DASHBOARD_SITES, 
  DASHBOARD_INCIDENTS, 
  RECENT_ALERT_CHECKS 
} from './dashboard-data';

export const DashboardSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Uptime' | 'SSL' | 'Updates' | 'Backups' | 'Performance' | 'Cron'>('Uptime');
  const [activeNav, setActiveNav] = useState('Overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSite, setSelectedSite] = useState('blog.marketinglab.io');

  const filteredSites = DASHBOARD_SITES.filter(site => 
    site.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <section id="features" className="relative py-24 sm:py-32 overflow-hidden border-t border-white/[0.06] bg-[#06070A]">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/3 w-[45rem] h-[45rem] bg-brand-orange/[0.04] rounded-full blur-[140px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Tag */}
        <div className="flex items-center gap-2.5 text-xs font-mono tracking-widest text-neutral-400 uppercase mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" />
          <span>REAL-TIME OBSERVABILITY</span>
        </div>

        {/* Section Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end mb-12">
          <div className="lg:col-span-7">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white tracking-[-0.03em] leading-[1.08] font-display">
              See the signal. <br />
              Fix the issue faster<span className="inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 bg-brand-orange ml-1 align-baseline translate-y-[-2px]" />
            </h2>
          </div>
          <div className="lg:col-span-5">
            <p className="text-sm sm:text-base text-neutral-400 font-sans leading-relaxed">
              Track uptime, SSL, updates, backups, cron failures, and performance across every WordPress environment.
            </p>
          </div>
        </div>

        {/* Main Section Content: Dashboard UI (Left) + 4 Feature Cards (Right) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Complete WordPress Monitoring Dashboard Interface (xl: 9 cols) */}
          <div className="xl:col-span-9 rounded-2xl bg-[#0B0D12] border border-white/[0.09] shadow-2xl overflow-hidden flex flex-col md:flex-row">
            
            {/* 1. Sidebar (md: 200px) */}
            <aside className="w-full md:w-52 bg-[#090A0F] border-b md:border-b-0 md:border-r border-white/[0.06] p-4 flex flex-col justify-between shrink-0">
              <div className="space-y-6">
                {/* Brand Logo in sidebar */}
                <div className="flex items-center gap-2 px-2 pt-1">
                  <div className="w-6 h-6 rounded bg-brand-orange flex items-center justify-center font-bold text-white text-xs">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-white" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 5h3.5l3.5 10 3-8.5h2.5l3 8.5 3.5-10H23l-4.5 14h-3.5L12 9.5 8.9 19H5.4L4 5z" />
                    </svg>
                  </div>
                  <span className="font-bold text-sm tracking-tight text-white font-sans">
                    wwatch
                  </span>
                </div>

                {/* Nav Items */}
                <nav className="space-y-1">
                  {[
                    { id: 'Overview', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
                    { id: 'Sites', icon: <Globe className="w-3.5 h-3.5" /> },
                    { id: 'Alerts', icon: <Bell className="w-3.5 h-3.5" /> },
                    { id: 'Incidents', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                    { id: 'Reports', icon: <FileText className="w-3.5 h-3.5" /> },
                    { id: 'Team', icon: <Users className="w-3.5 h-3.5" /> },
                    { id: 'Settings', icon: <Settings className="w-3.5 h-3.5" /> },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveNav(item.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        activeNav === item.id
                          ? 'bg-white/[0.08] text-white font-semibold'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.03]'
                      }`}
                    >
                      <span className={activeNav === item.id ? 'text-brand-orange' : 'text-neutral-500'}>
                        {item.icon}
                      </span>
                      <span>{item.id}</span>
                    </button>
                  ))}
                </nav>
              </div>

              {/* Lower Sidebar: Environments Status */}
              <div className="pt-6 space-y-4 border-t border-white/[0.06] mt-6 md:mt-0">
                <div className="px-2">
                  <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">
                    ENVIRONMENTS
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xl font-bold font-display text-white">42</span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
                      +3
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] font-mono">
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <span className="text-emerald-400">↑</span>
                      <span>38 healthy</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <span className="text-red-400">!</span>
                      <span>2 critical</span>
                    </div>
                  </div>
                </div>

                {/* User Avatar */}
                <div className="flex items-center gap-2.5 px-2 pt-2 border-t border-white/[0.04]">
                  <div className="w-7 h-7 rounded-full bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-bold text-xs">
                    OP
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-semibold text-white truncate font-sans">
                      Fleet Operator
                    </div>
                    <div className="text-[10px] font-mono text-neutral-500">
                      Admin
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* 2. Main Dashboard Content Area */}
            <div className="flex-1 p-4 sm:p-5 flex flex-col space-y-4 min-w-0 bg-[#0B0D12]">
              
              {/* Header Bar: Tabs + Filter Dropdowns */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-3.5">
                
                {/* Category Navigation Tabs */}
                <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-0.5">
                  {(['Uptime', 'SSL', 'Updates', 'Backups', 'Performance', 'Cron'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                        activeTab === tab
                          ? 'bg-white/[0.12] text-white border border-white/15 shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {/* Filter Controls */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#12141A] border border-white/[0.08] text-neutral-300">
                    <span>All environments</span>
                    <ChevronDown className="w-3 h-3 text-neutral-500" />
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#12141A] border border-white/[0.08] text-neutral-300">
                    <span>Last 24h</span>
                    <ChevronDown className="w-3 h-3 text-neutral-500" />
                  </div>
                  <button type="button" className="p-1 rounded bg-[#12141A] border border-white/[0.08] text-neutral-400 hover:text-white transition-colors" title="Refresh">
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Status Summary KPI Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                
                <div className="p-3 rounded-lg bg-[#0F1117] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">UP</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold font-display text-white">38</span>
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      90.5%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0F1117] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">DEGRADED</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold font-display text-white">2</span>
                    <span className="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      4.8%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0F1117] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">DOWN</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold font-display text-white">2</span>
                    <span className="text-[11px] font-mono text-red-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      4.8%
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0F1117] border border-white/[0.06]">
                  <div className="text-[10px] font-mono text-neutral-400 uppercase">INCIDENTS</div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold font-display text-white">5</span>
                    <span className="text-[11px] font-mono text-neutral-500">Last 24h</span>
                  </div>
                </div>

              </div>

              {/* 3-Column Core Dashboard View */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                
                {/* 1. Sites Table (lg: 4 cols) */}
                <div className="lg:col-span-4 rounded-xl bg-[#0E1016] border border-white/[0.06] p-3 flex flex-col space-y-3">
                  <div className="text-[10.5px] font-mono font-semibold text-neutral-400 uppercase tracking-wider">
                    SITES
                  </div>

                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input
                      type="text"
                      placeholder="Search sites..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-md bg-[#08090D] border border-white/[0.08] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-brand-orange/60 font-sans"
                    />
                  </div>

                  {/* Sites List */}
                  <div className="space-y-1 max-h-[320px] overflow-y-auto pr-0.5">
                    {filteredSites.map((site) => (
                      <div
                        key={site.id}
                        onClick={() => setSelectedSite(site.domain)}
                        className={`flex items-center justify-between p-2 rounded-md text-xs cursor-pointer transition-colors ${
                          selectedSite === site.domain
                            ? 'bg-white/[0.08] border border-white/[0.09]'
                            : 'hover:bg-white/[0.03] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <div className="w-4 h-4 rounded-full bg-[#181B24] flex items-center justify-center shrink-0 border border-white/5">
                            <svg viewBox="0 0 24 24" className="w-2.5 h-2.5 fill-neutral-400" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 1.25a8.73 8.73 0 0 1 5.3 1.8l-4.5 12.33-2.6-7.78 1.1-3.23a8.68 8.68 0 0 1 .7-.02c.4 0 .8.03 1.2.07l.2-.56H9.2l.2.56c.4-.04.8-.07 1.2-.07a5 5 0 0 1 .7.04l2.1 6.22-3.1 8.9A8.75 8.75 0 0 1 3.25 12a8.7 8.7 0 0 1 3.45-6.95L10.3 16.4l1.7-4.66z" />
                            </svg>
                          </div>
                          <span className="truncate font-mono text-[11px] text-neutral-300">
                            {site.domain}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 text-[10.5px] font-mono">
                          <span
                            className={`flex items-center gap-1 ${
                              site.status === 'Healthy' || site.status === 'Up'
                                ? 'text-emerald-400'
                                : site.status === 'Degraded'
                                ? 'text-amber-400'
                                : 'text-red-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                site.status === 'Healthy' || site.status === 'Up'
                                ? 'bg-emerald-400'
                                : site.status === 'Degraded'
                                ? 'bg-amber-400'
                                : 'bg-red-400'
                              }`}
                            />
                            {site.status}
                          </span>
                          <span className="text-neutral-500 text-[10px] w-10 text-right">
                            {site.latency}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Footer */}
                  <div className="pt-2 border-t border-white/[0.05] flex items-center justify-between text-[10.5px] font-mono text-neutral-500">
                    <span>1-8 of 42 sites</span>
                    <div className="flex items-center gap-1">
                      <button type="button" className="p-1 rounded bg-[#090A0E] border border-white/[0.06] hover:text-white">
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button type="button" className="p-1 rounded bg-[#090A0E] border border-white/[0.06] hover:text-white">
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. Incident Timeline & Response Time Graph (lg: 4 cols) */}
                <div className="lg:col-span-4 flex flex-col space-y-3.5">
                  
                  {/* Incident Timeline */}
                  <div className="rounded-xl bg-[#0E1016] border border-white/[0.06] p-3 flex flex-col space-y-2.5">
                    <div className="flex items-center justify-between text-[10.5px] font-mono">
                      <span className="font-semibold text-neutral-400 uppercase tracking-wider">
                        INCIDENT TIMELINE
                      </span>
                      <a href="/app" className="text-neutral-500 hover:text-neutral-300">
                        View all
                      </a>
                    </div>

                    <div className="space-y-2 pt-1">
                      {DASHBOARD_INCIDENTS.map((inc) => (
                        <div key={inc.id} className="flex items-start justify-between text-[11px] font-mono gap-2">
                          <div className="flex items-start gap-1.5 truncate">
                            <span className="text-neutral-500 text-[10px] shrink-0">{inc.time}</span>
                            <span
                              className={`w-1.5 h-1.5 rounded-full mt-1 shrink-0 ${
                                inc.severity === 'Warning'
                                  ? 'bg-amber-400'
                                  : inc.severity === 'Critical'
                                  ? 'bg-red-400'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            <div className="truncate">
                              <div className="text-neutral-200 truncate">{inc.domain}</div>
                              <div className="text-[10px] text-neutral-500 truncate">{inc.description}</div>
                            </div>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[9.5px] font-mono shrink-0 ${
                              inc.severity === 'Warning'
                                ? 'bg-amber-950/70 text-amber-400 border border-amber-800/40'
                                : inc.severity === 'Critical'
                                ? 'bg-red-950/70 text-red-400 border border-red-800/40'
                                : 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                            }`}
                          >
                            {inc.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Response Time (AVG) Chart */}
                  <div className="rounded-xl bg-[#0E1016] border border-white/[0.06] p-3 flex flex-col space-y-2">
                    <div className="flex items-center justify-between text-[10.5px] font-mono">
                      <span className="font-semibold text-neutral-400 uppercase tracking-wider">
                        RESPONSE TIME (AVG)
                      </span>
                      <span className="text-neutral-300 font-bold">512ms</span>
                    </div>

                    {/* Sparkline Canvas / SVG */}
                    <div className="h-28 w-full relative pt-2">
                      <svg viewBox="0 0 300 90" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF4D22" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#FF4D22" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Grid lines */}
                        <line x1="0" y1="20" x2="300" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        <line x1="0" y1="50" x2="300" y2="50" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                        <line x1="0" y1="80" x2="300" y2="80" stroke="rgba(255,255,255,0.05)" />

                        {/* Y-axis labels */}
                        <text x="2" y="16" fill="#71717a" fontSize="8" fontFamily="JetBrains Mono">1.5s</text>
                        <text x="2" y="46" fill="#71717a" fontSize="8" fontFamily="JetBrains Mono">1s</text>
                        <text x="2" y="76" fill="#71717a" fontSize="8" fontFamily="JetBrains Mono">500ms</text>

                        {/* Filled Area */}
                        <path
                          d="M 30,78 Q 60,75 90,78 T 150,72 T 180,68 T 195,15 T 210,65 T 240,74 T 270,72 L 290,75 L 290,85 L 30,85 Z"
                          fill="url(#chartGradient)"
                        />

                        {/* Stroke line with spike */}
                        <path
                          d="M 30,78 Q 60,75 90,78 T 150,72 T 180,68 T 195,15 T 210,65 T 240,74 T 270,72 L 290,75"
                          fill="none"
                          stroke="#FF4D22"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {/* Spike indicator pulse */}
                        <circle cx="195" cy="15" r="3.5" fill="#FF4D22" className="animate-ping" />
                        <circle cx="195" cy="15" r="2.5" fill="#FFFFFF" />
                      </svg>
                    </div>

                    {/* Timeline X-axis */}
                    <div className="flex items-center justify-between text-[8.5px] font-mono text-neutral-500 px-1 pt-1 border-t border-white/[0.04]">
                      <span>12:00</span>
                      <span>16:00</span>
                      <span>20:00</span>
                      <span>00:00</span>
                      <span>04:00</span>
                      <span>08:00</span>
                    </div>
                  </div>

                </div>

                {/* 3. Alert Details Inspector (lg: 4 cols) */}
                <div className="lg:col-span-4 rounded-xl bg-[#0E1016] border border-white/[0.06] p-3.5 flex flex-col space-y-3">
                  <div className="flex items-center justify-between text-[10.5px] font-mono">
                    <span className="font-semibold text-neutral-400 uppercase tracking-wider">
                      ALERT DETAILS
                    </span>
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium text-red-400 bg-red-950/60 border border-red-800/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      Critical
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white font-mono">
                      blog.marketinglab.io is down
                    </h4>
                    <p className="text-[10px] font-mono text-neutral-500 mt-0.5">
                      Since 10:19 AM (2m 32s)
                    </p>
                  </div>

                  {/* Attributes Grid */}
                  <div className="grid grid-cols-2 gap-y-1.5 text-[10.5px] font-mono py-2 border-y border-white/[0.06]">
                    <div>
                      <span className="text-neutral-500">Check</span>
                      <div className="text-neutral-200">Uptime</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Type</span>
                      <div className="text-neutral-200">HTTP</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Region</span>
                      <div className="text-neutral-200">US East</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">HTTP Code</span>
                      <div className="text-red-400 font-bold">500</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Last Response</span>
                      <div className="text-neutral-400">--</div>
                    </div>
                    <div>
                      <span className="text-neutral-500">Checked from</span>
                      <div className="text-neutral-200">5 locations</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-neutral-500">Next check</span>
                      <div className="text-neutral-200">in 1m 28s</div>
                    </div>
                  </div>

                  {/* Recent Checks list */}
                  <div>
                    <div className="text-[10px] font-mono text-neutral-500 uppercase mb-1.5">
                      RECENT CHECKS
                    </div>
                    <div className="space-y-1 text-[10.5px] font-mono">
                      {RECENT_ALERT_CHECKS.map((check, idx) => (
                        <div key={idx} className="flex items-center justify-between text-neutral-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-600">•</span>
                            <span>{check.time}</span>
                            <span className="text-neutral-600">•</span>
                            <span className={check.status === 'Down' ? 'text-red-400' : 'text-emerald-400'}>
                              {check.status}
                            </span>
                          </div>
                          <span className={check.code === '200' ? 'text-emerald-400' : 'text-neutral-400'}>
                            {check.code}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-2 space-y-2">
                    <a
                      href="/app"
                      className="w-full py-2 px-3 rounded-md bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-semibold font-sans flex items-center justify-center gap-1.5 transition-all shadow-glow-orange active:scale-[0.98]"
                    >
                      <span>Open live fleet</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </a>
                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* 4 Feature Cards (xl: 3 cols) */}
          <div className="xl:col-span-3 flex flex-col space-y-3.5">
            
            {/* Card 1: Unified alerts */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/15 transition-all">
              <div className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange w-fit mb-3">
                <Bell className="w-5 h-5 text-brand-orange" />
              </div>
              <h3 className="text-sm font-semibold text-white font-sans">
                Unified alerts
              </h3>
              <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed font-sans">
                All critical issues in one place. Smart grouping cuts noise so you see what matters.
              </p>
            </div>

            {/* Card 2: Deep WordPress checks */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/15 transition-all">
              <div className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange w-fit mb-3">
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-brand-orange" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 1.25a8.73 8.73 0 0 1 5.3 1.8l-4.5 12.33-2.6-7.78 1.1-3.23a8.68 8.68 0 0 1 .7-.02c.4 0 .8.03 1.2.07l.2-.56H9.2l.2.56c.4-.04.8-.07 1.2-.07a5 5 0 0 1 .7.04l2.1 6.22-3.1 8.9A8.75 8.75 0 0 1 3.25 12a8.7 8.7 0 0 1 3.45-6.95L10.3 16.4l1.7-4.66z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white font-sans">
                Deep WordPress checks
              </h3>
              <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed font-sans">
                Monitor SSL, core, plugins, themes, cron, and PHP health beyond basic uptime.
              </p>
            </div>

            {/* Card 3: Team workflows */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/15 transition-all">
              <div className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange w-fit mb-3">
                <Users className="w-5 h-5 text-brand-orange" />
              </div>
              <h3 className="text-sm font-semibold text-white font-sans">
                Team workflows
              </h3>
              <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed font-sans">
                Assign, comment, and resolve incidents together with clear ownership and notifications.
              </p>
            </div>

            {/* Card 4: Status history */}
            <div className="p-4 rounded-xl bg-[#0D0F14] border border-white/[0.08] hover:border-white/15 transition-all">
              <div className="p-2 rounded-lg bg-brand-orange/10 text-brand-orange w-fit mb-3">
                <Clock className="w-5 h-5 text-brand-orange" />
              </div>
              <h3 className="text-sm font-semibold text-white font-sans">
                Status history
              </h3>
              <p className="mt-1.5 text-xs text-neutral-400 leading-relaxed font-sans">
                Detailed logs and timelines help you troubleshoot faster and prevent repeats.
              </p>
            </div>

            {/* Explore Dashboard CTA */}
            <a
              href="/app"
              className="mt-2 w-full py-3.5 px-4 rounded-xl border border-brand-orange/40 hover:border-brand-orange bg-brand-orange/5 hover:bg-brand-orange/10 text-brand-orange hover:text-brand-orange-light text-xs font-bold font-mono tracking-wide uppercase flex items-center justify-center gap-2 transition-all group"
            >
              <span>Explore the dashboard</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>

          </div>

        </div>

      </div>
    </section>
  );
};

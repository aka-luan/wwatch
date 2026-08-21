export interface MonitoredSignal {
  id: string;
  icon: string;
  name: string;
  sub: string;
  status: 'healthy' | 'warning' | 'critical';
  statusText: string;
}

export interface ActivityItem {
  id: string;
  text: string;
  time: string;
  status: 'healthy' | 'warning' | 'critical';
}

export interface SiteItem {
  id: string;
  domain: string;
  status: 'Healthy' | 'Degraded' | 'Up' | 'Down';
  latency: string;
}

export interface IncidentItem {
  id: string;
  time: string;
  domain: string;
  description: string;
  severity: 'Warning' | 'Critical' | 'Resolved';
}

export interface RecentCheckItem {
  time: string;
  status: 'Up' | 'Down';
  code: string;
}

export const HERO_SIGNALS: MonitoredSignal[] = [
  {
    id: 'uptime',
    icon: 'globe',
    name: 'Uptime',
    sub: '5 min interval',
    status: 'healthy',
    statusText: 'Healthy',
  },
  {
    id: 'ssl',
    icon: 'lock',
    name: 'SSL Expiry',
    sub: '30 days threshold',
    status: 'warning',
    statusText: 'Warning',
  },
  {
    id: 'plugins',
    icon: 'puzzle',
    name: 'Plugin Updates',
    sub: 'Auto-detected',
    status: 'critical',
    statusText: 'Critical',
  },
  {
    id: 'backups',
    icon: 'cloud',
    name: 'Backup Status',
    sub: 'Daily verification',
    status: 'healthy',
    statusText: 'Healthy',
  },
  {
    id: 'php',
    icon: 'clock',
    name: 'PHP & Performance',
    sub: 'Health score',
    status: 'warning',
    statusText: 'Warning',
  },
  {
    id: 'cron',
    icon: 'terminal',
    name: 'Cron & Jobs',
    sub: 'Execution checks',
    status: 'critical',
    statusText: 'Critical',
  },
  {
    id: 'incidents',
    icon: 'shield',
    name: 'Incidents',
    sub: 'Anomaly detection',
    status: 'healthy',
    statusText: 'Healthy',
  },
];

export const HERO_RECENT_ACTIVITY: ActivityItem[] = [
  { id: '1', text: 'Uptime check passed', time: '10:24:31', status: 'healthy' },
  { id: '2', text: 'SSL expires in 28 days', time: '10:23:12', status: 'warning' },
  { id: '3', text: 'Plugin update available: WooCommerce', time: '10:22:47', status: 'critical' },
  { id: '4', text: 'Backup verification successful', time: '10:21:09', status: 'healthy' },
  { id: '5', text: 'Cron job failed: wp_scheduled_event', time: '10:20:33', status: 'critical' },
  { id: '6', text: 'Performance score: 92/100', time: '10:19:58', status: 'healthy' },
];

export const DASHBOARD_SITES: SiteItem[] = [
  { id: '1', domain: 'agency-example.com', status: 'Healthy', latency: '512ms' },
  { id: '2', domain: 'plugin-update.com', status: 'Degraded', latency: '1.2s' },
  { id: '3', domain: 'woocommerce-store.com', status: 'Up', latency: '421ms' },
  { id: '4', domain: 'blog.marketinglab.io', status: 'Down', latency: '--' },
  { id: '5', domain: 'careers.example.com', status: 'Up', latency: '340ms' },
  { id: '6', domain: 'dev.example.com', status: 'Down', latency: '--' },
  { id: '7', domain: 'newsroom.example.com', status: 'Up', latency: '285ms' },
  { id: '8', domain: 'shop.example.com', status: 'Up', latency: '612ms' },
];

export const DASHBOARD_INCIDENTS: IncidentItem[] = [
  {
    id: '1',
    time: '10:21',
    domain: 'plugin-update.com',
    description: 'SSL certificate expires in 7 days',
    severity: 'Warning',
  },
  {
    id: '2',
    time: '10:19',
    domain: 'blog.marketinglab.io',
    description: 'Site down',
    severity: 'Critical',
  },
  {
    id: '3',
    time: '09:58',
    domain: 'dev.example.com',
    description: 'Connection timeout',
    severity: 'Critical',
  },
  {
    id: '4',
    time: '09:41',
    domain: 'agency-example.com',
    description: 'Uptime check passed',
    severity: 'Resolved',
  },
  {
    id: '5',
    time: '09:32',
    domain: 'shop.example.com',
    description: 'Backup failed',
    severity: 'Critical',
  },
];

export const RECENT_ALERT_CHECKS: RecentCheckItem[] = [
  { time: '10:19', status: 'Down', code: '500' },
  { time: '10:18', status: 'Down', code: 'Timeout' },
  { time: '10:17', status: 'Down', code: 'Timeout' },
  { time: '10:16', status: 'Up', code: '200' },
  { time: '10:15', status: 'Up', code: '200' },
];

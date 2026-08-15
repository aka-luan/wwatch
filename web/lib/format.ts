export function host(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

export function ago(iso: string | null | undefined): string {
  if (!iso) {
    return "never";
  }
  const ms = Date.now() - Date.parse(iso);
  const min = Math.round(ms / 60000);
  if (min < 1) {
    return "just now";
  }
  if (min < 60) {
    return `${min}m ago`;
  }
  const hr = Math.round(min / 60);
  if (hr < 48) {
    return `${hr}h ago`;
  }
  return `${Math.round(hr / 24)}d ago`;
}

/** Absolute local stamp for “Showing results from …”. */
export function formatScanWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Compact local stamp for the scan timeline: “Today · 13:21”. */
export function timelineWhen(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  const time = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  if (sameLocalDay(date, now)) {
    return `Today · ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameLocalDay(date, yesterday)) {
    return `Yesterday · ${time}`;
  }
  const day = date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day} · ${time}`;
}

function sameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Longer relative phrase for failure copy (“18 minutes ago”). */
export function agoWords(iso: string | null | undefined): string {
  if (!iso) {
    return "never";
  }
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) {
    return "just now";
  }
  if (min === 1) {
    return "1 minute ago";
  }
  if (min < 60) {
    return `${min} minutes ago`;
  }
  const hr = Math.round(min / 60);
  if (hr === 1) {
    return "1 hour ago";
  }
  if (hr < 48) {
    return `${hr} hours ago`;
  }
  const days = Math.round(hr / 24);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

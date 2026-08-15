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

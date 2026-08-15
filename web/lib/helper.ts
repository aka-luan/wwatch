export type HelperCapability = "login" | "update" | "repair";

export type HelperInfo =
  | { kind: "missing" }
  | { kind: "installed"; version: string; capabilities: HelperCapability[] };

export const REPAIRABLE_PATHS = [
  "/debug.log",
  "/wp-content/debug.log",
  "/readme.html",
  "/license.txt",
  "/wp-config.php.bak",
  "/wp-config.php.save",
  "/wp-config.php.old",
] as const;

export function helperCan(helper: HelperInfo | null | undefined, capability: HelperCapability): boolean {
  return Boolean(helper && helper.kind === "installed" && helper.capabilities.includes(capability));
}

export function isRepairablePath(path: string | undefined): boolean {
  return Boolean(path && (REPAIRABLE_PATHS as readonly string[]).includes(path));
}

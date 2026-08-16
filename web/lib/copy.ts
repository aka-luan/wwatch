/**
 * Centralized English copy for the site list / row-expansion redesign. Backend finding titles
 * (src/scan.ts) are already English-only, so there is nothing to translate today — this module
 * exists so new UI-owned strings have one home instead of drifting across components.
 */
export const COPY = {
  summary: {
    counter: (label: string, count: number) => `${count} ${label}`,
    updateAll: (count: number) => `Update all ${count}`,
  },
  row: {
    needsAction: "Needs action",
    informational: (count: number) => `${count} informational finding${count === 1 ? "" : "s"}`,
    noAction: "No action required on the last scan.",
    notScannedYet: "Not scanned yet.",
    viewLinks: (count: number) => `View ${count} link${count === 1 ? "" : "s"}`,
    scanHistory: "Scan history",
    siteConfiguration: "Site configuration",
  },
  addSite: {
    stepsTrigger: "How do I create one?",
    steps: [
      "In WP Admin, open Users → Profile → Application Passwords on an administrator account.",
      "Name the password and click “Add New Application Password.”",
      "Copy the account’s WordPress username and the generated application password WordPress shows once.",
    ],
  },
  updateAllConfirm: {
    title: (count: number) => `Update ${count} item${count === 1 ? "" : "s"} across the fleet?`,
    description: "Update every plugin and theme with a pending wordpress.org update, on every site that allows it. Core updates are not included.",
    action: "Update all",
  },
} as const;

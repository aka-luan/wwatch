
type CheckItem = {
  category: string;
  name: string;
  probe: string;
  requirement: "Core REST (Zero Install)" | "Helper Plugin 1.3.0";
  description: string;
};

const CHECKS: CheckItem[] = [
  {
    category: "Availability",
    name: "Homepage Reachability & TTFB",
    probe: "GET /",
    requirement: "Core REST (Zero Install)",
    description: "Validates HTTP 200 response, measures time-to-first-byte, and extracts generator meta version.",
  },
  {
    category: "Core Updates",
    name: "WordPress Version & Security Patches",
    probe: "GET /wp-json + api.wordpress.org",
    requirement: "Core REST (Zero Install)",
    description: "Compares current installed WordPress release against latest stable releases on wordpress.org.",
  },
  {
    category: "Plugin & Themes",
    name: "Installed Versions & Vulnerabilities",
    probe: "GET /wp/v2/plugins",
    requirement: "Core REST (Zero Install)",
    description: "Enumerates all active and inactive plugins, checking each version against wordpress.org APIs.",
  },
  {
    category: "Security",
    name: "Exposed Sensitive Files",
    probe: "HEAD /debug.log, /wp-config.php.bak, /.git/HEAD",
    requirement: "Core REST (Zero Install)",
    description: "Probes public webroot for leaked stack traces, database backup configs, and exposed git repositories.",
  },
  {
    category: "Security",
    name: "XML-RPC Method Invocation",
    probe: "POST /xmlrpc.php",
    requirement: "Core REST (Zero Install)",
    description: "Tests whether XML-RPC responds to remote method calls (a frequent amplification/bruteforce vector).",
  },
  {
    category: "SSL / TLS",
    name: "TLS Certificate Expiration Window",
    probe: "Direct TLS Socket Handshake",
    requirement: "Core REST (Zero Install)",
    description: "Measures exact days remaining before SSL/TLS certificate expires on HTTPS origins.",
  },
  {
    category: "Integrity",
    name: "Same-Origin Broken Links",
    probe: "Depth-1 Homepage Crawler",
    requirement: "Core REST (Zero Install)",
    description: "Crawls all internal links referenced on the homepage and reports 404/500 broken targets.",
  },
  {
    category: "Diagnostics",
    name: "WordPress Core File Checksums",
    probe: "GET /wp-json/wwatch/v1/health",
    requirement: "Helper Plugin 1.3.0",
    description: "Validates local core files against official WordPress sha256 checksums to flag unexpected file edits.",
  },
  {
    category: "Diagnostics",
    name: "PHP Runtime & Memory Ceiling",
    probe: "GET /wp-json/wwatch/v1/health",
    requirement: "Helper Plugin 1.3.0",
    description: "Audits installed PHP version against core requirements and flags memory limits under 64MB.",
  },
  {
    category: "Diagnostics",
    name: "Cron Schedule & Autoload Table Size",
    probe: "GET /wp-json/wwatch/v1/health",
    requirement: "Helper Plugin 1.3.0",
    description: "Reports missed cron events, WP_DEBUG on production, and warns if autoloaded options exceed 1MB.",
  },
  {
    category: "Diagnostics",
    name: "Admin User Audit & Security Constants",
    probe: "GET /wp-json/wwatch/v1/health",
    requirement: "Helper Plugin 1.3.0",
    description: "Checks administrator count, identifies legacy 'admin' accounts, and audits DISALLOW_FILE_EDIT flags.",
  },
];

export function ScanChecks() {
  return (
    <section id="checks" className="py-20 sm:py-28 border-t border-border">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div>
          <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            TECHNICAL MATRIX
          </span>
          <h2 className="mt-3 font-sans text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            What a scan checks
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground max-w-2xl">
            Every scan executes a comprehensive, non-destructive battery of probes. Results are recorded as immutable
            snapshots without altering your production site.
          </p>
        </div>

        {/* Technical Capabilities Matrix Table */}
        <div className="mt-12 overflow-x-auto rounded-xl border border-border bg-card shadow-xl">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-raised/80 font-mono text-[11px] text-muted-foreground">
                <th className="py-3 px-4 font-semibold">CHECK</th>
                <th className="py-3 px-4 font-semibold hidden md:table-cell">PROBE / ENDPOINT</th>
                <th className="py-3 px-4 font-semibold">REQUIREMENT</th>
                <th className="py-3 px-4 font-semibold">DESCRIPTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-sans">
              {CHECKS.map((check, idx) => (
                <tr key={idx} className="transition-colors hover:bg-muted/30">
                  <td className="py-3.5 px-4 font-medium text-foreground whitespace-nowrap">
                    <div>
                      <span>{check.name}</span>
                      <span className="block font-mono text-[11px] text-muted-foreground md:hidden mt-0.5">
                        {check.probe}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[12px] text-ring hidden md:table-cell whitespace-nowrap">
                    {check.probe}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[11px] ${
                        check.requirement.includes("Zero Install")
                          ? "bg-success/10 text-success border border-success/20"
                          : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {check.requirement}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-muted-foreground leading-relaxed">
                    {check.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

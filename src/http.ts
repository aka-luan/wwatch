import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { asSiteId } from "./domain.js";
import { Fleet } from "./fleet.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const SESSION_PURPOSE = "wwatch-session-v1";
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function createApp(fleet: Fleet, dashboardPassword = "", cronSecret = ""): Hono {
  const app = new Hono();
  const loginFailures = new Map<string, { count: number; resetAt: number }>();

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Content-Security-Policy", CSP);
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    c.header("Cross-Origin-Resource-Policy", "same-origin");
    c.header("Cross-Origin-Opener-Policy", "same-origin");
    c.header("X-DNS-Prefetch-Control", "off");
    if (c.req.path.startsWith("/api/")) {
      c.header("Cache-Control", "no-store");
    }
    if (process.env.VERCEL === "1") {
      c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
  });

  app.use("*", async (c, next) => {
    if (!dashboardPassword) {
      await next();
      return;
    }
    const open = new Set([
      "/login.html",
      "/login",
      "/login.js",
      "/api/login",
      "/styles.css",
      "/app.js",
      "/favicon.ico",
    ]);
    if (open.has(c.req.path)) {
      await next();
      return;
    }
    if (isCronScanAll(c, cronSecret)) {
      await next();
      return;
    }
    const cookie = parseCookie(c.req.header("cookie") ?? "")["watch"];
    if (cookie && secretsEqual(cookie, sessionToken(dashboardPassword))) {
      await next();
      return;
    }
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "auth required" }, 401);
    }
    return c.redirect("/login.html");
  });

  app.get("/api/sites", async (c) => c.json(await fleet.overview()));

  app.post("/api/sites", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ error: "invalid json" }, 400);
    }
    try {
      const site = await fleet.connect({
        name: String(body.name ?? ""),
        origin: String(body.origin ?? ""),
        username: String(body.username ?? ""),
        applicationPassword: String(body.applicationPassword ?? ""),
      });
      return c.json(site, 201);
    } catch (error) {
      return c.json({ error: message(error) }, 400);
    }
  });

  app.get("/api/sites/:id", async (c) => {
    try {
      return c.json(await fleet.sitePage(asSiteId(c.req.param("id"))));
    } catch (error) {
      return c.json({ error: message(error) }, 404);
    }
  });

  app.delete("/api/sites/:id", async (c) => {
    await fleet.disconnect(asSiteId(c.req.param("id")));
    return c.body(null, 204);
  });

  app.post("/api/sites/:id/scan", async (c) => {
    try {
      return c.json(await fleet.startScan(asSiteId(c.req.param("id")), deferFrom(c)));
    } catch (error) {
      return c.json({ error: message(error) }, 404);
    }
  });

  app.on(["GET", "POST"], "/api/scan-all", async (c) => {
    if (dashboardPassword && c.req.method === "GET" && !isCronScanAll(c, cronSecret)) {
      return c.json({ error: "auth required" }, 401);
    }
    const rows = await fleet.overview();
    const started = await Promise.all(rows.map((row) => fleet.startScan(row.site.id, deferFrom(c))));
    return c.json({ started: started.length });
  });

  app.post("/api/sites/:id/plugins", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ error: "invalid json" }, 400);
    }
    try {
      const plugin = await fleet.setPluginStatus({
        siteId: asSiteId(c.req.param("id")),
        plugin: String(body.plugin ?? ""),
        status: body.status === "active" ? "active" : "inactive",
      });
      return c.json(plugin);
    } catch (error) {
      return c.json({ error: message(error) }, 400);
    }
  });

  app.post("/api/login", async (c) => {
    const ip = clientIp(c);
    if (!loginAllowed(loginFailures, ip)) {
      return c.json({ error: "too many attempts" }, 429);
    }
    const body = await readJsonObject(c);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!dashboardPassword || !secretsEqual(password, dashboardPassword)) {
      recordLoginFailure(loginFailures, ip);
      return c.json({ error: "wrong password" }, 401);
    }
    loginFailures.delete(ip);
    const secure = cookieSecure(c);
    c.header(
      "set-cookie",
      `watch=${encodeURIComponent(sessionToken(dashboardPassword))}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
    return c.json({ ok: true });
  });

  return app;
}

function isCronScanAll(
  c: { req: { path: string; header: (name: string) => string | undefined } },
  cronSecret: string,
): boolean {
  if (!cronSecret || c.req.path !== "/api/scan-all") {
    return false;
  }
  const header = c.req.header("authorization") ?? "";
  return secretsEqual(header, `Bearer ${cronSecret}`);
}

function deferFrom(c: { executionCtx?: { waitUntil?: (work: Promise<unknown>) => void } }) {
  return (work: Promise<unknown>) => {
    try {
      c.executionCtx?.waitUntil?.(work);
    } catch {
      void work;
    }
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : "request failed";
}

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) {
      try {
        out[key] = decodeURIComponent(rest.join("="));
      } catch {
        out[key] = rest.join("=");
      }
    }
  }
  return out;
}

async function readJsonObject(c: { req: { json: () => Promise<unknown> } }): Promise<Record<string, unknown> | null> {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    return body as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sessionToken(password: string): string {
  return createHmac("sha256", password).update(SESSION_PURPOSE).digest("base64url");
}

function secretsEqual(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return c.req.header("x-real-ip") ?? "local";
}

function loginAllowed(failures: Map<string, { count: number; resetAt: number }>, ip: string): boolean {
  const now = Date.now();
  const row = failures.get(ip);
  if (!row || now > row.resetAt) {
    return true;
  }
  return row.count < LOGIN_MAX_FAILURES;
}

function recordLoginFailure(failures: Map<string, { count: number; resetAt: number }>, ip: string): void {
  const now = Date.now();
  const row = failures.get(ip);
  if (!row || now > row.resetAt) {
    failures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  row.count += 1;
}

function cookieSecure(c: { req: { url: string; header: (name: string) => string | undefined } }): string {
  if (process.env.VERCEL === "1") {
    return "; Secure";
  }
  const proto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(/:$/, "");
  return proto === "https" ? "; Secure" : "";
}

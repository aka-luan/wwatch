import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import { asSiteId, parseRepairTarget, parseUpdateTarget } from "./domain.js";
import { Fleet } from "./fleet.js";
import { helperPluginFile } from "./helper.js";

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_PURPOSE = "wwatch-session-v1";
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-attr 'unsafe-inline'",
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
      "/api/logout",
      "/styles.css",
      "/app.js",
      "/favicon.ico",
    ]);
    if (open.has(c.req.path) || c.req.path.startsWith("/assets/")) {
      await next();
      return;
    }
    if (isCronScanAll(c, cronSecret)) {
      await next();
      return;
    }
    const cookie = parseCookie(c.req.header("cookie") ?? "")["watch"];
    if (cookie && sessionCookieValid(cookie, dashboardPassword)) {
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

  app.patch("/api/sites/:id", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ error: "invalid json" }, 400);
    }
    try {
      const site = await fleet.update(asSiteId(c.req.param("id")), {
        ...(typeof body.name === "string" ? { name: body.name } : {}),
        ...(typeof body.username === "string" ? { username: body.username } : {}),
        ...(typeof body.applicationPassword === "string" ? { applicationPassword: body.applicationPassword } : {}),
      });
      return c.json(site);
    } catch (error) {
      const text = message(error);
      return c.json({ error: text }, text === "Unknown site" ? 404 : 400);
    }
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

  app.post("/api/sites/:id/wp-login", async (c) => {
    try {
      return c.json(await fleet.wpLogin(asSiteId(c.req.param("id"))));
    } catch (error) {
      const text = message(error);
      return c.json({ error: text }, text === "Unknown site" ? 404 : 400);
    }
  });

  app.post("/api/sites/:id/update", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ error: "invalid json" }, 400);
    }
    try {
      const result = await fleet.applyUpdate(asSiteId(c.req.param("id")), parseUpdateTarget(body), deferFrom(c));
      return c.json(result);
    } catch (error) {
      const text = message(error);
      return c.json({ error: text }, text === "Unknown site" ? 404 : 400);
    }
  });

  app.post("/api/sites/:id/repair", async (c) => {
    const body = await readJsonObject(c);
    if (!body) {
      return c.json({ error: "invalid json" }, 400);
    }
    try {
      const result = await fleet.applyRepair(asSiteId(c.req.param("id")), parseRepairTarget(body), deferFrom(c));
      return c.json(result);
    } catch (error) {
      const text = message(error);
      return c.json({ error: text }, text === "Unknown site" ? 404 : 400);
    }
  });

  app.get("/api/helper-plugin", (c) => {
    try {
      const file = helperPluginFile();
      c.header("content-type", file.contentType);
      c.header("content-disposition", `attachment; filename="${file.filename}"`);
      return c.body(new Uint8Array(file.body));
    } catch (error) {
      return c.json({ error: message(error) }, 500);
    }
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
    if (!(await fleet.loginAllowed(ip))) {
      return c.json({ error: "too many attempts" }, 429);
    }
    const body = await readJsonObject(c);
    const password = typeof body?.password === "string" ? body.password : "";
    if (!dashboardPassword || !secretsEqual(password, dashboardPassword)) {
      await fleet.recordLoginFailure(ip);
      return c.json({ error: "wrong password" }, 401);
    }
    await fleet.clearLoginFailures(ip);
    c.header("set-cookie", watchCookie(sessionToken(dashboardPassword), c, Math.floor(SESSION_TTL_MS / 1000)));
    return c.json({ ok: true });
  });

  app.post("/api/logout", async (c) => {
    c.header("set-cookie", watchCookie("", c, 0));
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

export function sessionToken(password: string, issuedAt = Date.now()): string {
  const issued = String(issuedAt);
  const mac = createHmac("sha256", password).update(`${SESSION_PURPOSE}:${issued}`).digest("base64url");
  return `${issued}.${mac}`;
}

export function sessionCookieValid(cookie: string, password: string, now = Date.now()): boolean {
  const dot = cookie.indexOf(".");
  if (dot <= 0) {
    return false;
  }
  const issuedAt = Number(cookie.slice(0, dot));
  if (!Number.isFinite(issuedAt) || issuedAt > now + 60_000 || now - issuedAt > SESSION_TTL_MS) {
    return false;
  }
  return secretsEqual(cookie, sessionToken(password, issuedAt));
}

function watchCookie(
  value: string,
  c: { req: { url: string; header: (name: string) => string | undefined } },
  maxAge: number,
): string {
  return `watch=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${cookieSecure(c)}`;
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

function cookieSecure(c: { req: { url: string; header: (name: string) => string | undefined } }): string {
  if (process.env.VERCEL === "1") {
    return "; Secure";
  }
  const proto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(/:$/, "");
  return proto === "https" ? "; Secure" : "";
}

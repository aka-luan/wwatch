import { Hono } from "hono";
import { asSiteId } from "./domain.js";
import { Fleet } from "./fleet.js";

export function createApp(fleet: Fleet, dashboardPassword = ""): Hono {
  const app = new Hono();

  app.use("*", async (c, next) => {
    if (!dashboardPassword) {
      await next();
      return;
    }
    const open = new Set([
      "/login.html",
      "/login",
      "/api/login",
      "/styles.css",
      "/app.js",
      "/favicon.ico",
    ]);
    if (open.has(c.req.path)) {
      await next();
      return;
    }
    const cookie = parseCookie(c.req.header("cookie") ?? "")["watch"];
    if (cookie === dashboardPassword) {
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
    const body = await c.req.json();
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

  app.post("/api/scan-all", async (c) => {
    const rows = await fleet.overview();
    const started = await Promise.all(rows.map((row) => fleet.startScan(row.site.id, deferFrom(c))));
    return c.json({ started: started.length });
  });

  app.post("/api/sites/:id/plugins", async (c) => {
    const body = await c.req.json();
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
    const body = await c.req.json();
    if (!dashboardPassword || body.password !== dashboardPassword) {
      return c.json({ error: "wrong password" }, 401);
    }
    const secure = process.env.VERCEL === "1" ? "; Secure" : "";
    c.header(
      "set-cookie",
      `watch=${encodeURIComponent(dashboardPassword)}; Path=/; HttpOnly; SameSite=Lax${secure}`,
    );
    return c.json({ ok: true });
  });

  return app;
}

function deferFrom(c: { executionCtx?: { waitUntil?: (work: Promise<unknown>) => void } }) {
  return (work: Promise<unknown>) => {
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(work);
      return;
    }
    void work;
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
      out[key] = decodeURIComponent(rest.join("="));
    }
  }
  return out;
}

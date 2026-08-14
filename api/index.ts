import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { Fleet } from "../src/fleet.js";
import { Store, storeConfigFromEnv } from "../src/store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

function deployConfigError(): string | undefined {
  if (!process.env.DASHBOARD_PASSWORD) {
    return "Set DASHBOARD_PASSWORD before deploying wwatch";
  }
  if (!process.env.TURSO_DATABASE_URL) {
    return "Set TURSO_DATABASE_URL before deploying wwatch";
  }
  if (!process.env.TURSO_AUTH_TOKEN) {
    return "Set TURSO_AUTH_TOKEN before deploying wwatch";
  }
  return undefined;
}

function appFromEnv() {
  const error = deployConfigError();
  if (error) {
    const app = new Hono();
    app.all("*", (c) => c.json({ error }, 500));
    return app;
  }
  return createApp(new Fleet(new Store(storeConfigFromEnv())), process.env.DASHBOARD_PASSWORD ?? "");
}

export default handle(appFromEnv());

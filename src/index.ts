import { Hono } from "hono";
import { alertConfigFromEnv } from "./alert.js";
import { Fleet } from "./fleet.js";
import { defaultDeps } from "./scan.js";
import { createLocalApp } from "./server.js";
import { Store, storeConfigFromEnv } from "./store.js";

function deployConfigError(): string | undefined {
  if (!process.env.DASHBOARD_PASSWORD) {
    return "Set DASHBOARD_PASSWORD before deploying wwatch";
  }
  if (!process.env.WATCH_SECRET) {
    return "Set WATCH_SECRET (32+ random bytes, not the board password) before deploying wwatch";
  }
  if (!process.env.TURSO_DATABASE_URL) {
    return "Set TURSO_DATABASE_URL before deploying wwatch";
  }
  if (!process.env.TURSO_AUTH_TOKEN) {
    return "Set TURSO_AUTH_TOKEN before deploying wwatch";
  }
  return undefined;
}

function configErrorApp(error: string): Hono {
  const app = new Hono();
  app.all("*", (c) => c.json({ error }, 500));
  return app;
}

const error = deployConfigError();

export default error
  ? configErrorApp(error)
  : createLocalApp(
      new Fleet(new Store(storeConfigFromEnv()), defaultDeps, alertConfigFromEnv()),
      process.env.DASHBOARD_PASSWORD ?? "",
      process.env.CRON_SECRET ?? "",
    );

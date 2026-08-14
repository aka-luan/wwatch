import { Hono } from "hono";
import { Fleet } from "./fleet.js";
import { createLocalApp } from "./server.js";
import { Store, storeConfigFromEnv } from "./store.js";

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

function configErrorApp(error: string): Hono {
  const app = new Hono();
  app.all("*", (c) => c.json({ error }, 500));
  return app;
}

const error = deployConfigError();

export default error
  ? configErrorApp(error)
  : createLocalApp(new Fleet(new Store(storeConfigFromEnv())), process.env.DASHBOARD_PASSWORD ?? "");

import { pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { alertConfigFromEnv } from "./alert.js";
import { createApp } from "./http.js";
import { Fleet } from "./fleet.js";
import { defaultDeps } from "./scan.js";
import { Store, storeConfigFromEnv } from "./store.js";

export { createApp } from "./http.js";

export function createLocalApp(fleet: Fleet, dashboardPassword = "", cronSecret = "") {
  const app = createApp(fleet, dashboardPassword, cronSecret);
  app.get("/login", serveStatic({ path: "./public/login.html" }));
  app.get("/app", serveStatic({ path: "./public/app.html" }));
  app.use("/*", serveStatic({ root: "./public" }));
  return app;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1";
  const fleet = new Fleet(new Store(storeConfigFromEnv()), defaultDeps, alertConfigFromEnv());
  const app = createLocalApp(fleet, process.env.DASHBOARD_PASSWORD ?? "", process.env.CRON_SECRET ?? "");
  serve({ fetch: app.fetch, hostname: host, port }, (info) => {
    console.log(`wwatch on http://${info.address}:${info.port}`);
  });
}

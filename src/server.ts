import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./http.js";
import { Fleet } from "./fleet.js";
import { Store, storeConfigFromEnv } from "./store.js";

export { createApp } from "./http.js";

export function createLocalApp(fleet: Fleet, dashboardPassword = "") {
  const app = createApp(fleet, dashboardPassword);
  app.get("/login", serveStatic({ path: "./public/login.html" }));
  app.use("/*", serveStatic({ root: "./public" }));
  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? "127.0.0.1";
  const fleet = new Fleet(new Store(storeConfigFromEnv()));
  const app = createLocalApp(fleet, process.env.DASHBOARD_PASSWORD ?? "");
  serve({ fetch: app.fetch, hostname: host, port }, (info) => {
    console.log(`wwatch on http://${info.address}:${info.port}`);
  });
}

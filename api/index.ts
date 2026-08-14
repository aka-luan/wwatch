import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { Fleet } from "../src/fleet.js";
import { Store, storeConfigFromEnv } from "../src/store.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const password = process.env.DASHBOARD_PASSWORD ?? "";
if (!password) {
  throw new Error("Set DASHBOARD_PASSWORD before deploying wwatch");
}
if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("Set TURSO_DATABASE_URL before deploying wwatch");
}

const app = createApp(new Fleet(new Store(storeConfigFromEnv())), password);

export default handle(app);

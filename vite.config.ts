import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: "web",
  publicDir: false,
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./web"),
    },
  },
  build: {
    outDir: path.resolve(rootDir, "./public"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, "./web/index.html"),
        app: path.resolve(rootDir, "./web/app.html"),
        login: path.resolve(rootDir, "./web/login.html"),
      },
    },
  },
});

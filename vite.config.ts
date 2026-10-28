import { execSync } from "node:child_process";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * This build's key: the git commit and the time, or `APP_BUILD` when the deploy sets one. It is baked into the
 * bundle (`__APP_BUILD__`) and written to `version.json`, which the open page compares itself against
 * (`src/lib/app-version.ts`). Any two builds differ, even from the same commit.
 */
function makeBuildKey(): string {
  if (process.env.APP_BUILD) return process.env.APP_BUILD;
  let sha = "local";
  try {
    sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || sha;
  } catch {
    /* not a git checkout: the time alone still tells builds apart */
  }
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${sha}-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

const buildKey = makeBuildKey();

/** Writes `version.json` into the build output, beside index.html. Serve it with no caching. */
function emitVersionFile(): Plugin {
  return {
    name: "emit-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ build: buildKey, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  // server: {
  //   host: "::",
  //   port: 4201,
  // },
  // Served under /assessment/. Code that builds a URL (payment return, share links, artwork) reads
  // `import.meta.env.BASE_URL` rather than hardcoding a prefix, so this is the one place it lives.
  // base: '/assessment/',
  plugins: [react(), emitVersionFile()],
  // `dev` outside a real build: nothing is offered an update while developing or testing.
  define: {
    __APP_BUILD__: JSON.stringify(command === "build" ? buildKey : "dev"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  // server: {
  //   host: "::",
  //   port: 4201,
  // },
  // Served from the site root. Code that builds a URL (payment return, share links, artwork) reads
  // `import.meta.env.BASE_URL` rather than hardcoding a prefix, so this is the one place it lives.
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

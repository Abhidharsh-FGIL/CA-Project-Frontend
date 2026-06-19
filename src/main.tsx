import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { BASE_URL } from "./lib/api";
import "./index.css";

// Module load fingerprint — re-evaluated each time this bundle is parsed.
// If the page still shows an old fingerprint after a hard refresh, the browser
// is serving stale JS (cache / service worker), not new source.
const BUILD_FINGERPRINT = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
console.log(
  `%c[BOOT] Bundle fingerprint: ${BUILD_FINGERPRINT}  |  BASE_URL: ${BASE_URL}`,
  "background:#dcfce7;color:#166534;font-weight:bold;padding:3px 8px;border-radius:4px;font:13px ui-monospace,Menlo,monospace",
);

// Forcefully kill any leftover service workers and caches from older builds.
// Service workers persist across page loads and can intercept fetch requests,
// causing the symptom of a "stale" BASE_URL even though the source is correct.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    if (regs.length > 0) {
      console.warn(`[BOOT] Unregistering ${regs.length} stale service worker(s)…`);
      regs.forEach(r => r.unregister());
    }
  });
}
if ("caches" in window) {
  caches.keys().then(keys => {
    if (keys.length > 0) {
      console.warn(`[BOOT] Clearing ${keys.length} stale cache(s):`, keys);
      keys.forEach(k => caches.delete(k));
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

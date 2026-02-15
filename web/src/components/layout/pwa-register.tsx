"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Service workers commonly cause stale assets/UI in local dev.
      // In production we enable PWA caching; in dev we proactively unregister and clear caches.
      if (process.env.NODE_ENV !== "production") {
        const marker = "houra_dev_sw_reset_v1";
        const shouldReload = typeof sessionStorage !== "undefined" && !sessionStorage.getItem(marker);
        if (shouldReload) {
          sessionStorage.setItem(marker, "1");
        }

        navigator.serviceWorker
          .getRegistrations()
          .then((registrations) => Promise.all(registrations.map((reg) => reg.unregister())))
          .catch(() => undefined);

        if ("caches" in window) {
          caches
            .keys()
            .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
            .catch(() => undefined);
        }

        if (shouldReload) {
          // Ensure the page re-fetches fresh CSS/JS after clearing cache.
          window.location.reload();
        }

        return;
      }

      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  return null;
}

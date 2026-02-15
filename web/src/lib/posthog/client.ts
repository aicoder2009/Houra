"use client";

import posthog from "posthog-js";

let started = false;

export function initPostHog() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key || !host || started) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    person_profiles: "always",
    capture_pageview: true,
  });

  started = true;
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!started) return;
  posthog.capture(event, properties);
}

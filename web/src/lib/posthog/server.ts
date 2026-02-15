import { PostHog } from "posthog-node";

let client: PostHog | null = null;

export function getPostHogServerClient() {
  if (client) return client;

  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!key || !host) {
    return null;
  }

  client = new PostHog(key, { host });
  return client;
}

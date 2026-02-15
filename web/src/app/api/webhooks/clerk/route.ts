import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { resolveStudentClaims } from "@/lib/clerk/claims";
import { upsertStudentFromWebhook } from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

function selectPrimaryEmail(data: Record<string, unknown>): string {
  const addresses = Array.isArray(data.email_addresses)
    ? (data.email_addresses as Array<Record<string, unknown>>)
    : [];
  const primaryId =
    typeof data.primary_email_address_id === "string" ? data.primary_email_address_id : null;

  if (primaryId) {
    const primary = addresses.find((item) => item.id === primaryId);
    if (primary && typeof primary.email_address === "string") {
      return primary.email_address;
    }
  }

  const fallback = addresses[0];
  if (fallback && typeof fallback.email_address === "string") {
    return fallback.email_address;
  }

  return "unknown@houra.local";
}

function readDisplayName(data: Record<string, unknown>): string {
  const fullName =
    typeof data.full_name === "string" && data.full_name.trim().length > 0
      ? data.full_name.trim()
      : null;
  if (fullName) {
    return fullName;
  }

  const first = typeof data.first_name === "string" ? data.first_name.trim() : "";
  const last = typeof data.last_name === "string" ? data.last_name.trim() : "";
  const combined = `${first} ${last}`.trim();
  return combined.length > 0 ? combined : "Student";
}

export async function POST(request: NextRequest) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>;

  try {
    event = await verifyWebhook(request);
  } catch {
    return jsonError("Invalid Clerk webhook signature", 401);
  }

  if (event.type !== "user.created" && event.type !== "user.updated") {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const data = event.data as unknown as Record<string, unknown>;
  if (typeof data.id !== "string") {
    return jsonError("Invalid Clerk webhook payload", 400);
  }

  const metadata =
    data.public_metadata && typeof data.public_metadata === "object"
      ? (data.public_metadata as Record<string, unknown>)
      : {};
  const claims = resolveStudentClaims(metadata);

  await upsertStudentFromWebhook({
    clerkUserId: data.id,
    name: readDisplayName(data),
    email: selectPrimaryEmail(data),
    role: claims.role,
    isApproved: claims.isApproved,
  });

  return NextResponse.json({ ok: true });
}

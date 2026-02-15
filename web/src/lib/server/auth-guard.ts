import { auth } from "@clerk/nextjs/server";
import type { NextResponse } from "next/server";
import { resolveStudentClaims } from "@/lib/clerk/claims";
import type { AuthContext } from "@/lib/schemas/types";
import { jsonError } from "@/lib/server/http";

type GuardOptions = {
  requireApproval?: boolean;
};

function readClaimString(
  claims: Record<string, unknown> | null | undefined,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = claims?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session.userId) {
    return null;
  }

  const claims = (session.sessionClaims ?? {}) as Record<string, unknown>;
  const publicMetadata = (claims.publicMetadata ?? {}) as Record<string, unknown>;
  const { role, isApproved } = resolveStudentClaims(publicMetadata);

  return {
    clerkUserId: session.userId,
    sessionId: session.sessionId ?? null,
    role,
    isApproved,
    email: readClaimString(claims, ["email", "email_address"]),
    name: readClaimString(claims, ["name", "full_name", "first_name"]),
  };
}

export async function requireStudentAuth(
  options: GuardOptions = {},
): Promise<
  | { ok: true; auth: AuthContext }
  | { ok: false; response: NextResponse<{ error: string }> }
> {
  const session = await getAuthContext();
  if (!session) {
    return {
      ok: false,
      response: jsonError("Unauthorized", 401),
    };
  }

  if (session.role !== "student") {
    return {
      ok: false,
      response: jsonError("Forbidden: student role required", 403),
    };
  }

  const requireApproval = options.requireApproval ?? true;
  if (requireApproval && !session.isApproved) {
    return {
      ok: false,
      response: jsonError("Forbidden: account approval pending", 403),
    };
  }

  return {
    ok: true,
    auth: session,
  };
}

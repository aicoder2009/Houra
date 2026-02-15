import { NextResponse } from "next/server";
import { getBootstrap } from "@/lib/server/houra-repo";
import { requireStudentAuth } from "@/lib/server/auth-guard";

export async function GET() {
  const guard = await requireStudentAuth();
  if (!guard.ok) {
    return guard.response;
  }

  const payload = await getBootstrap(guard.auth);
  return NextResponse.json(payload);
}

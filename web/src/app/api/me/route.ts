import { NextResponse } from "next/server";
import { getAuthContext } from "@/lib/server/auth-guard";
import { upsertStudentFromAuth } from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

export async function GET() {
  const auth = await getAuthContext();
  if (!auth) {
    return jsonError("Unauthorized", 401);
  }

  const student = await upsertStudentFromAuth(auth);

  return NextResponse.json({
    auth,
    student,
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { fileStorageService } from "@/lib/storage/file-storage-service";
import { jsonError } from "@/lib/server/http";

const schema = z.object({
  storageKey: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await clerkAuthService.getCurrentUser();
  if (!session) return jsonError("Unauthorized", 401);
  if (!session.isApproved || session.role !== "student") return jsonError("Forbidden", 403);

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);

  const result = await fileStorageService.presignDownload(parsed.data);
  return NextResponse.json(result);
}

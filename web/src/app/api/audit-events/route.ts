import { NextResponse } from "next/server";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { filterAudit } from "@/lib/server/runtime-db";
import { csvEscape, jsonError } from "@/lib/server/http";

export async function GET(request: Request) {
  const session = await clerkAuthService.getCurrentUser();
  if (!session) return jsonError("Unauthorized", 401);
  if (!session.isApproved || session.role !== "student") return jsonError("Forbidden", 403);

  const { searchParams } = new URL(request.url);

  const actorType = searchParams.get("actorType") ?? undefined;
  const entityType = searchParams.get("entityType") ?? undefined;
  const actionType = searchParams.get("actionType") ?? undefined;
  const format = searchParams.get("format") ?? "json";

  const events = filterAudit({ actorType, entityType, actionType });

  if (format === "csv") {
    const headers = [
      "timestamp",
      "actorType",
      "actorId",
      "source",
      "entityType",
      "entityId",
      "actionType",
      "correlationId",
      "snapshotId",
      "diffJson",
    ];

    const lines = events.map((event) =>
      [
        event.timestamp,
        event.actorType,
        event.actorId ?? "",
        event.source,
        event.entityType,
        event.entityId,
        event.actionType,
        event.correlationId,
        event.snapshotId ?? "",
        event.diffJson ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );

    const csv = [headers.join(","), ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  }

  return NextResponse.json(events);
}

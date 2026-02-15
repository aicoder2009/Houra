import { NextResponse } from "next/server";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import { csvEscape } from "@/lib/server/http";
import { listAuditEvents, upsertStudentFromAuth } from "@/lib/server/houra-repo";

export async function GET(request: Request) {
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);

  const actorType = searchParams.get("actorType") ?? undefined;
  const entityType = searchParams.get("entityType") ?? undefined;
  const actionType = searchParams.get("actionType") ?? undefined;
  const format = searchParams.get("format") ?? "json";

  const student = await upsertStudentFromAuth(guard.auth);
  const events = await listAuditEvents({
    studentId: student.id,
    actorType,
    entityType,
    actionType,
  });

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

import { NextResponse } from "next/server";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { csvEscape, jsonError } from "@/lib/server/http";
import { buildAuditEvent } from "@/lib/server/audit";
import { pushAudit, readState } from "@/lib/server/runtime-db";

const schema = z.object({
  format: z.enum(["csv", "pdf"]),
  rangeStart: z.string().datetime(),
  rangeEnd: z.string().datetime(),
  presetId: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await clerkAuthService.getCurrentUser();
  if (!session) return jsonError("Unauthorized", 401);
  if (!session.isApproved || session.role !== "student") return jsonError("Forbidden", 403);

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Invalid payload", 400);

  const state = readState();

  const start = new Date(parsed.data.rangeStart).getTime();
  const end = new Date(parsed.data.rangeEnd).getTime();
  const rows = state.entries.filter((entry) => {
    const value = new Date(entry.startAt).getTime();
    return value >= start && value <= end;
  });

  if (parsed.data.format === "csv") {
    const header = ["Date", "Organization", "Activity", "Hours", "Status", "Notes"];
    const lines = rows.map((entry) => {
      const org = state.organizations.find((item) => item.id === entry.organizationId)?.name ?? "Unknown";
      return [
        new Date(entry.startAt).toLocaleDateString(),
        org,
        entry.activityName,
        (entry.durationMinutes / 60).toFixed(2),
        entry.status,
        entry.description ?? "",
      ]
        .map(csvEscape)
        .join(",");
    });

    const csv = [header.join(","), ...lines].join("\n");
    const fileUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;

    pushAudit(
      buildAuditEvent({
        actorType: "student",
        actorId: session.clerkUserId,
        source: "ui",
        entityType: "reportPreset",
        entityId: parsed.data.presetId ?? "ad-hoc",
        actionType: "export",
        diffJson: JSON.stringify({ format: "csv", rowCount: rows.length }),
      }),
    );

    return NextResponse.json({ format: "csv", fileUrl, rowCount: rows.length });
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawText("Houra Service Hours Export", {
    x: 48,
    y: 744,
    size: 18,
    font,
    color: rgb(0.07, 0.11, 0.22),
  });

  page.drawText(`Range: ${new Date(parsed.data.rangeStart).toLocaleDateString()} - ${new Date(parsed.data.rangeEnd).toLocaleDateString()}`, {
    x: 48,
    y: 718,
    size: 10,
    font,
    color: rgb(0.28, 0.33, 0.41),
  });

  let y = 690;
  rows.slice(0, 24).forEach((entry) => {
    const org = state.organizations.find((item) => item.id === entry.organizationId)?.name ?? "Unknown";
    const line = `${new Date(entry.startAt).toLocaleDateString()} | ${org} | ${entry.activityName} | ${(entry.durationMinutes / 60).toFixed(2)}h | ${entry.status}`;
    page.drawText(line.slice(0, 102), { x: 48, y, size: 10, font, color: rgb(0.08, 0.12, 0.18) });
    y -= 22;
  });

  const bytes = await pdf.save();
  const base64 = Buffer.from(bytes).toString("base64");
  const fileUrl = `data:application/pdf;base64,${base64}`;

  pushAudit(
    buildAuditEvent({
      actorType: "student",
      actorId: session.clerkUserId,
      source: "ui",
      entityType: "reportPreset",
      entityId: parsed.data.presetId ?? "ad-hoc",
      actionType: "export",
      diffJson: JSON.stringify({ format: "pdf", rowCount: rows.length }),
    }),
  );

  return NextResponse.json({ format: "pdf", fileUrl, rowCount: rows.length });
}

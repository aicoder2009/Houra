import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { clerkAuthService } from "@/lib/clerk/auth-service";
import { nowIso } from "@/lib/schemas/seed";
import type { ImportJob, ServiceEntry } from "@/lib/schemas/types";
import { buildAuditEvent } from "@/lib/server/audit";
import { jsonError } from "@/lib/server/http";
import { mutateState, pushAudit, readState } from "@/lib/server/runtime-db";

const activityKeys = ["Activity Name", "Activity", "Title", "Task"];
const dateKeys = ["Start Date", "Date", "Service Date"];
const hoursKeys = ["Hours", "Duration", "Total Hours"];
const notesKeys = ["Notes", "Description", "Details"];
const orgKeys = ["Organization", "Org", "Club", "Affiliation"];

function readField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return undefined;
}

function toIsoDate(raw: unknown) {
  const text = String(raw ?? "").trim();
  if (!text) return null;

  const asNumber = Number(text);
  if (!Number.isNaN(asNumber) && asNumber > 20000 && asNumber < 70000) {
    const parsed = XLSX.SSF.parse_date_code(asNumber);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString();
  }

  const parsedDate = new Date(text);
  if (Number.isNaN(parsedDate.getTime())) return null;
  return parsedDate.toISOString();
}

export async function POST(request: Request) {
  const session = await clerkAuthService.getCurrentUser();
  if (!session) return jsonError("Unauthorized", 401);
  if (!session.isApproved || session.role !== "student") return jsonError("Forbidden", 403);

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Expected a file upload", 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
    return jsonError("Only CSV/XLSX import is supported", 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];

  if (!firstSheet) return jsonError("No rows found in file", 400);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  });

  const state = readState();
  if (!state.student) return jsonError("Student profile unavailable", 409);

  const job: ImportJob = {
    id: crypto.randomUUID(),
    studentId: state.student.id,
    sourceType: ext === "csv" ? "csv" : "xlsx",
    status: "processing",
    confidenceJson: JSON.stringify({ totalRows: rows.length }),
    createdAt: nowIso(),
  };

  const imported: ServiceEntry[] = [];
  let skipped = 0;

  mutateState((db) => {
    for (const row of rows) {
      const activityName = String(readField(row, activityKeys) ?? "").trim();
      const rawDate = readField(row, dateKeys);
      const rawHours = readField(row, hoursKeys);
      const orgName = String(readField(row, orgKeys) ?? "General Service").trim();

      const isoDate = toIsoDate(rawDate);
      const durationHours = Number(rawHours);

      if (!activityName || !isoDate || Number.isNaN(durationHours) || durationHours <= 0) {
        skipped += 1;
        continue;
      }

      let org = db.organizations.find(
        (item) => item.studentId === db.student?.id && item.name.toLowerCase() === orgName.toLowerCase(),
      );

      if (!org && db.student) {
        org = {
          id: crypto.randomUUID(),
          studentId: db.student.id,
          name: orgName,
          evidenceRequired: false,
          archivedAt: null,
        };
        db.organizations.unshift(org);
      }

      if (!db.student || !org) {
        skipped += 1;
        continue;
      }

      const entry: ServiceEntry = {
        id: crypto.randomUUID(),
        studentId: db.student.id,
        organizationId: org.id,
        activityName,
        description: String(readField(row, notesKeys) ?? "").trim() || undefined,
        startAt: isoDate,
        endAt: isoDate,
        durationMinutes: Math.max(1, Math.round(durationHours * 60)),
        status: "Pending Review",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };

      db.entries.unshift(entry);
      imported.push(entry);
    }

    job.status = "completed";
    job.confidenceJson = JSON.stringify({
      totalRows: rows.length,
      imported: imported.length,
      skipped,
    });

    db.importJobs.unshift(job);
  });

  pushAudit(
    buildAuditEvent({
      actorType: "student",
      actorId: session.clerkUserId,
      source: "ui",
      entityType: "importJob",
      entityId: job.id,
      actionType: "create",
      afterJson: JSON.stringify(job),
      diffJson: JSON.stringify({ imported: imported.length, skipped }),
      correlationId: job.id,
    }),
  );

  return NextResponse.json({ job, imported, skipped });
}

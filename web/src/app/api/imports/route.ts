import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { nowIso } from "@/lib/schemas/seed";
import type { ServiceEntry } from "@/lib/schemas/types";
import { buildAuditEvent } from "@/lib/server/audit";
import { requireStudentAuth } from "@/lib/server/auth-guard";
import {
  recordAuditEvent,
  upsertOrganizationByName,
  upsertStudentFromAuth,
  writeImportResult,
} from "@/lib/server/houra-repo";
import { jsonError } from "@/lib/server/http";

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
  const guard = await requireStudentAuth();
  if (!guard.ok) return guard.response;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return jsonError("Expected a file upload", 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
    return jsonError("Only CSV/XLSX import is supported", 400);
  }

  const student = await upsertStudentFromAuth(guard.auth);

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];

  if (!firstSheet) return jsonError("No rows found in file", 400);

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, {
    defval: "",
  });

  const imported: ServiceEntry[] = [];
  let skipped = 0;
  const orgCache = new Map<string, string>();

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

    const orgKey = orgName.toLowerCase();
    let organizationId = orgCache.get(orgKey);
    if (!organizationId) {
      const org = await upsertOrganizationByName({ studentId: student.id, orgName });
      organizationId = org.id;
      orgCache.set(orgKey, organizationId);
    }

    imported.push({
      id: crypto.randomUUID(),
      studentId: student.id,
      organizationId,
      activityName,
      description: String(readField(row, notesKeys) ?? "").trim() || undefined,
      startAt: isoDate,
      endAt: isoDate,
      durationMinutes: Math.max(1, Math.round(durationHours * 60)),
      status: "Pending Review",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  const confidenceJson = JSON.stringify({
    totalRows: rows.length,
    imported: imported.length,
    skipped,
  });

  const job = await writeImportResult({
    studentId: student.id,
    sourceType: ext === "csv" ? "csv" : "xlsx",
    confidenceJson,
    entries: imported,
  });

  await recordAuditEvent(
    buildAuditEvent({
      actorType: "student",
      actorId: guard.auth.clerkUserId,
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

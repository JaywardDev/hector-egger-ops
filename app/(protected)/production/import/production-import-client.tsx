"use client";

import { useMemo, useState, useTransition } from "react";
import {
  importDailyRegistryAction,
  importProjectRegistryAction,
} from "@/app/(protected)/production/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";

type ProjectRow = {
  rowNumber: number;
  projectFile: string;
  projectName: string;
  projectSequence: string;
  totalTime: string;
  totalVolume: string;
};

type DailyRow = {
  rowNumber: number;
  date: string;
  operator: string;
  startTime: string;
  finishTime: string;
  projectFile: string;
  projectSequence: string;
  projectName: string;
  timeRemainingStart: string;
  timeRemainingEnd: string;
  actualVolumeCutM3: string;
  downtimeHours: string;
  downtimeReason: string;
  interruptionHours: string;
  interruptionReason: string;
};

type ImportResult = {
  totalRowsParsed: number;
  imported: number;
  updated?: number;
  failed: number;
  warnings: number;
  rowResults: Array<{ rowNumber: number; status: string; message: string; warnings?: string[] }>;
};

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((cell) => cell.trim().length > 0));
};

const toLookup = (header: string[]) =>
  new Map(header.map((column, index) => [column.trim().toLowerCase(), index]));

const readCell = (row: string[], lookup: Map<string, number>, label: string) => {
  const index = lookup.get(label.toLowerCase());
  return typeof index === "number" ? row[index] ?? "" : "";
};

export function ProductionImportClient() {
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [projectParseError, setProjectParseError] = useState<string | null>(null);
  const [dailyParseError, setDailyParseError] = useState<string | null>(null);
  const [projectResult, setProjectResult] = useState<ImportResult | null>(null);
  const [dailyResult, setDailyResult] = useState<ImportResult | null>(null);
  const [isPendingProjects, startProjectImport] = useTransition();
  const [isPendingDaily, startDailyImport] = useTransition();

  const canRunDaily = useMemo(() => {
    if (projectResult && projectResult.failed > 0) {
      return false;
    }
    return projectRows.length > 0;
  }, [projectResult, projectRows.length]);

  const handleProjectUpload = async (file: File | null) => {
    setProjectParseError(null);
    setProjectResult(null);
    if (!file) {
      setProjectRows([]);
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setProjectParseError("Project Registry CSV has no data rows.");
      setProjectRows([]);
      return;
    }

    const [header, ...dataRows] = parsed;
    const lookup = toLookup(header);

    const requiredHeaders = ["project file", "project name", "project sequence"];
    const missing = requiredHeaders.filter((name) => !lookup.has(name));
    if (missing.length > 0) {
      setProjectParseError(`Missing Project Registry headers: ${missing.join(", ")}`);
      setProjectRows([]);
      return;
    }

    setProjectRows(
      dataRows.map((row, index) => ({
        rowNumber: index + 2,
        projectFile: readCell(row, lookup, "project file"),
        projectName: readCell(row, lookup, "project name"),
        projectSequence: readCell(row, lookup, "project sequence"),
        totalTime: readCell(row, lookup, "total time"),
        totalVolume: readCell(row, lookup, "total volume"),
      })),
    );
  };

  const handleDailyUpload = async (file: File | null) => {
    setDailyParseError(null);
    setDailyResult(null);
    if (!file) {
      setDailyRows([]);
      return;
    }

    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setDailyParseError("Daily Registry CSV has no data rows.");
      setDailyRows([]);
      return;
    }

    const [header, ...dataRows] = parsed;
    const lookup = toLookup(header);
    const requiredHeaders = [
      "date",
      "operator",
      "start time",
      "finish time",
      "project file",
      "project sequence",
      "time remaining (start)",
      "time remaining (end)",
    ];
    const missing = requiredHeaders.filter((name) => !lookup.has(name));
    if (missing.length > 0) {
      setDailyParseError(`Missing Daily Registry headers: ${missing.join(", ")}`);
      setDailyRows([]);
      return;
    }

    setDailyRows(
      dataRows.map((row, index) => ({
        rowNumber: index + 2,
        date: readCell(row, lookup, "date"),
        operator: readCell(row, lookup, "operator"),
        startTime: readCell(row, lookup, "start time"),
        finishTime: readCell(row, lookup, "finish time"),
        projectFile: readCell(row, lookup, "project file"),
        projectSequence: readCell(row, lookup, "project sequence"),
        projectName: readCell(row, lookup, "project name"),
        timeRemainingStart: readCell(row, lookup, "time remaining (start)"),
        timeRemainingEnd: readCell(row, lookup, "time remaining (end)"),
        actualVolumeCutM3: readCell(row, lookup, "actual volume cut (m³)") ||
          readCell(row, lookup, "actual volume cut (m3)"),
        downtimeHours: readCell(row, lookup, "downtime (hrs)"),
        downtimeReason: readCell(row, lookup, "downtime reason"),
        interruptionHours: readCell(row, lookup, "interruption (hrs)"),
        interruptionReason: readCell(row, lookup, "interruption reason"),
      })),
    );
  };

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-lg font-semibold text-zinc-900">Stage A: Project Registry import</h2>
        <p className="mt-1 text-sm text-zinc-600">Upload and import canonical production projects first.</p>
        <div className="mt-3">
          <Input type="file" accept=".csv,text/csv" onChange={(event) => void handleProjectUpload(event.target.files?.[0] ?? null)} />
        </div>
        {projectParseError ? <Alert className="mt-3" variant="error">{projectParseError}</Alert> : null}
        {projectRows.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">Parsed {projectRows.length} project rows.</p>
            <div className="max-h-64 overflow-auto rounded border border-zinc-200">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-2 py-1">Row</th><th className="px-2 py-1">Project File</th><th className="px-2 py-1">Project Name</th><th className="px-2 py-1">Sequence</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.slice(0, 40).map((row) => (
                    <tr key={row.rowNumber} className="border-t border-zinc-100">
                      <td className="px-2 py-1">{row.rowNumber}</td><td className="px-2 py-1">{row.projectFile}</td><td className="px-2 py-1">{row.projectName}</td><td className="px-2 py-1">{row.projectSequence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button disabled={isPendingProjects} onClick={() => startProjectImport(async () => setProjectResult(await importProjectRegistryAction(projectRows)))}>
              {isPendingProjects ? "Importing..." : "Import Project Registry"}
            </Button>
          </div>
        ) : null}
        {projectResult ? (
          <Alert className="mt-3">
            Parsed {projectResult.totalRowsParsed} · Imported {projectResult.imported} · Updated {projectResult.updated ?? 0} · Failed {projectResult.failed}
          </Alert>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-zinc-900">Stage B: Daily Registry import</h2>
        <p className="mt-1 text-sm text-zinc-600">Only run after Stage A succeeds. Daily rows link to canonical projects by file + sequence.</p>
        {!canRunDaily ? <Alert className="mt-3" variant="warning">Run Stage A successfully before importing Daily Registry.</Alert> : null}
        <div className="mt-3">
          <Input type="file" accept=".csv,text/csv" onChange={(event) => void handleDailyUpload(event.target.files?.[0] ?? null)} disabled={!canRunDaily} />
        </div>
        {dailyParseError ? <Alert className="mt-3" variant="error">{dailyParseError}</Alert> : null}
        {dailyRows.length > 0 ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm">Parsed {dailyRows.length} daily rows.</p>
            <div className="max-h-64 overflow-auto rounded border border-zinc-200">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-50 text-left">
                  <tr>
                    <th className="px-2 py-1">Row</th><th className="px-2 py-1">Date</th><th className="px-2 py-1">Operator</th><th className="px-2 py-1">Project</th><th className="px-2 py-1">Sequence</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.slice(0, 40).map((row) => (
                    <tr key={row.rowNumber} className="border-t border-zinc-100">
                      <td className="px-2 py-1">{row.rowNumber}</td><td className="px-2 py-1">{row.date}</td><td className="px-2 py-1">{row.operator}</td><td className="px-2 py-1">{row.projectFile}</td><td className="px-2 py-1">{row.projectSequence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button disabled={isPendingDaily || !canRunDaily} onClick={() => startDailyImport(async () => setDailyResult(await importDailyRegistryAction(dailyRows)))}>
              {isPendingDaily ? "Importing..." : "Import Daily Registry"}
            </Button>
          </div>
        ) : null}
        {dailyResult ? (
          <div className="mt-3 space-y-2">
            <Alert>
              Parsed {dailyResult.totalRowsParsed} · Imported {dailyResult.imported} · Failed {dailyResult.failed} · Warnings {dailyResult.warnings}
            </Alert>
            <div className="max-h-64 overflow-auto rounded border border-zinc-200 text-sm">
              <table className="min-w-full">
                <thead className="bg-zinc-50 text-left">
                  <tr><th className="px-2 py-1">Row</th><th className="px-2 py-1">Status</th><th className="px-2 py-1">Message</th></tr>
                </thead>
                <tbody>
                  {dailyResult.rowResults.map((row) => (
                    <tr key={`${row.rowNumber}-${row.message}`} className="border-t border-zinc-100 align-top">
                      <td className="px-2 py-1">{row.rowNumber}</td>
                      <td className="px-2 py-1">{row.status}</td>
                      <td className="px-2 py-1">{row.message}{row.warnings?.length ? ` | warnings: ${row.warnings.join("; ")}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

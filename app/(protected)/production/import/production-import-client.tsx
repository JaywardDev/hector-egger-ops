"use client";

import { useMemo, useState, useTransition } from "react";
import {
  applyProductionImportAction,
  prepareProductionImportAction,
} from "@/app/(protected)/production/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";

type ProductionImportClientProps = {
  actorProfileId: string;
};

type Issue = {
  rowNumber: number | null;
  field: string | null;
  code: string;
  message: string;
};

type PreparedResult = Awaited<ReturnType<typeof prepareProductionImportAction>>;
type AppliedResult = Awaited<ReturnType<typeof applyProductionImportAction>>;

export function ProductionImportClient({ actorProfileId }: ProductionImportClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [prepareResult, setPrepareResult] = useState<PreparedResult | null>(null);
  const [applyResult, setApplyResult] = useState<AppliedResult | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [isPreparing, startPrepareTransition] = useTransition();
  const [isApplying, startApplyTransition] = useTransition();

  const blockingErrors = prepareResult?.validationErrors ?? [];
  const warnings = (prepareResult?.warnings ?? []).map((message, index) => ({
    rowNumber: null,
    field: null,
    code: `warning_${index + 1}`,
    message,
  }));

  const canApply = useMemo(
    () => Boolean(file && prepareResult && blockingErrors.length === 0 && !isPreparing && !isApplying),
    [file, prepareResult, blockingErrors.length, isPreparing, isApplying],
  );

  const onFileSelected = (selectedFile: File | null) => {
    setFile(selectedFile);
    setPrepareResult(null);
    setApplyResult(null);
    setPrepareError(null);
    setApplyError(null);
  };

  const runPrepare = () => {
    if (!file) return;
    startPrepareTransition(async () => {
      setPrepareError(null);
      setApplyResult(null);
      setApplyError(null);
      try {
        const prepared = await prepareProductionImportAction(file);
        setPrepareResult(prepared);
      } catch (error) {
        setPrepareResult(null);
        setPrepareError(error instanceof Error ? error.message : "Validate / Dry Run failed.");
      }
    });
  };

  const runApply = () => {
    if (!file || !canApply) return;
    startApplyTransition(async () => {
      setApplyError(null);
      try {
        const applied = await applyProductionImportAction({ file, actorProfileId });
        setApplyResult(applied);
      } catch (error) {
        setApplyResult(null);
        setApplyError(error instanceof Error ? error.message : "Apply import failed.");
      }
    });
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold text-zinc-900">Legacy Production Import</h2>
      <p className="mt-1 text-sm text-zinc-600">
        Use this only for cleaned legacy production data. New daily production records should be entered through the app.
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        This path is intended for one-time historical import. Final XLSX support/layout is deferred.
      </p>
      <p className="mt-1 text-sm text-zinc-600">
        CSV notes/reasons that contain commas must be quoted correctly.
      </p>

      <div className="mt-4 space-y-2">
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => onFileSelected(event.target.files?.[0] ?? null)}
        />
        <p className="text-sm text-zinc-600">Selected file: {file?.name ?? "None"}</p>
        <Button disabled={!file || isPreparing || isApplying} onClick={runPrepare}>
          {isPreparing ? "Validating..." : "Validate / Dry Run"}
        </Button>
      </div>

      {prepareError ? (
        <Alert className="mt-3" variant="error">{prepareError}</Alert>
      ) : null}

      {prepareResult ? (
        <div className="mt-4 space-y-3">
          <Alert>
            Total rows {prepareResult.summary.rowCount} · Valid rows {Math.max(prepareResult.summary.rowCount - blockingErrors.length, 0)} · Errors {prepareResult.summary.errorCount} · Warnings {prepareResult.summary.warningCount}
          </Alert>
          <p className="text-sm text-zinc-700">
            Duplicate count: {blockingErrors.filter((error) => error.code === "duplicate_source_row").length}
          </p>
          <p className="text-sm text-zinc-700">
            Estimated apply outcome: inserted/updated/skipped available after apply RPC result.
          </p>

          <h3 className="text-sm font-semibold text-zinc-900">Blocking validation errors</h3>
          {blockingErrors.length === 0 ? (
            <Alert>No blocking validation errors.</Alert>
          ) : (
            <IssueTable issues={blockingErrors} />
          )}

          <h3 className="text-sm font-semibold text-zinc-900">Warnings</h3>
          {warnings.length === 0 ? (
            <Alert>No warnings.</Alert>
          ) : (
            <IssueTable issues={warnings} />
          )}

          <Button onClick={runApply} disabled={!canApply}>
            {isApplying ? "Applying..." : "Apply import"}
          </Button>
          {blockingErrors.length > 0 ? (
            <p className="text-xs text-red-700">Apply is disabled while blocking validation errors exist.</p>
          ) : null}
        </div>
      ) : null}

      {applyError ? <Alert className="mt-3" variant="error">{applyError}</Alert> : null}
      {applyResult ? (
        <Alert className="mt-3">
          Import applied successfully. Batch {applyResult.importBatchId}.
        </Alert>
      ) : null}
    </Card>
  );
}

function IssueTable({ issues }: { issues: Issue[] }) {
  return (
    <div className="max-h-72 overflow-auto rounded border border-zinc-200 text-sm">
      <table className="min-w-full">
        <thead className="bg-zinc-50 text-left">
          <tr>
            <th className="px-2 py-1">Row</th>
            <th className="px-2 py-1">Field</th>
            <th className="px-2 py-1">Code</th>
            <th className="px-2 py-1">Message</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue, index) => (
            <tr key={`${issue.code}-${issue.rowNumber ?? "global"}-${index}`} className="border-t border-zinc-100 align-top">
              <td className="px-2 py-1">{issue.rowNumber ?? "-"}</td>
              <td className="px-2 py-1">{issue.field ?? "-"}</td>
              <td className="px-2 py-1">{issue.code}</td>
              <td className="px-2 py-1">{issue.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useActionState } from "react";
import { importCBaseTimesheetLookupsAction, initialCBaseImportState } from "@/app/(protected)/admin/timesheet-lookups/import/actions";
import { Alert } from "@/src/components/ui/alert";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

const summaryItems = [
  ["Inserted", "insertedCount"],
  ["Updated", "updatedCount"],
  ["Unchanged", "unchangedCount"],
  ["Reactivated", "reactivatedCount"],
  ["Deactivated by hidden flag", "deactivatedByHiddenFlagCount"],
  ["Deactivated by missing export row", "deactivatedByMissingCount"],
  ["Invalid rows", "invalidRowsCount"],
] as const;

export function CBaseTimesheetImportClient() {
  const [state, formAction, isPending] = useActionState(importCBaseTimesheetLookupsAction, initialCBaseImportState);

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-lg font-semibold text-zinc-900">Upload latest C Base snapshots</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Both files are treated as one full snapshot. Validation and diffing run before any sync is applied.
        </p>

        <form action={formAction} className="mt-4 grid gap-4">
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="buildingsFile">BuildingsExport .xlsx</Label>
              <Input id="buildingsFile" name="buildingsFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
              <p className="text-xs text-zinc-500">Worksheet: qry_TIMESHEET_BuildingsExport</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="costcodesFile">CostcodesExport .xlsx</Label>
              <Input id="costcodesFile" name="costcodesFile" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required />
              <p className="text-xs text-zinc-500">Worksheet: qry_TIMESHEET_CostcodesExport</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="mode" value="dry-run" variant="secondary" disabled={isPending}>
              {isPending ? "Checking…" : "Validate / dry run"}
            </Button>
            <Button type="submit" name="mode" value="apply" variant="primary" disabled={isPending}>
              {isPending ? "Syncing…" : "Validate and apply sync"}
            </Button>
          </div>
        </form>
      </Card>

      {state.message ? (
        <Alert variant={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      {state.summary ? (
        <Card>
          <h2 className="text-lg font-semibold text-zinc-900">{state.mode === "apply" ? "Applied summary" : "Dry-run summary"}</h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summaryItems.map(([label, key]) => (
              <div key={key} className="rounded border border-zinc-200 p-2">
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
                <dd className="text-2xl font-semibold text-zinc-950">{state.summary?.[key] ?? 0}</dd>
              </div>
            ))}
          </dl>

          {state.summary.duplicateProjectCodes.length > 0 || state.summary.duplicateCostCodes.length > 0 ? (
            <div className="mt-4 grid gap-2 text-sm text-red-700">
              {state.summary.duplicateProjectCodes.length > 0 ? <p>Duplicate project codes: {state.summary.duplicateProjectCodes.join(", ")}</p> : null}
              {state.summary.duplicateCostCodes.length > 0 ? <p>Duplicate cost codes: {state.summary.duplicateCostCodes.join(", ")}</p> : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      {state.errors.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-zinc-900">Validation errors</h2>
          <div className="mt-3 max-h-96 overflow-auto rounded border border-red-100">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-red-50 text-red-900">
                <tr>
                  <th className="px-2 py-1">File</th>
                  <th className="px-2 py-1">Row</th>
                  <th className="px-2 py-1">Field</th>
                  <th className="px-2 py-1">Code</th>
                  <th className="px-2 py-1">Message</th>
                </tr>
              </thead>
              <tbody>
                {state.errors.map((error, index) => (
                  <tr key={`${error.file}-${error.rowNumber ?? "file"}-${error.field ?? "general"}-${index}`} className="border-t border-red-100">
                    <td className="px-2 py-1">{error.file}</td>
                    <td className="px-2 py-1">{error.rowNumber ?? "—"}</td>
                    <td className="px-2 py-1">{error.field ?? "—"}</td>
                    <td className="px-2 py-1">{error.code ?? "—"}</td>
                    <td className="px-2 py-1">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

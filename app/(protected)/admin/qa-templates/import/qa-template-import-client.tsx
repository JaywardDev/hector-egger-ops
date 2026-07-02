"use client";

import { useActionState, useState } from "react";
import {
  importQaTemplatesAction,
  type QaTemplateFileResult,
  type QaTemplateImportState,
} from "@/app/(protected)/admin/qa-templates/import/actions";
import { Alert } from "@/src/components/ui/alert";
import { Badge, type BadgeVariant } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";

const ACTION_BADGE: Record<QaTemplateFileResult["action"], { variant: BadgeVariant; label: string }> = {
  inserted: { variant: "success", label: "New version" },
  unchanged: { variant: "muted", label: "Unchanged" },
  version_conflict: { variant: "danger", label: "Version conflict" },
  replaced: { variant: "attention", label: "Replaced" },
  invalid: { variant: "danger", label: "Invalid" },
};

const initialQaTemplateImportState: QaTemplateImportState = {
  status: "idle",
  mode: null,
  message: null,
  results: [],
};

export function QaTemplateImportClient() {
  const [state, formAction, isPending] = useActionState(importQaTemplatesAction, initialQaTemplateImportState);
  const [hasFiles, setHasFiles] = useState(false);
  const canSubmit = hasFiles && !isPending;

  return (
    <div className="grid gap-4">
      <Card>
        <h2 className="text-lg font-semibold text-zinc-900">Upload checklist templates</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Each .xlsx is one C-base checklist template (a &ldquo;Master List Templates&rdquo; sheet). Select one or more.
          Validation runs before anything is written, and an unchanged template is a no-op.
        </p>

        <form action={formAction} className="mt-4 grid gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="files">Checklist template .xlsx files</Label>
            <Input
              id="files"
              name="files"
              type="file"
              multiple
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              required
              onChange={(event) => setHasFiles((event.currentTarget.files?.length ?? 0) > 0)}
            />
            <p className="text-xs text-zinc-500">Worksheet: Master List Templates</p>
          </div>

          <label className="flex items-start gap-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
            <input
              type="checkbox"
              name="replace"
              className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[var(--he-charcoal)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
            />
            <span>
              <span className="font-medium text-zinc-900">Replace on version conflict</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                Overwrites a stored version in place when the file differs but keeps the same version number. Use this to
                heal templates after a parser update. In-progress and signed-off checklists are not affected — they keep
                the definition they were started with.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" name="mode" value="dry-run" variant="secondary" disabled={!canSubmit}>
              {isPending ? "Checking…" : "Validate / dry run"}
            </Button>
            <Button type="submit" name="mode" value="apply" variant="primary" disabled={!canSubmit}>
              {isPending ? "Importing…" : "Validate and import"}
            </Button>
          </div>
        </form>
      </Card>

      {state.message ? (
        <Alert variant={state.status === "error" ? "error" : "success"}>{state.message}</Alert>
      ) : null}

      {state.results.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold text-zinc-900">{state.mode === "apply" ? "Import result" : "Dry-run result"}</h2>
          <div className="mt-3 grid gap-2">
            {state.results.map((result) => (
              <div key={result.filename} className="rounded-md border border-zinc-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-zinc-900">{result.templateName ?? result.filename}</p>
                    <p className="truncate text-xs text-zinc-500">
                      {result.filename}
                      {result.version !== null ? ` · v${result.version}` : ""}
                    </p>
                  </div>
                  <Badge variant={ACTION_BADGE[result.action].variant}>{ACTION_BADGE[result.action].label}</Badge>
                </div>

                {result.action === "version_conflict" ? (
                  <p className="mt-2 text-xs text-red-700">
                    A different definition already exists at this version. The stored version was kept. Either bump the
                    version in C-base and re-export, or tick &ldquo;Replace on version conflict&rdquo; above to overwrite
                    it in place.
                  </p>
                ) : null}

                {result.action === "replaced" ? (
                  <p className="mt-2 text-xs text-amber-700">
                    {state.mode === "apply"
                      ? "This version's definition was overwritten in place. Existing checklists keep their own snapshot."
                      : "This version will be overwritten in place on import (existing checklists keep their snapshot)."}
                  </p>
                ) : null}

                {result.errors.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-red-700">
                    {result.errors.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                ) : null}

                {result.warnings.length > 0 ? (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-amber-700">
                    {result.warnings.map((message, index) => (
                      <li key={index}>{message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

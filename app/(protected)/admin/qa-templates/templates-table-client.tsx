"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getQaTemplateVersionFieldsAction,
  setQaTemplateArchivedAction,
  type QaTemplateFieldsResult,
} from "@/app/(protected)/admin/qa-templates/actions";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { FullScreenDialog } from "@/src/components/ui/full-screen-dialog";
import type { QaTemplateFields } from "@/src/lib/qa/c-base-import";
import type { QaTemplateBrowserRow } from "@/src/lib/qa/template-browser";
import { cn } from "@/src/lib/utils";

// Three-dot menu per template row: view definition + archive/unarchive. Mirrors
// the production reason-row kebab (click-outside + Escape to close).
function TemplateRowMenu({
  template,
  onView,
}: {
  template: QaTemplateBrowserRow;
  onView: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleArchive = () => {
    setOpen(false);
    startTransition(async () => {
      await setQaTemplateArchivedAction(template.id, !template.is_archived);
      router.refresh();
    });
  };

  return (
    <div className="relative" ref={ref} onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`Actions for ${template.name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-9 min-w-9 items-center justify-center rounded-md text-lg leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)] disabled:opacity-50"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-10 z-20 min-w-44 rounded-md border border-zinc-200 bg-white py-1 text-left shadow-lg">
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={() => {
              setOpen(false);
              onView();
            }}
          >
            View definition
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-50"
            onClick={toggleArchive}
          >
            {template.is_archived ? "Unarchive template" : "Archive template"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

// Templates table + read-only definition viewer. Clicking a row opens the
// latest version in an overlay; clicking a version badge opens that specific
// version. The definition renders flat (steps as headings, items as plain
// lines) — it is a reference view of the C-base sheet, not an editor.

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString("en-NZ") : "—");

type ViewerState = {
  loading: boolean;
  name: string;
  version: number | null;
  fields: QaTemplateFields | null;
  error: string | null;
};

function FlatDefinition({ fields }: { fields: QaTemplateFields }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-zinc-200">
      {fields.steps.map((step) => (
        <section key={step.id} className="py-5 first:pt-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">{step.title}</h3>
            {step.checkpoint ? <Badge variant="attention">Checkpoint</Badge> : null}
          </div>
          <div className="mt-2 space-y-2">
            {step.items.map((item) => {
              if (item.type === "note") {
                return (
                  <p key={item.id} className="text-sm italic text-zinc-500">
                    📷 {item.label}
                  </p>
                );
              }
              if (item.type === "signoff") {
                return (
                  <p key={item.id} className="text-sm font-medium text-zinc-800">
                    ✍ {item.label}
                  </p>
                );
              }
              return (
                <div key={item.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="text-zinc-800">{item.label}</span>
                  <span className="shrink-0 text-xs text-zinc-400 sm:text-right">
                    {(item.options ?? []).join(" · ")}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {fields.steps.length === 0 ? <p className="py-4 text-sm text-zinc-500">This template has no steps.</p> : null}
    </div>
  );
}

export function QaTemplatesTableClient({ templates }: { templates: QaTemplateBrowserRow[] }) {
  const [viewer, setViewer] = useState<ViewerState | null>(null);
  const [, startTransition] = useTransition();

  const openVersion = (name: string, versionId: string) => {
    setViewer({ loading: true, name, version: null, fields: null, error: null });
    startTransition(async () => {
      const result: QaTemplateFieldsResult = await getQaTemplateVersionFieldsAction(versionId);
      if (result.ok) {
        setViewer({ loading: false, name: result.name, version: result.version, fields: result.fields, error: null });
      } else {
        setViewer({ loading: false, name, version: null, fields: null, error: result.message });
      }
    });
  };

  return (
    <>
      <table className="min-w-[900px] text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-500">
            <th className="px-2 py-1">Template</th>
            <th className="px-2 py-1">Source id</th>
            <th className="px-2 py-1">Latest</th>
            <th className="px-2 py-1">Versions</th>
            <th className="px-2 py-1">Last imported</th>
            <th className="px-2 py-1">Updated</th>
            <th className="px-2 py-1 sr-only">Actions</th>
          </tr>
        </thead>
        <tbody>
          {templates.map((template) => {
            return (
              <tr
                key={template.id}
                className={cn(
                  "border-b border-zinc-100 align-top transition-colors",
                  template.versions.length > 0 ? "cursor-pointer hover:bg-zinc-50" : null,
                  template.is_archived ? "text-zinc-400" : null,
                )}
                onClick={() => {
                  const latest = template.versions[0];
                  if (latest) openVersion(template.name, latest.id);
                }}
              >
                <td className="px-2 py-2 font-medium">
                  <span className={cn(template.is_archived ? "text-zinc-500" : "text-zinc-900")}>{template.name}</span>
                  {template.is_archived ? (
                    <Badge variant="neutral" className="ml-2 align-middle">Archived</Badge>
                  ) : null}
                </td>
                <td className="px-2 py-2 font-mono text-xs text-zinc-500">{template.source_id}</td>
                <td className="px-2 py-2">
                  {template.latest_version !== null ? <Badge variant="success">v{template.latest_version}</Badge> : "—"}
                </td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {template.versions.length === 0
                      ? "—"
                      : template.versions.map((version) => (
                          <button
                            key={version.version}
                            type="button"
                            title={`View v${version.version} · hash ${version.source_row_hash.slice(0, 12)}…`}
                            className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
                            onClick={(event) => {
                              event.stopPropagation();
                              openVersion(template.name, version.id);
                            }}
                          >
                            <Badge variant="muted" className="cursor-pointer hover:bg-zinc-200">
                              v{version.version}
                            </Badge>
                          </button>
                        ))}
                  </div>
                </td>
                <td className="px-2 py-2 text-zinc-600">{formatDateTime(template.last_imported_at)}</td>
                <td className="px-2 py-2 text-zinc-600">{formatDateTime(template.updated_at)}</td>
                <td className="px-2 py-2 text-right">
                  <TemplateRowMenu
                    template={template}
                    onView={() => {
                      const latest = template.versions[0];
                      if (latest) openVersion(template.name, latest.id);
                    }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <FullScreenDialog
        open={viewer !== null}
        eyebrow="QA checklist template"
        title={viewer?.name ?? ""}
        subtitle={viewer?.version !== null && viewer?.version !== undefined ? `Version ${viewer.version} · read-only` : "Read-only"}
        onClose={() => setViewer(null)}
        contentClassName="bg-white"
      >
        {viewer?.loading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Loading template…</p>
        ) : viewer?.error ? (
          <Alert variant="error">{viewer.error}</Alert>
        ) : viewer?.fields ? (
          <FlatDefinition fields={viewer.fields} />
        ) : null}
      </FullScreenDialog>
    </>
  );
}

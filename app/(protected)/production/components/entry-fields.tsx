"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/src/components/ui/input";
import { formatMinutesAsDuration } from "@/src/lib/production/format";
import type { ProductionProjectFileRecord } from "@/src/lib/production/types";
import { cn } from "@/src/lib/utils";

// --- Duration field (HHH:MM) ---------------------------------------------------
// The value is stored/submitted as whole minutes (a hidden number input) while the
// operator sees and edits a consistent HHH:MM string, so everyone enters time the
// same way instead of guessing raw minutes.

const minutesToText = (total: number | null): string => {
  const formatted = formatMinutesAsDuration(total);
  return formatted === "—" ? "" : formatted;
};

// Accepts either decimal hours ("1.5") or an HH:MM / HHH:MM duration ("01:30",
// "125:30") and returns whole minutes. The display always reformats to HH:MM, so
// whatever the user types they immediately see the normalised value.
export const parseDurationToMinutes = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  const colon = trimmed.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (colon) {
    return Number(colon[1]) * 60 + Number(colon[2]);
  }
  const decimalHours = trimmed.match(/^\d+(?:\.\d+)?$/);
  if (decimalHours) {
    return Math.round(Number(trimmed) * 60);
  }
  return null;
};

export function DurationInput({
  id,
  name,
  valueMinutes,
  onChangeMinutes,
  required,
  ariaLabel,
}: {
  id?: string;
  name: string;
  valueMinutes: number | null;
  onChangeMinutes: (minutes: number | null) => void;
  required?: boolean;
  ariaLabel?: string;
}) {
  // While the field is focused the local buffer drives the input; otherwise the
  // canonical minutes value is rendered (formatted). This keeps external updates
  // (e.g. project-file auto-fill) reflected without a sync effect.
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");

  const displayValue = editing ? text : minutesToText(valueMinutes);
  const invalid = editing && text.trim() !== "" && parseDurationToMinutes(text) === null;

  return (
    <>
      <Input
        id={id}
        type="text"
        inputMode="decimal"
        placeholder="1.5 or 01:30"
        aria-label={ariaLabel}
        value={displayValue}
        aria-invalid={invalid || undefined}
        className={invalid ? "border-red-300 focus:border-red-400" : undefined}
        required={required}
        onFocus={() => {
          setText(minutesToText(valueMinutes));
          setEditing(true);
        }}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setText(next);
          onChangeMinutes(parseDurationToMinutes(next));
        }}
        onBlur={() => setEditing(false)}
      />
      <input type="hidden" name={name} value={valueMinutes ?? ""} />
      {invalid ? <p className="text-xs text-red-700">Enter hours (e.g. 1.5) or HH:MM (e.g. 01:30).</p> : null}
    </>
  );
}

// Self-contained duration field for server-rendered forms (e.g. project Total
// time) that have no parent state — manages its own minutes value and submits it
// via DurationInput's hidden input.
export function StandaloneDurationInput({
  id,
  name,
  defaultMinutes = null,
  required,
  ariaLabel,
}: {
  id?: string;
  name: string;
  defaultMinutes?: number | null;
  required?: boolean;
  ariaLabel?: string;
}) {
  const [minutes, setMinutes] = useState<number | null>(defaultMinutes);
  return (
    <DurationInput
      id={id}
      name={name}
      valueMinutes={minutes}
      onChangeMinutes={setMinutes}
      required={required}
      ariaLabel={ariaLabel}
    />
  );
}

// --- Project file picker -------------------------------------------------------
// A searchable combobox that leads with the project file number (what operators
// scan for) and lets them type to filter, instead of scrolling a long native
// <select> where the project name is shown first.

const projectFileSummary = (file: ProductionProjectFileRecord) =>
  `${file.project_file}${file.project_sequence === null ? "" : ` · PS ${file.project_sequence}`}`;

export function ProjectFilePicker({
  id,
  name,
  value,
  onChange,
  projectFiles,
}: {
  id?: string;
  name: string;
  value: string;
  onChange: (projectFileId: string) => void;
  projectFiles: ProductionProjectFileRecord[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selected = projectFiles.find((file) => file.id === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? projectFiles.filter((file) =>
        `${file.project_file} ${file.project_sequence ?? ""} ${file.project_name}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : projectFiles;

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        id={id}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-left text-sm focus:border-zinc-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--he-yellow)]"
      >
        {selected ? (
          <span className="min-w-0 truncate">
            <span className="font-medium text-zinc-900">{projectFileSummary(selected)}</span>
            <span className="text-zinc-500"> — {selected.project_name}</span>
          </span>
        ) : (
          <span className="truncate text-zinc-400">Select project file</span>
        )}
        <span aria-hidden="true" className="shrink-0 text-zinc-400">
          ▾
        </span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-1 w-full rounded-md border border-zinc-200 bg-white shadow-lg">
          <div className="p-2">
            <Input
              autoFocus
              type="text"
              placeholder="Search file number, sequence or name…"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500">No matching project files.</li>
            ) : null}
            {filtered.map((file) => {
              const isSelected = file.id === value;
              return (
                <li key={file.id} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors hover:bg-zinc-50",
                      isSelected && "bg-zinc-50",
                    )}
                    onClick={() => {
                      onChange(file.id);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <span className="font-medium text-zinc-900">{projectFileSummary(file)}</span>
                    <span className="text-xs text-zinc-500">{file.project_name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

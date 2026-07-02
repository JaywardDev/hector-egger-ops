// QA module domain types — Option C shape (see docs/qa-module-design.md §2).
// Project is the universal top container; Lot is metadata (not a level);
// Work Package is an optional in-project Section (one level deep, no recursion).
//
// NOTE: these types describe the *view* shape the pages consume. They are served
// live from Postgres by src/lib/qa/{projects,checklists}.ts.

export type QaSignoffStatus =
  | "not_started"
  | "in_progress"
  | "awaiting_signoff"
  | "signed_off";

// Check items are enumerated single-select (not fixed pass/fail) plus two
// non-answerable row types, matching the real C-base template grammar
// (docs/qa-module-design.md §4.2): `select` = pick one of `options`, `note` =
// instruction / photo prompt, `signoff` = a sign-off / hold-point slot.
export type QaItemType = "select" | "note" | "signoff";

export type QaHoldPointKind = "hold" | "witness";

/** Row in the QA project list. */
export type QaProjectSummary = {
  id: string;
  /** External C-base project reference, e.g. "260013". */
  project_ref: string;
  /** Human name, e.g. "Cardrona - Type A". */
  name: string;
  /** Lot encoded as metadata, not a structural level. Null when the job has no lot. */
  lot_code: string | null;
  /** Rolled-up sign-off status across the project's checklists. */
  status: QaSignoffStatus;
  checklist_count: number;
  hold_points_open: number;
  /** Display-ready date string (no Date parsing needed in the preview). */
  updated_at: string;
};

/** Optional grouping under a project ("SiteQA", "PANEL", "WORKPACKAGE"…). */
export type QaSection = {
  id: string;
  name: string;
  /** Raw imported folder path — the hedge from §2.3, kept verbatim. */
  source_path: string[];
};

/** Row in a project's checklist list. */
export type QaChecklistSummary = {
  id: string;
  /** Sheet code, e.g. "EW_0001". */
  code: string;
  title: string;
  /** Null = hangs directly off the project (no section). */
  section_id: string | null;
  status: QaSignoffStatus;
  pass_count: number;
  fail_count: number;
  /** Template version this checklist was snapshotted against (§4.1). */
  template_version: string;
  updated_at: string;
};

export type QaEvidence = {
  id: string;
  caption: string;
  added_by: string;
  added_at: string;
};

export type QaCheckItem = {
  id: string;
  type: QaItemType;
  label: string;
  /** Allowed answers for `select` items (the C-base `Values` list). */
  options?: string[];
  /** The chosen value on this checklist instance; null = not yet answered. */
  selected_value?: string | null;
};

export type QaCheckStep = {
  id: string;
  title: string;
  /** True when the step is a formal checkpoint/gate (C-base `checkpoint` row). */
  checkpoint?: boolean;
  items: QaCheckItem[];
  evidence: QaEvidence[];
};

export type QaHoldPoint = {
  id: string;
  label: string;
  kind: QaHoldPointKind;
  status: QaSignoffStatus;
  signed_by?: string;
  signed_at?: string;
};

/** A project with its sections and checklists, for the explorer view. */
export type QaProjectDetail = QaProjectSummary & {
  sections: QaSection[];
  checklists: QaChecklistSummary[];
};

/** A fully expanded checklist, for the capture/detail view. */
export type QaChecklistDetail = QaChecklistSummary & {
  project_id: string;
  project_ref: string;
  project_name: string;
  lot_code: string | null;
  section_name: string | null;
  steps: QaCheckStep[];
  hold_points: QaHoldPoint[];
};

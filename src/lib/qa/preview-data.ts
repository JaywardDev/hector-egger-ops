// Placeholder QA dataset for the module preview.
//
// This is stand-in data ONLY — it exists so the pages are tangible and
// clickable before the C-base import + Supabase migration are built. The
// accessor functions below deliberately mirror the signatures a real data layer
// will expose (list / get by id), so swapping this file for Postgres-backed
// queries later is a drop-in change and the pages don't move.
//
// Shape follows Option C (docs/qa-module-design.md §2). Numbers/names are
// modelled on the CONQA "260013 - Cardrona - Type A - Lot 306" reference so the
// screen feels familiar to people who have used CONQA.

import type {
  QaChecklistDetail,
  QaChecklistSummary,
  QaProjectDetail,
  QaProjectSummary,
  QaSection,
} from "@/src/lib/qa/types";

const SECTIONS_CARDRONA: QaSection[] = [
  { id: "sec-siteqa", name: "SiteQA", source_path: ["SiteQA"] },
  { id: "sec-loadingplan", name: "LOADINGPLAN", source_path: ["LOADINGPLAN"] },
  { id: "sec-workpackage", name: "WORKPACKAGE", source_path: ["WORKPACKAGE"] },
  { id: "sec-panel", name: "PANEL", source_path: ["PANEL"] },
];

const CARDRONA_CHECKLISTS: QaChecklistSummary[] = [
  { id: "ew-0001", code: "EW_0001", title: "Framing and Inside Layers", section_id: "sec-panel", status: "awaiting_signoff", pass_count: 1, fail_count: 0, template_version: "v3", updated_at: "Jun 23, 2026" },
  { id: "ew-0002", code: "EW_0002", title: "Inside Lining", section_id: "sec-panel", status: "in_progress", pass_count: 0, fail_count: 0, template_version: "v3", updated_at: "Jun 23, 2026" },
  { id: "ew-0003", code: "EW_0003", title: "Services Rough-in", section_id: "sec-panel", status: "not_started", pass_count: 0, fail_count: 0, template_version: "v3", updated_at: "Jun 20, 2026" },
  { id: "ew-0004", code: "EW_0004", title: "Insulation", section_id: "sec-panel", status: "signed_off", pass_count: 6, fail_count: 0, template_version: "v3", updated_at: "Jun 18, 2026" },
  { id: "spl-00", code: "A.SPL_00", title: "Setout & Splice Points", section_id: "sec-siteqa", status: "signed_off", pass_count: 4, fail_count: 0, template_version: "v2", updated_at: "Jun 12, 2026" },
  { id: "wall-01", code: "A.WALL", title: "Wall Line Inspection", section_id: "sec-siteqa", status: "in_progress", pass_count: 2, fail_count: 1, template_version: "v2", updated_at: "Jun 24, 2026" },
  { id: "lp-01", code: "LP_01", title: "Loading Plan Check", section_id: "sec-loadingplan", status: "not_started", pass_count: 0, fail_count: 0, template_version: "v1", updated_at: "Jun 10, 2026" },
];

const PROJECTS: QaProjectDetail[] = [
  {
    id: "cardrona-type-a",
    project_ref: "260013",
    name: "Cardrona - Type A",
    lot_code: "Lot 306",
    status: "in_progress",
    checklist_count: CARDRONA_CHECKLISTS.length,
    hold_points_open: 2,
    updated_at: "Jun 24, 2026",
    sections: SECTIONS_CARDRONA,
    checklists: CARDRONA_CHECKLISTS,
  },
  {
    id: "cardrona-type-a2",
    project_ref: "250013",
    name: "Cardrona Type A2",
    lot_code: "Lot 321",
    status: "awaiting_signoff",
    checklist_count: 5,
    hold_points_open: 1,
    updated_at: "Jun 21, 2026",
    sections: SECTIONS_CARDRONA,
    checklists: [],
  },
  {
    id: "te-one-school",
    project_ref: "240007",
    name: "Te One School - Chatham Island",
    lot_code: null,
    status: "signed_off",
    checklist_count: 8,
    hold_points_open: 0,
    updated_at: "May 30, 2026",
    sections: [{ id: "sec-siteqa-teone", name: "SiteQA", source_path: ["SiteQA"] }],
    checklists: [],
  },
  {
    id: "contract-labour",
    project_ref: "240024",
    name: "Contract Labour",
    lot_code: null,
    status: "not_started",
    checklist_count: 0,
    hold_points_open: 0,
    updated_at: "May 12, 2026",
    sections: [],
    checklists: [],
  },
];

const CHECKLIST_DETAILS: Record<string, QaChecklistDetail> = {
  "ew-0001": {
    id: "ew-0001",
    code: "EW_0001",
    title: "Framing and Inside Layers",
    section_id: "sec-panel",
    status: "awaiting_signoff",
    pass_count: 1,
    fail_count: 0,
    template_version: "v3",
    updated_at: "Jun 23, 2026",
    project_id: "cardrona-type-a",
    project_ref: "260013",
    project_name: "Cardrona - Type A",
    lot_code: "Lot 306",
    section_name: "PANEL",
    steps: [
      {
        id: "step-1",
        title: "Step 1 — Framing and Inside Layers",
        instruction: "Take photos of frame, fixings and connections.",
        items: [
          { id: "s1-i1", label: "Framing check for square.", answer: "yes" },
          { id: "s1-i2", label: "Structural fixings in frame are as per drawings.", answer: "yes" },
          { id: "s1-i3", label: "Slings installed as per drawings.", answer: "yes" },
        ],
        evidence: [
          { id: "ev-1", caption: "Frame overview", added_by: "Zeus Guillergan", added_at: "2:34PM, Jun 23" },
          { id: "ev-2", caption: "Fixing detail", added_by: "Zeus Guillergan", added_at: "2:35PM, Jun 23" },
          { id: "ev-3", caption: "Connection A", added_by: "Zeus Guillergan", added_at: "2:35PM, Jun 23" },
          { id: "ev-4", caption: "Sling installation", added_by: "Zeus Guillergan", added_at: "2:35PM, Jun 23" },
        ],
      },
      {
        id: "step-2",
        title: "Step 2 — Inside Lining",
        instruction: "Confirm lining material and fixings before close-up.",
        items: [
          { id: "s2-i1", label: "Lining material matches specification.", answer: null },
          { id: "s2-i2", label: "Fixing centres as per drawings.", answer: null },
        ],
        evidence: [],
      },
    ],
    hold_points: [
      { id: "hp-1", label: "Pre-close-up hold point", kind: "hold", status: "awaiting_signoff" },
      { id: "wp-1", label: "Structural fixings witness", kind: "witness", status: "signed_off", signed_by: "D M McDonald", signed_at: "Jun 23, 2026" },
    ],
  },
};

// ---- Accessors (shape-compatible with the future data layer) ---------------

export const listQaProjects = (): QaProjectSummary[] =>
  PROJECTS.map((project) => ({
    id: project.id,
    project_ref: project.project_ref,
    name: project.name,
    lot_code: project.lot_code,
    status: project.status,
    checklist_count: project.checklist_count,
    hold_points_open: project.hold_points_open,
    updated_at: project.updated_at,
  }));

export const getQaProject = (id: string): QaProjectDetail | null =>
  PROJECTS.find((project) => project.id === id) ?? null;

export const getQaChecklist = (id: string): QaChecklistDetail | null =>
  CHECKLIST_DETAILS[id] ?? null;

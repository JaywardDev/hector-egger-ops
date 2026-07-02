# QA Report (Phase 2) — Design Note

Status: **Decision note.** Scoped by `docs/qa-module-roadmap.md` Phase 2 and
`docs/qa-module-design.md` §5.2. Its job is to settle the **one real decision**
Phase 2 hinges on — *how the PDF is rendered* — plus the data-sourcing and
reproducibility approach, so the library call can be made before any report code
is written.

> **Layout is deliberately provisional here.** The company's real CONQA report is
> being fetched to use as the visual reference; §5 below is a sensible default to
> be replaced by it. Everything else in this note (library, data source,
> reproducibility, route, storage) is **independent of the exact layout** and is
> what actually needs deciding now.

---

## 1. Goal

A reproducible, auth-gated **QA report export** for a signed-off unit (per
project, with per-checklist sections; the exact unit — project vs. lot — is one
of the few things the CONQA reference will confirm). The report shows, per
checklist: every item and its recorded answer, the evidence photos, and the
hold-point sign-offs with **who signed and when** (already captured immutably in
Phase 1 — see the authority decision in the roadmap §0.3).

Non-negotiables:
- Built from the checklist's **frozen `fields_snapshot` + stored answers**, never
  the live template → regeneration is deterministic.
- Served through an **auth-gated route**, same shape as the stock-take export.
- Signed records are immutable; the report is a *view* of them, never a mutation.

---

## 2. The decision: how to render the PDF

The roadmap already ruled out **hand-rolling PDF** ("far harder than the
hand-rolled XLSX — treat as a real dependency decision"). The repo has no PDF or
headless-browser dependency today, and prod runs on **Vercel serverless**, which
constrains the options. Realistic candidates:

| Option | What it is | Fit for us | Cost / risk |
|---|---|---|---|
| **`@react-pdf/renderer`** ⭐ | React components → real PDF buffer, server-side, **no browser** | Strong — flows variable-length checklists, embeds evidence images natively, renders in a Vercel function | A real dependency (~a few MB); font registration + occasional layout quirks to learn |
| **`pdf-lib`** | Low-level "draw text/rects at coordinates" | Weak — you hand-position and hand-paginate everything; painful when checklists run 3–55 rows of varying height | Small dep, but high authoring effort for dynamic content |
| **HTML→print (client `window.print()`)** | A normal auth-gated report page + print stylesheet; user prints / saves as PDF | Decent stopgap — zero deps, reuses all existing React/Tailwind | Not a server-stored artifact; fidelity depends on the user's browser; hard to archive/email or guarantee reproducibility |
| **Headless Chrome (Puppeteer / `@sparticuz/chromium`)** | Render the HTML page → PDF server-side | Highest visual fidelity | Heavy + fragile on Vercel serverless (cold starts, binary-size limits) — poor trade for a document report |

### Recommendation: `@react-pdf/renderer`, with HTML→print as the fallback

**Why `@react-pdf/renderer`:**
- Produces a **real PDF file server-side without a headless browser** — drops
  straight into the stock-take export route pattern (build buffer → stream with
  `Content-Disposition`), and runs safely in a Vercel function.
- **Variable-length content flows automatically** across pages. Our checklists
  range from a 3-row screw-box to a 55-row site-assembly sheet; a
  coordinate-drawing library (`pdf-lib`) would make that pagination our problem.
- **Native image embedding** for evidence photos — the one hard requirement a
  text-only PDF approach struggles with.
- It is a **document-generation** library (declarative React), not a browser — so
  it's the closest thing to "hand-rolled but sane," which fits how this codebase
  works.

**The honest cost:** it *is* a dependency in a codebase that prides itself on
having very few, and it has its own layout model (a flexbox subset) and font
handling to learn. That's an acceptable, bounded cost for a document we must
generate reliably and archive.

**When HTML→print wins instead:** if, once we see the CONQA report, it turns out
to be simple and mostly for on-screen review / occasional print — not an archived
file that gets attached to handovers — then HTML→print is the zero-dependency
answer and we should take it. So: **provisionally `@react-pdf/renderer`; confirm
against the real report before adding the dep.**

---

## 3. Data sourcing (deterministic by construction)

- Report input is assembled the same way `getQaChecklistDetail` already does, but
  **aggregated per project**: project/lot header → each checklist → its
  `fields_snapshot` steps/items with stored `selected_value` → per-step evidence
  → hold-point sign-offs (`signed_by` name + `signed_at`).
- **Always read from the snapshot + stored rows**, never the live
  `qa_template_version`. A checklist started against v3 must report as v3 forever,
  even after v4 is imported. Phase 1 already froze this — the report just consumes
  it.
- Evidence images are pulled from the private `qa-evidence` bucket via the
  service role **at render time** and embedded as bytes (react-pdf accepts image
  buffers). No public URLs.

---

## 4. Reproducibility

- **Structural stability is the contract:** same signed-off input → same visible
  report. Guaranteed because the input is a frozen snapshot + immutable rows.
- **Byte stability caveat:** PDFs embed a creation date / document `ID` by
  default, so raw bytes differ per run. Handle it one of two ways — pin/strip the
  PDF metadata date, or (simpler) assert on **extracted text + structure** rather
  than raw bytes. The roadmap's "regenerate → stable output" test targets the
  latter.
- Do **not** include "generated at <now>" in the report body (or if the company's
  report wants it, keep it in a clearly non-content footer excluded from the
  reproducibility assertion).

---

## 5. Layout (PROVISIONAL — to be replaced by the real CONQA report)

A reasonable default until the reference arrives:

```
┌───────────────────────────────────────────────┐
│ Hector Egger — QA Report        [project ref]  │  ← header band
│ Project name · Lot code · exported date        │
├───────────────────────────────────────────────┤
│ Checklist: EWi0e1 — … (v2)      status badge   │  ← one section per checklist
│  Step 1 — Framing and Inside Layers            │
│    • Framing check for square           Yes    │
│    • Slings installed…                  N/A    │
│    [ photo ] [ photo ]                          │  ← evidence thumbnails inline
│  …                                             │
│  Hold points                                    │
│    ✓ Final Installer Signoff  — J. Smith, 2/7   │  ← signer + timestamp
│    ✓ Structural Engineer Insp. — A. Lee, 2/7    │
└───────────────────────────────────────────────┘
```

The CONQA reference will settle: report unit (project vs. lot), cover page,
section ordering, how photos are laid out/sized, whether unanswered items are
shown or hidden, and any required letterhead/compliance footer.

---

## 6. Route + storage (reuse the stock-take export verbatim)

- `app/(protected)/qa/projects/[projectId]/report/route.ts` — auth-gated `GET`,
  build the PDF buffer, return it with
  `Content-Type: application/pdf` + `Content-Disposition: attachment`. Directly
  mirrors `app/(protected)/stock-take/export/route.ts`.
- Pure builder in `src/lib/qa/report/…` (data assembly + the react-pdf document),
  kept testable and free of route concerns — same split as
  `getStockTakeExportData` + `buildStockTakeExportXlsx`.
- **Optional audit snapshot:** a `qa_report_snapshot` row (who/when/project/
  checklist count/hash) on each export, cloning
  `20260626120000_stock_take_export_snapshots.sql`. Non-critical (wrap in
  try/catch — the export still succeeds if the snapshot write fails).
- Gate on **signed-off** state where the company requires it (e.g. only a fully
  signed-off lot may export a "final" report); allow a draft/interim export
  otherwise — a policy question for the CONQA reference.

---

## 7. What the CONQA reference will settle (so we don't guess)

- Report **unit** and grouping (project vs. lot; one file or per-checklist).
- Whether it must be an **archived file** (→ `@react-pdf/renderer`) or is mainly
  on-screen/print (→ HTML→print may suffice).
- Cover page, letterhead, any compliance/standards footer.
- Photo layout and sizing; whether every photo or a selection.
- Unanswered / N/A item handling.
- Whether "interim" (not-yet-signed) exports are allowed.

---

## 8. Rough shape of the work (after the library call)

1. Add + configure the chosen renderer (font registration, base document).
2. `src/lib/qa/report/data.ts` — per-project aggregation (extends the
   `getQaChecklistDetail` assembly).
3. `src/lib/qa/report/document.tsx` — the report document (layout from §5/CONQA).
4. Auth-gated route + (optional) `qa_report_snapshot` migration.
5. Reproducibility test (structure/text-stable) + a report entry point in the QA
   project UI.

Self-contained; unblocked by everything else. The only gate is the §2 decision,
which we finalise the moment the real report is in hand.

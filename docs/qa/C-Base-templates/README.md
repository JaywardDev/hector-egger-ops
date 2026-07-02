# QA checklist template samples — reference fixtures

Read-only samples of the **C-base QA sheet export shape**, kept as the ground
truth for building and testing the QA import pipeline (see
`docs/qa-module-design.md` §4 and `docs/qa-module-roadmap.md` Phase 1a). These
are *templates* (the shape of QA sheets), **not** submitted inspection data.

Source of truth is **C-base**. (CONQA is being replaced and is not part of the
running workflow — these are the C-base QA sheet definitions.)

## Layout

```
docs/qa/C-Base-templates/
  checklist/   ← every QA sheet (one "Master List Templates" sheet each)
```

Drop the `.xlsx` files straight into `checklist/`. No naming rules beyond keeping
the original export filename so it's traceable.

Every template exports the same way — a single **Master List Templates** sheet
with the `Id · Type · Name · Values · Prompting Name` grammar — whether it is a
factory panel-assembly sheet, a site-assembly sheet, a work-package / precut /
screw-box sheet, or a site-variation sheet. There is **no** separate "project"
or "folder" template format to import; those are C-base authoring conveniences
and never leave C-base. The parser handles the full grammar (sections,
subsection headings, select/text/date/note items, and plain, required and gated
sign-offs) — see design §4.2.

## Rules

- **No PII.** Do **not** commit the **Users / authority export** here (it
  carries names, emails, phone numbers). The authorization model is described in
  the design doc; if a sample is needed, redact it first.
- **Templates only** — never submitted/live QA records.
- Treat as fixtures: the importer's tests read these to prove the row-type
  grammar (§4.2) holds across sheets.

## Why in the repo

Follows the existing precedent of storing C-base sample exports alongside the
code (`docs/qry_TIMESHEET_BuildingsExport.xlsx`,
`docs/qry_TIMESHEET_CostcodesExport.xlsx`). These files are small and change
rarely, so the binary footprint is negligible and having the real shape versioned
next to the importer is worth it.

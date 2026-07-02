# QA checklist template samples — reference fixtures

Read-only samples of the **C-base QA sheet export shape**, kept as the ground
truth for building and testing the QA import pipeline (see
`docs/qa-module-design.md` §4 and `docs/qa-module-roadmap.md` Phase 1a). These
are *templates* (the shape of QA sheets), **not** submitted inspection data.

Source of truth is **C-base**. (These particular samples were pulled via the
legacy CONQA app, which renders the same sheets in the same export format —
CONQA is being replaced and is not part of the running workflow. The folder name
is historical; the content is the C-base QA sheet definitions.)

## Layout

```
docs/qa/conqa-templates/
  checklist/   ← the QA sheets themselves (the important ones). Priority: factory panel assembly.
  project/     ← project templates (authoring blueprints — deferred, see design §4.3)
  folder/      ← folder templates (authoring blueprints — deferred)
```

Drop the `.xlsx` files straight into the matching subfolder. No naming rules
beyond keeping the original export filename so it's traceable.

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

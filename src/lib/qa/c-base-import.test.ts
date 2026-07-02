import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  parseQaChecklistTemplate,
  type QaTemplateItemType,
} from "@/src/lib/qa/c-base-import";

// Runs the parser against every committed C-base checklist template
// (docs/qa/C-Base-templates/checklist/). These are the ground truth for the
// row-type grammar (docs/qa-module-design.md §4.2); the suite fails if a new
// export breaks an assumption the importer relies on. The set spans the
// factory-assembly panels *and* the site-assembly / work-package / precut
// templates, which exercise the fuller grammar (headings, text/date fields,
// required + gated sign-offs).

const FIXTURE_DIR = path.join(__dirname, "../../../docs/qa/C-Base-templates/checklist");
const fixtureFiles = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".xlsx"));
const readFixture = (file: string) => readFileSync(path.join(FIXTURE_DIR, file));
const parseByName = (needle: string) => {
  const file = fixtureFiles.find((f) => f.includes(needle));
  assert.ok(file, `fixture matching "${needle}" should exist`);
  return parseQaChecklistTemplate(readFixture(file!));
};

const KNOWN_ITEM_TYPES: QaTemplateItemType[] = ["select", "text", "date", "note", "heading", "signoff"];
// Every C-base `Type` string the parser understands (raw rows carry these
// verbatim; anything outside this set would raise an "Unknown row type" warning).
const KNOWN_ROW_TYPES = new Set([
  "checklist",
  "section",
  "checkpoint",
  "checkpoint-no-value",
  "button",
  "note",
  "textbox",
  "date",
  "signoff",
  "signoff:required",
]);

test("fixtures are present", () => {
  assert.ok(fixtureFiles.length >= 12, `expected >= 12 checklist fixtures, found ${fixtureFiles.length}`);
});

for (const file of fixtureFiles) {
  test(`parses cleanly: ${file}`, () => {
    const result = parseQaChecklistTemplate(readFixture(file));

    assert.deepEqual(result.errors, [], `unexpected fatal errors: ${JSON.stringify(result.errors)}`);
    assert.ok(result.fields, "fields should be present");
    assert.ok(result.sourceRowHash && /^[0-9a-f]{64}$/.test(result.sourceRowHash), "hash should be 64 hex chars");

    const fields = result.fields!;
    assert.ok(fields.source_id.length > 0, "source_id should be non-empty");
    assert.ok(Number.isInteger(fields.version) && fields.version >= 1, "version should be a positive integer");
    assert.ok(fields.name.length > 0, "name should be non-empty");
    assert.ok(fields.steps.length > 0, "should have at least one step");

    // No unrecognised row types slipped through (no silent drops).
    for (const row of result.raw) {
      assert.ok(KNOWN_ROW_TYPES.has(row.type), `unknown row type "${row.type}" in ${file}`);
    }
    assert.ok(
      !result.warnings.some((w) => w.message.startsWith("Unknown row type")),
      `unexpected unknown-type warning in ${file}`,
    );

    for (const step of fields.steps) {
      assert.ok(step.title.length > 0, "step title should be non-empty");
      for (const item of step.items) {
        assert.ok(KNOWN_ITEM_TYPES.includes(item.type), `bad item type ${item.type}`);
        if (item.type === "select") {
          assert.ok(Array.isArray(item.options) && item.options.length > 0, `select "${item.label}" needs options`);
        }
        if (item.type === "signoff" && item.required !== undefined) {
          assert.equal(item.required, true, "required is only ever set to true");
        }
      }
    }
  });
}

test("parsing is deterministic (stable hash)", () => {
  const buffer = readFixture(fixtureFiles[0]!);
  const a = parseQaChecklistTemplate(buffer);
  const b = parseQaChecklistTemplate(buffer);
  assert.equal(a.sourceRowHash, b.sourceRowHash);
});

test("EWi0e1 parses to the expected shape", () => {
  const { fields } = parseByName("EWi0e1");
  assert.ok(fields);

  assert.equal(fields!.name, "EWi0e1 - 0 Internal Layer - 1 External Layer - Batts");
  assert.equal(fields!.version, 2);

  const step1 = fields!.steps[0]!;
  assert.equal(step1.title, "Step 1 - Framing and Inside Layers");

  const slings = step1.items.find((i) => i.label.startsWith("Slings installed"));
  assert.ok(slings && slings.type === "select");
  assert.deepEqual(slings!.options, ["Yes", "No", "Not Applicable"]);

  // The photo prompt is a note (non-answerable), not a select.
  assert.ok(step1.items.some((i) => i.type === "note" && i.label.startsWith("Take Photos")));

  // The lone checkpoint repeats the section title, so no heading item is emitted
  // and the sign-off carries no gate (this is what keeps the factory templates
  // byte-identical after the grammar upgrade).
  assert.ok(!step1.items.some((i) => i.type === "heading"));
  const last = fields!.steps.at(-1)!;
  assert.equal(last.checkpoint, true);
  const signoff = last.items.find((i) => i.type === "signoff");
  assert.ok(signoff);
  assert.equal(signoff!.required, undefined);
  assert.equal(signoff!.gate, undefined);
});

test("textbox rows become answerable text fields (Ri1e1BI)", () => {
  const result = parseByName("Ri1e1BI");

  // The raw rows preserve the original `textbox` type (the §2.3 hedge)...
  assert.ok(result.raw.some((r) => r.type === "textbox"), "expected a textbox row in raw");
  // ...and it now maps to a `text` item (a field the operator fills in), not a note.
  const items = result.fields!.steps.flatMap((s) => s.items);
  assert.ok(items.some((i) => i.type === "text"), "expected a text item");
});

test("site-assembly template has subsection headings and required, gated hold points (A_MF)", () => {
  const { fields } = parseByName("A_MF");
  assert.ok(fields);

  // A section whose title lists two groups splits into two headings.
  const fireAcoustic = fields!.steps.find((s) => s.title === "Passive Fire, Acoustic");
  assert.ok(fireAcoustic, "expected the 'Passive Fire, Acoustic' section");
  const headings = fireAcoustic!.items.filter((i) => i.type === "heading").map((i) => i.label);
  assert.deepEqual(headings, ["Passive Fire", "Acoustic"]);

  // The "Final check" section holds two distinct required hold points, each
  // labelled by the checkpoint that gates it.
  const finalCheck = fields!.steps.find((s) => s.title === "Final check");
  assert.ok(finalCheck, "expected the 'Final check' section");
  const signoffs = finalCheck!.items.filter((i) => i.type === "signoff");
  assert.equal(signoffs.length, 2);
  assert.ok(signoffs.every((s) => s.required === true), "site sign-offs are required");
  assert.deepEqual(
    signoffs.map((s) => s.gate),
    ["Final Installer Signoff", "Structural Engineer Inspection"],
  );
});

test("precut template captures date and text inputs (PCUT)", () => {
  const { fields } = parseByName("PCUT");
  assert.ok(fields);

  const items = fields!.steps.flatMap((s) => s.items);
  const date = items.find((i) => i.type === "date");
  assert.ok(date && date.label === "Date and time machined", "expected the machined-date field");

  const text = items.find((i) => i.type === "text");
  assert.ok(text && text.label === "Timber pack ID", "expected the pack-ID text field");
});

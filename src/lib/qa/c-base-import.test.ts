import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  parseQaChecklistTemplate,
  type QaTemplateItemType,
} from "@/src/lib/qa/c-base-import";

// Runs the parser against every committed factory-assembly checklist template
// (docs/qa/conqa-templates/checklist/). These are the ground truth for the
// row-type grammar (docs/qa-module-design.md §4.2); the suite fails if a new
// export breaks an assumption the importer relies on.

const FIXTURE_DIR = path.join(__dirname, "../../../docs/qa/conqa-templates/checklist");
const fixtureFiles = readdirSync(FIXTURE_DIR).filter((file) => file.endsWith(".xlsx"));
const readFixture = (file: string) => readFileSync(path.join(FIXTURE_DIR, file));

const KNOWN_ITEM_TYPES: QaTemplateItemType[] = ["select", "note", "signoff"];
const KNOWN_ROW_TYPES = new Set([
  "checklist",
  "section",
  "checkpoint",
  "checkpoint-no-value",
  "button",
  "note",
  "textbox",
  "signoff",
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

    // No unrecognised row types slipped through.
    for (const row of result.raw) {
      assert.ok(KNOWN_ROW_TYPES.has(row.type), `unknown row type "${row.type}" in ${file}`);
    }
    assert.ok(
      !result.warnings.some((w) => w.message.startsWith("Unknown row type")),
      `unexpected unknown-type warning in ${file}`,
    );

    let signoffCount = 0;
    let checkpointSteps = 0;
    for (const step of fields.steps) {
      assert.ok(step.title.length > 0, "step title should be non-empty");
      if (step.checkpoint) checkpointSteps += 1;
      for (const item of step.items) {
        assert.ok(KNOWN_ITEM_TYPES.includes(item.type), `bad item type ${item.type}`);
        if (item.type === "select") {
          assert.ok(Array.isArray(item.options) && item.options.length > 0, `select "${item.label}" needs options`);
        }
        if (item.type === "signoff") signoffCount += 1;
      }
    }

    // Every factory-assembly sheet ends in a checkpoint gate + a sign-off.
    assert.ok(checkpointSteps >= 1, "should have at least one checkpoint step");
    assert.ok(signoffCount >= 1, "should have at least one sign-off item");
  });
}

test("parsing is deterministic (stable hash)", () => {
  const buffer = readFixture(fixtureFiles[0]!);
  const a = parseQaChecklistTemplate(buffer);
  const b = parseQaChecklistTemplate(buffer);
  assert.equal(a.sourceRowHash, b.sourceRowHash);
});

test("EWi0e1 parses to the expected shape", () => {
  const file = fixtureFiles.find((f) => f.includes("EWi0e1"));
  assert.ok(file, "EWi0e1 fixture should exist");
  const { fields } = parseQaChecklistTemplate(readFixture(file!));
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

  // Final step is a checkpoint carrying the sign-off.
  const last = fields!.steps.at(-1)!;
  assert.equal(last.checkpoint, true);
  assert.ok(last.items.some((i) => i.type === "signoff"));
});

test("textbox rows are treated as notes (Ri1e1BI)", () => {
  const file = fixtureFiles.find((f) => f.includes("Ri1e1BI"));
  assert.ok(file, "Ri1e1BI fixture should exist");
  const result = parseQaChecklistTemplate(readFixture(file!));

  // The raw rows preserve the original `textbox` type (the §2.3 hedge)...
  assert.ok(result.raw.some((r) => r.type === "textbox"), "expected a textbox row in raw");
  // ...but no item carries a `textbox` type — it is mapped to a note.
  const itemTypes = new Set(result.fields!.steps.flatMap((s) => s.items.map((i) => i.type)));
  assert.ok(!itemTypes.has("textbox" as QaTemplateItemType));
});

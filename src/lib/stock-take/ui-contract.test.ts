import assert from "node:assert/strict";
import test from "node:test";
import {
  ADD_MATERIAL_FIELDS,
  FORBIDDEN_WORKING_LIST_HEADERS,
  STOCK_TAKE_PAGE_DESCRIPTION,
  STOCK_TAKE_PAGE_TITLE,
  UPDATE_STOCK_LABEL,
  WORKING_LIST_HEADERS,
} from "@/src/lib/stock-take/ui-contract";

test("working list headers are exactly the required columns", () => {
  assert.deepEqual([...WORKING_LIST_HEADERS], ["Timber", "Level", "Quantity"]);
});

test("working list does not render forbidden row columns", () => {
  for (const header of FORBIDDEN_WORKING_LIST_HEADERS) {
    assert.equal(WORKING_LIST_HEADERS.includes(header as never), false);
  }
});

test("stock take page uses area-first operational copy", () => {
  assert.equal(STOCK_TAKE_PAGE_TITLE, "Stock take");
  assert.equal(STOCK_TAKE_PAGE_DESCRIPTION, "Count timber in one area and update the stock list.");
});

test("add new material form only asks for the required fields", () => {
  assert.deepEqual([...ADD_MATERIAL_FIELDS], ["Height", "Width", "Length", "Grade", "Treatment"]);
});

test("main submit button says Update stock", () => {
  assert.equal(UPDATE_STOCK_LABEL, "Update stock");
});

test("stock-take client keeps forbidden working-list labels out of table headers", () => {
  const renderedHeaders = WORKING_LIST_HEADERS.join(" ");

  for (const forbidden of [
    "Location",
    "Area",
    "Note",
    "Notes",
    "Reason",
    "Comment",
    "Comments",
    "Description",
    "Metadata",
    "Status",
    "Session",
  ]) {
    assert.equal(renderedHeaders.includes(forbidden), false);
  }
});

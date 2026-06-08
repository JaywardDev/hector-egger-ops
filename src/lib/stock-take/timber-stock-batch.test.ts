import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinalizedEntryRowsForScope,
  countAffectedLocationScopes,
  toTimberStockChangeKey,
} from "./timber-stock-batch";

test("changed rows preserve unchanged balances in the same location scope", () => {
  const rows = buildFinalizedEntryRowsForScope({
    stockLocationId: "loc-a",
    currentBalances: [
      { inventoryItemId: "item-a", stockLocationId: "loc-a", quantity: 5 },
      { inventoryItemId: "item-b", stockLocationId: "loc-a", quantity: 8 },
    ],
    changes: [
      {
        kind: "existing",
        inventoryItemId: "item-a",
        stockLocationId: "loc-a",
        countedQuantity: 7,
        notes: "Counted",
      },
    ],
  });

  assert.deepEqual(rows, [
    {
      entryId: null,
      inventoryItemId: "item-a",
      stockLocationId: "loc-a",
      countedQuantity: 7,
      bay: null,
      level: null,
      notes: "Counted",
    },
    {
      entryId: null,
      inventoryItemId: "item-b",
      stockLocationId: "loc-a",
      countedQuantity: 8,
      bay: null,
      level: null,
      notes: null,
    },
  ]);
});

test("multiple changed rows in the same location override only those items", () => {
  const rows = buildFinalizedEntryRowsForScope({
    stockLocationId: "loc-a",
    currentBalances: [
      { inventoryItemId: "item-a", stockLocationId: "loc-a", quantity: 5 },
      { inventoryItemId: "item-b", stockLocationId: "loc-a", quantity: 8 },
      { inventoryItemId: "item-c", stockLocationId: "loc-a", quantity: 13 },
    ],
    changes: [
      { kind: "existing", inventoryItemId: "item-a", stockLocationId: "loc-a", countedQuantity: 6 },
      { kind: "existing", inventoryItemId: "item-c", stockLocationId: "loc-a", countedQuantity: 15 },
    ],
  });

  assert.deepEqual(
    rows.map((row) => [row.inventoryItemId, row.countedQuantity]),
    [
      ["item-a", 6],
      ["item-b", 8],
      ["item-c", 15],
    ],
  );
});

test("new missing timber is added only to the finalized rows when supplied as a resolved change", () => {
  const rows = buildFinalizedEntryRowsForScope({
    stockLocationId: null,
    currentBalances: [
      { inventoryItemId: "item-a", stockLocationId: null, quantity: 5 },
    ],
    changes: [
      { kind: "existing", inventoryItemId: "new-item", stockLocationId: null, countedQuantity: 2 },
    ],
  });

  assert.deepEqual(
    rows.map((row) => [row.inventoryItemId, row.stockLocationId, row.countedQuantity]),
    [
      ["item-a", null, 5],
      ["new-item", null, 2],
    ],
  );
});

test("location scope helpers distinguish null and multiple physical locations", () => {
  assert.equal(toTimberStockChangeKey({ inventoryItemId: "item-a", stockLocationId: null }), "item-a:__none__");
  assert.equal(
    countAffectedLocationScopes([
      { stockLocationId: null },
      { stockLocationId: "loc-a" },
      { stockLocationId: "loc-a" },
      { stockLocationId: "loc-b" },
    ]),
    3,
  );
});

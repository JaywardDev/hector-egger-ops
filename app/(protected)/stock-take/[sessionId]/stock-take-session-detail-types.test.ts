import assert from "node:assert/strict";
import test from "node:test";
import { toDraftRows, type EntryRow } from "./stock-take-session-detail-types";

const savedEntryWithLocation = (stockLocationId: string): EntryRow => ({
  id: "entry-1",
  inventory_item: {
    id: "item-1",
    name: "Pine board",
    item_code: "PB-001",
    unit: "each",
    material_group: { label: "Timber" },
  },
  counted_quantity: 12,
  bay: "B1",
  level: "L2",
  stock_location: {
    id: stockLocationId,
    name: "Main warehouse",
    code: "MAIN",
  },
  notes: "Count checked",
  updated_at: "2026-06-07T01:30:00.000Z",
  entered_at: "2026-06-07T01:00:00.000Z",
});

test("saved stocktake entry location id hydrates into draft row stockLocationId", () => {
  const [draftRow] = toDraftRows([savedEntryWithLocation("loc-main")]);

  assert.equal(draftRow.stockLocationId, "loc-main");
});

test("saved draft response keeps selected location after converting back to draft rows", () => {
  const selectedStockLocationId = "loc-yard";
  const savedResponseRows: EntryRow[] = [
    {
      ...savedEntryWithLocation(selectedStockLocationId),
      id: "entry-saved-draft",
      stock_location: {
        id: selectedStockLocationId,
        name: "Yard",
        code: null,
      },
    },
  ];

  const [draftRow] = toDraftRows(savedResponseRows);

  assert.equal(draftRow.entryId, "entry-saved-draft");
  assert.equal(draftRow.stockLocationId, selectedStockLocationId);
});

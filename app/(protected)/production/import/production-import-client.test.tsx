import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProductionImportClient } from "@/app/(protected)/production/import/production-import-client";

test("legacy warning copy appears", () => {
  const html = renderToStaticMarkup(<ProductionImportClient actorProfileId="11111111-1111-4111-8111-111111111111" />);
  assert.match(html, /Use this only for cleaned legacy production data/);
  assert.match(html, /Final XLSX support\/layout is deferred/);
});

test("csv-only file input accept attribute is set", () => {
  const html = renderToStaticMarkup(<ProductionImportClient actorProfileId="11111111-1111-4111-8111-111111111111" />);
  assert.match(html, /accept="\.csv,text\/csv"/);
});

test("apply button is not shown before successful dry run", () => {
  const html = renderToStaticMarkup(<ProductionImportClient actorProfileId="11111111-1111-4111-8111-111111111111" />);
  assert.equal(html.includes("Apply import"), false);
});

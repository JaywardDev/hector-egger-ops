import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module from "node:module";
import test from "node:test";

import type { AuthSession } from "@/src/lib/auth/session";
import type { TimberStockRowInput } from "@/src/lib/stock-take/types";

const originalLoad = Module._load;

type RequestCall = {
  path: string;
  init?: RequestInit & { headers?: HeadersInit };
};

const session: AuthSession = {
  accessToken: "user-access-token",
  refreshToken: null,
  user: { id: "auth-user-1", email: "operator@example.com" },
};

const importDataWithMock = async (request: (path: string, init?: RequestInit & { headers?: HeadersInit }) => Promise<Response>) => {
  Module._load = function loadWithStockTakeDataMocks(requestPath, parent, isMain) {
    if (requestPath === "server-only") {
      return {};
    }
    if (requestPath === "@/src/lib/supabase/server") {
      return { createServerSupabaseClient: () => ({ request }) };
    }
    if (requestPath === "@/src/lib/supabase/service-role") {
      return {
        createServiceRoleSupabaseClient: () => ({
          request: () => {
            throw new Error("Stock-take updates must not use the service-role delete/upsert flow.");
          },
        }),
      };
    }
    if (requestPath === "@/src/lib/stock-take/access") {
      return {
        assertTimberStockReadAccess: async () => undefined,
        assertTimberStockWriteAccess: async () => undefined,
      };
    }
    if (requestPath === "@/src/lib/server-timing") {
      return { withServerTiming: async ({ operation }: { operation: () => Promise<unknown> }) => operation() };
    }
    if (requestPath === "@/src/lib/production/access") {
      return { createSessionHeaders: () => ({ Authorization: "Bearer user-access-token" }) };
    }
    return originalLoad.call(this, requestPath, parent, isMain);
  };

  const dataPath = require.resolve("@/src/lib/stock-take/data");
  delete require.cache[dataPath];
  return import("@/src/lib/stock-take/data");
};

const restoreModuleLoader = () => {
  Module._load = originalLoad;
  delete require.cache[require.resolve("@/src/lib/stock-take/data")];
};

const rows: TimberStockRowInput[] = [
  { timberMaterialId: "11111111-1111-1111-1111-111111111111", bay: " A1 ", level: " Top ", quantity: "3.5" },
  { timberMaterialId: "22222222-2222-2222-2222-222222222222", bay: "", level: " Lower ", quantity: 0 },
];

test("updateTimberStockRowsForArea calls the atomic replacement RPC with the flat normalized payload", async () => {
  const calls: RequestCall[] = [];
  const { updateTimberStockRowsForArea } = await importDataWithMock(async (path, init) => {
    calls.push({ path, init });
    return Response.json([
      {
        id: "row-1",
        area_id: "area-1",
        timber_material_id: "11111111-1111-1111-1111-111111111111",
        bay: "A1",
        level: "Top",
        quantity: 3.5,
        updated_by_profile_id: "profile-1",
        created_at: "2026-06-10T00:00:00.000Z",
        updated_at: "2026-06-10T00:00:00.000Z",
      },
    ]);
  });

  try {
    const result = await updateTimberStockRowsForArea({
      session,
      accessContext: { accountStatus: "approved", roles: ["operator"] },
      route: "/stock-take",
      areaId: "area-1",
      rows,
      updatedByProfileId: "profile-1",
    });

    assert.equal(result.length, 1);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].path, "/rest/v1/rpc/replace_timber_stock_rows_for_area?select=id,area_id,timber_material_id,bay,level,quantity,updated_by_profile_id,created_at,updated_at");
    assert.equal(calls[0].init?.method, "POST");
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      p_area_id: "area-1",
      p_rows: [
        { timberMaterialId: "11111111-1111-1111-1111-111111111111", bay: "A1", level: "Top", quantity: 3.5 },
        { timberMaterialId: "22222222-2222-2222-2222-222222222222", bay: "", level: "Lower", quantity: 0 },
      ],
    });
  } finally {
    restoreModuleLoader();
  }
});

test("updateTimberStockRowsForArea sends an empty rows array to the RPC so the area is cleared atomically", async () => {
  const calls: RequestCall[] = [];
  const { updateTimberStockRowsForArea } = await importDataWithMock(async (path, init) => {
    calls.push({ path, init });
    return Response.json([]);
  });

  try {
    const result = await updateTimberStockRowsForArea({
      session,
      accessContext: { accountStatus: "approved", roles: ["operator"] },
      areaId: "area-1",
      rows: [],
    });

    assert.deepEqual(result, []);
    assert.equal(calls.length, 1);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { p_area_id: "area-1", p_rows: [] });
  } finally {
    restoreModuleLoader();
  }
});

test("updateTimberStockRowsForArea reports RPC failures without doing a separate delete first", async () => {
  const calls: RequestCall[] = [];
  const { updateTimberStockRowsForArea } = await importDataWithMock(async (path, init) => {
    calls.push({ path, init });
    return new Response(JSON.stringify({ message: "insert failed" }), { status: 400 });
  });

  try {
    await assert.rejects(
      updateTimberStockRowsForArea({
        session,
        accessContext: { accountStatus: "approved", roles: ["operator"] },
        areaId: "area-1",
        rows,
      }),
      /Failed to update stock\./,
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].path.startsWith("/rest/v1/rpc/replace_timber_stock_rows_for_area"), true);
    assert.notEqual(calls[0].init?.method, "DELETE");
  } finally {
    restoreModuleLoader();
  }
});

test("stock-take atomic replacement migration deletes the selected area inside the RPC before inserting submitted rows", () => {
  const migration = readFileSync(
    "supabase/migrations/20260610120000_atomic_timber_stock_area_replacement_rpc.sql",
    "utf8",
  );

  assert.match(migration, /create or replace function public\.replace_timber_stock_rows_for_area/);
  assert.match(migration, /security definer/);
  assert.match(migration, /set search_path = public/);
  assert.match(migration, /where p\.auth_user_id = auth\.uid\(\)[\s\S]*p\.account_status = 'approved'/);
  assert.match(migration, /ur\.role in \('admin', 'supervisor', 'operator'\)/);
  assert.match(migration, /delete from public\.timber_stock_rows[\s\S]*where area_id = p_area_id;[\s\S]*insert into public\.timber_stock_rows/);
  assert.match(migration, /for v_row in select \* from jsonb_array_elements\(p_rows\)/);
  assert.match(migration, /return query[\s\S]*from public\.timber_stock_rows tsr[\s\S]*where tsr\.area_id = p_area_id/);
});

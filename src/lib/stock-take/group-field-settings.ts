import "server-only";

import type { AuthSession } from "@/src/lib/auth/session";
import { getCurrentAccountStatus, getCurrentUserRoles } from "@/src/lib/auth/profile-access";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { stockTakeFieldLibrary, type StockTakeFieldKey } from "@/src/lib/stock-take/field-config";

type ApprovedAccessContext = {
  accountStatus: "approved";
  roles: string[];
};

const assertOperationalAccess = async ({
  session,
  accessContext,
}: {
  session: AuthSession;
  accessContext?: ApprovedAccessContext;
}) => {
  const accountStatus =
    accessContext?.accountStatus ?? (await getCurrentAccountStatus(session));
  const roles = accessContext?.roles ?? (await getCurrentUserRoles(session));

  if (
    accountStatus !== "approved" ||
    (!roles.includes("admin") && !roles.includes("supervisor"))
  ) {
    throw new Error("Supervisor or admin access is required.");
  }
};

const allLibraryFieldKeys = Object.keys(stockTakeFieldLibrary) as StockTakeFieldKey[];

export const saveStockTakeFieldConfigForGroup = async ({
  session,
  accessContext,
  materialGroupId,
  enabledFieldKeys,
  requiredFieldKeys,
}: {
  session: AuthSession;
  accessContext?: ApprovedAccessContext;
  materialGroupId: string;
  enabledFieldKeys: string[];
  requiredFieldKeys: string[];
}) => {
  await assertOperationalAccess({ session, accessContext });

  const enabledSet = new Set(
    enabledFieldKeys.filter((key): key is StockTakeFieldKey => key in stockTakeFieldLibrary),
  );
  const requiredSet = new Set(
    requiredFieldKeys.filter((key): key is StockTakeFieldKey => key in stockTakeFieldLibrary),
  );

  enabledSet.add("counted_quantity");
  requiredSet.add("counted_quantity");

  for (const fieldKey of Array.from(requiredSet)) {
    if (!enabledSet.has(fieldKey)) {
      requiredSet.delete(fieldKey);
    }
  }

  const payload = allLibraryFieldKeys.map((fieldKey) => {
    const definition = stockTakeFieldLibrary[fieldKey];
    const required =
      definition.kind === "editable" && definition.supportsRequiredToggle
        ? requiredSet.has(fieldKey)
        : definition.required;

    return {
      material_group_id: materialGroupId,
      field_key: fieldKey,
      is_enabled: enabledSet.has(fieldKey),
      is_required: required,
    };
  });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    "/rest/v1/stock_take_group_field_settings?on_conflict=material_group_id,field_key",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(payload),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to save stock-take field settings");
  }
};

import "server-only";

import { getSupabaseServerEnv } from "@/src/lib/supabase/env";
import { createSupabaseClient, type SupabaseClient } from "@/src/lib/supabase/shared";

export const createServiceRoleSupabaseClient = (
  requestFn?: typeof fetch,
): SupabaseClient => {
  const { url, serviceRoleKey } = getSupabaseServerEnv();
  return createSupabaseClient(url, serviceRoleKey, requestFn);
};

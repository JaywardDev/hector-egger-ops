import "server-only";

import { getSupabasePublicEnv } from "@/src/lib/supabase/env";
import { createSupabaseClient, type SupabaseClient } from "@/src/lib/supabase/shared";

export const createServerSupabaseClient = (
  requestFn?: typeof fetch,
): SupabaseClient => {
  const { url, anonKey } = getSupabasePublicEnv();
  return createSupabaseClient(url, anonKey, requestFn);
};

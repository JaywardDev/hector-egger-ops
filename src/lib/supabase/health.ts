import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";

export const getSupabaseFoundationHealth = () => {
  const serverClient = createServerSupabaseClient();
  const serviceRoleClient = createServiceRoleSupabaseClient();

  return {
    ok: true,
    checks: {
      serverClientReady: typeof serverClient.request === "function",
      serviceRoleClientReady: typeof serviceRoleClient.request === "function",
    },
  };
};

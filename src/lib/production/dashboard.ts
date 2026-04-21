import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { withServerTiming } from "@/src/lib/server-timing";
import {
  assertProductionReadAccess,
  createSessionHeaders,
  type ProductionActor,
} from "@/src/lib/production/access";
import type {
  ProductionOperatorSummaryRecord,
  ProductionProjectSummaryRecord,
} from "@/src/lib/production/types";

export const listProductionProjectSummaries = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionProjectSummaryRecord[]> =>
  withServerTiming({
    name: "listProductionProjectSummaries",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/production_project_summaries?select=*&order=project_file.asc,project_sequence.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production project summaries");
      }

      return (await response.json()) as ProductionProjectSummaryRecord[];
    },
  });

export const listProductionOperatorSummaries = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionOperatorSummaryRecord[]> =>
  withServerTiming({
    name: "listProductionOperatorSummaries",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        "/rest/v1/production_operator_summaries?select=*&order=operator_name.asc",
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production operator summaries");
      }

      return (await response.json()) as ProductionOperatorSummaryRecord[];
    },
  });

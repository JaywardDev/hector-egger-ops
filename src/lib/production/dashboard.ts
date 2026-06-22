import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { withServerTiming } from "@/src/lib/server-timing";
import { assertProductionReadAccess, createSessionHeaders, type ProductionActor } from "@/src/lib/production/access";
import type { ProductionOperatorSummaryRecord, ProductionProjectFileSummaryRecord, ProductionProjectSummaryRecord } from "@/src/lib/production/types";

export const listProductionProjectSummaries = async ({ session, accessContext, route }: ProductionActor): Promise<ProductionProjectSummaryRecord[]> =>
  withServerTiming({ name: "listProductionProjectSummaries", route, operation: async () => { await assertProductionReadAccess({ session, accessContext, route }); const response = await createServerSupabaseClient().request("/rest/v1/production_project_summaries?select=*&order=is_archived.asc,project_file.asc,project_sequence.asc", { cache: "no-store", headers: createSessionHeaders(session) }); if (!response.ok) throw new Error("Failed to load production project summaries"); return (await response.json()) as ProductionProjectSummaryRecord[]; } });

export const listProductionOperatorSummaries = async ({ session, accessContext, route }: ProductionActor): Promise<ProductionOperatorSummaryRecord[]> =>
  withServerTiming({ name: "listProductionOperatorSummaries", route, operation: async () => { await assertProductionReadAccess({ session, accessContext, route }); const response = await createServerSupabaseClient().request("/rest/v1/production_operator_summaries?select=*&order=operator_name.asc", { cache: "no-store", headers: createSessionHeaders(session) }); if (!response.ok) throw new Error("Failed to load production operator summaries"); return (await response.json()) as ProductionOperatorSummaryRecord[]; } });


export const listProductionProjectFileSummaries = async ({ session, accessContext, route }: ProductionActor): Promise<ProductionProjectFileSummaryRecord[]> =>
  withServerTiming({ name: "listProductionProjectFileSummaries", route, operation: async () => { await assertProductionReadAccess({ session, accessContext, route }); const response = await createServerSupabaseClient().request("/rest/v1/production_project_file_summaries?select=*&order=is_archived.asc,project_file.asc,project_sequence.asc", { cache: "no-store", headers: createSessionHeaders(session) }); if (!response.ok) throw new Error("Failed to load production project-file summaries"); return (await response.json()) as ProductionProjectFileSummaryRecord[]; } });

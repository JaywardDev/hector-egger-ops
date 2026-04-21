import "server-only";

import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/src/lib/supabase/service-role";
import { withServerTiming } from "@/src/lib/server-timing";
import {
  assertProductionProjectWriteAccess,
  assertProductionReadAccess,
  createSessionHeaders,
  type ProductionActor,
} from "@/src/lib/production/access";
import type {
  ProductionProjectRecord,
  ProductionProjectStatus,
  ProductionProjectSummaryRecord,
} from "@/src/lib/production/types";

type ProductionProjectInput = {
  projectFile: string;
  projectName: string;
  projectSequence: number;
  totalOperationalMinutes: number | null;
  estimatedTotalVolumeM3: number | null;
  notes: string | null;
  status?: ProductionProjectStatus;
};

const normalizeProjectKeyText = (value: string) => value.trim();

const projectSelect =
  "id,project_file,project_name,project_sequence,total_operational_minutes,estimated_total_volume_m3,status,notes,created_at,updated_at";

export const listProductionProjects = async ({
  session,
  accessContext,
  route,
}: ProductionActor): Promise<ProductionProjectRecord[]> =>
  withServerTiming({
    name: "listProductionProjects",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/production_projects?select=${projectSelect}&order=project_file.asc,project_sequence.asc`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production projects");
      }

      return (await response.json()) as ProductionProjectRecord[];
    },
  });

export const createProductionProject = async ({
  session,
  accessContext,
  input,
}: ProductionActor & {
  input: ProductionProjectInput;
}): Promise<ProductionProjectRecord> => {
  await assertProductionProjectWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/production_projects?select=${projectSelect}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        project_file: input.projectFile,
        project_name: input.projectName,
        project_sequence: input.projectSequence,
        total_operational_minutes: input.totalOperationalMinutes,
        estimated_total_volume_m3: input.estimatedTotalVolumeM3,
        status: input.status ?? "active",
        notes: input.notes,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create production project");
  }

  const [record] = (await response.json()) as ProductionProjectRecord[];
  return record;
};

export const updateProductionProject = async ({
  session,
  accessContext,
  projectId,
  input,
}: ProductionActor & {
  projectId: string;
  input: Partial<ProductionProjectInput>;
}): Promise<ProductionProjectRecord> => {
  await assertProductionProjectWriteAccess({ session, accessContext });

  const supabase = createServiceRoleSupabaseClient();
  const response = await supabase.request(
    `/rest/v1/production_projects?id=eq.${projectId}&select=${projectSelect}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        project_file: input.projectFile,
        project_name: input.projectName,
        project_sequence: input.projectSequence,
        total_operational_minutes: input.totalOperationalMinutes,
        estimated_total_volume_m3: input.estimatedTotalVolumeM3,
        status: input.status,
        notes: input.notes,
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update production project");
  }

  const [record] = (await response.json()) as ProductionProjectRecord[];
  if (!record) {
    throw new Error("Production project not found");
  }

  return record;
};

export const archiveProductionProject = async ({
  session,
  accessContext,
  projectId,
}: ProductionActor & {
  projectId: string;
}): Promise<ProductionProjectRecord> =>
  updateProductionProject({
    session,
    accessContext,
    projectId,
    input: {
      status: "archived",
    },
  });

export const getProductionProjectDetail = async ({
  session,
  accessContext,
  route,
  projectId,
}: ProductionActor & {
  projectId: string;
}): Promise<ProductionProjectSummaryRecord | null> =>
  withServerTiming({
    name: "getProductionProjectDetail",
    route,
    meta: { projectId },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/production_project_summaries?project_id=eq.${projectId}&select=*&limit=1`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to load production project summary");
      }

      const [record] = (await response.json()) as ProductionProjectSummaryRecord[];
      return record ?? null;
    },
  });

export const findProductionProjectByFileAndSequence = async ({
  session,
  accessContext,
  route,
  projectFile,
  projectSequence,
}: ProductionActor & {
  projectFile: string;
  projectSequence: number;
}): Promise<ProductionProjectRecord | null> =>
  withServerTiming({
    name: "findProductionProjectByFileAndSequence",
    route,
    meta: { projectFile, projectSequence },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });

      const supabase = createServerSupabaseClient();
      const response = await supabase.request(
        `/rest/v1/production_projects?select=${projectSelect}&project_file=eq.${encodeURIComponent(
          normalizeProjectKeyText(projectFile),
        )}&project_sequence=eq.${projectSequence}&limit=1`,
        {
          cache: "no-store",
          headers: createSessionHeaders(session),
        },
      );

      if (!response.ok) {
        throw new Error("Failed to find production project");
      }

      const [record] = (await response.json()) as ProductionProjectRecord[];
      return record ?? null;
    },
  });

export const upsertProductionProjectByFileAndSequence = async ({
  session,
  accessContext,
  input,
}: ProductionActor & {
  input: ProductionProjectInput;
}): Promise<{ record: ProductionProjectRecord; mode: "created" | "updated" }> => {
  await assertProductionProjectWriteAccess({ session, accessContext });

  const normalizedProjectFile = input.projectFile.trim();
  const existing = await findProductionProjectByFileAndSequence({
    session,
    accessContext,
    route: "/production/import",
    projectFile: normalizedProjectFile,
    projectSequence: input.projectSequence,
  });

  if (!existing) {
    const record = await createProductionProject({
      session,
      accessContext,
      input: {
        ...input,
        projectFile: normalizedProjectFile,
      },
    });
    return { record, mode: "created" };
  }

  const record = await updateProductionProject({
    session,
    accessContext,
    projectId: existing.id,
    input: {
      projectName: input.projectName,
      totalOperationalMinutes: input.totalOperationalMinutes,
      estimatedTotalVolumeM3: input.estimatedTotalVolumeM3,
    },
  });

  return { record, mode: "updated" };
};

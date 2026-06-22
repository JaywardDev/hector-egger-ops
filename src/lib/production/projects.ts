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
  ProductionProjectFileRecord,
  ProductionProjectFileSummaryRecord,
  ProductionProjectRecord,
  ProductionProjectSummaryRecord,
} from "@/src/lib/production/types";

type ProductionProjectInput = {
  projectFile: string;
  projectName: string;
  projectSequence: number;
  totalTimeMinutes: number | null;
  totalVolumeM3: number | null;
  isArchived?: boolean;
};

type ProductionProjectFileInput = {
  projectFile: string;
  projectSequence: number | null;
  totalTimeMinutes: number | null;
  totalVolumeM3: number | null;
  isArchived?: boolean;
};

const normalizeProjectKeyText = (value: string) => value.trim();

const projectSelect =
  "id,project_sequence,project_name,project_file,total_time_minutes,total_volume_m3,is_archived,created_at,updated_at";
const projectFileBaseSelect = "id,project_id,project_file,project_sequence,total_time_minutes,total_volume_m3,is_archived,created_at,updated_at";
const projectFileSelect = `${projectFileBaseSelect},production_projects(project_name)`;

export const listProductionProjects = async ({ session, accessContext, route }: ProductionActor): Promise<ProductionProjectRecord[]> =>
  withServerTiming({
    name: "listProductionProjects",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const response = await createServerSupabaseClient().request(
        `/rest/v1/production_projects?select=${projectSelect}&order=is_archived.asc,project_name.asc,created_at.asc`,
        { cache: "no-store", headers: createSessionHeaders(session) },
      );
      if (!response.ok) throw new Error("Failed to load production projects");
      return (await response.json()) as ProductionProjectRecord[];
    },
  });

type ProductionProjectFileApiRecord = Omit<ProductionProjectFileRecord, "project_name"> & { production_projects?: { project_name?: string } | null };

const normalizeProjectFileRecord = (record: ProductionProjectFileApiRecord): ProductionProjectFileRecord => {
  const { production_projects: project, ...projectFile } = record;
  return { ...projectFile, project_name: project?.project_name ?? "" };
};

export const listProductionProjectFiles = async ({ session, accessContext, route, projectId }: ProductionActor & { projectId?: string }): Promise<ProductionProjectFileRecord[]> =>
  withServerTiming({
    name: "listProductionProjectFiles",
    route,
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const params = new URLSearchParams({ select: projectFileSelect, order: "is_archived.asc,project_file.asc,project_sequence.asc" });
      if (projectId) params.set("project_id", `eq.${projectId}`);
      const response = await createServerSupabaseClient().request(`/rest/v1/production_project_files?${params.toString()}`, {
        cache: "no-store",
        headers: createSessionHeaders(session),
      });
      if (!response.ok) throw new Error("Failed to load production project files");
      return ((await response.json()) as ProductionProjectFileApiRecord[]).map(normalizeProjectFileRecord);
    },
  });

export const listProductionProjectFileSummaries = async ({ session, accessContext, route, projectId }: ProductionActor & { projectId: string }): Promise<ProductionProjectFileSummaryRecord[]> =>
  withServerTiming({
    name: "listProductionProjectFileSummaries",
    route,
    meta: { projectId },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const params = new URLSearchParams({
        project_id: `eq.${projectId}`,
        select: "*",
        order: "is_archived.asc,project_file.asc,project_sequence.asc",
      });
      const response = await createServerSupabaseClient().request(`/rest/v1/production_project_file_summaries?${params.toString()}`, {
        cache: "no-store",
        headers: createSessionHeaders(session),
      });
      if (!response.ok) throw new Error("Failed to load production project file summaries");
      return (await response.json()) as ProductionProjectFileSummaryRecord[];
    },
  });

export const createProductionProjectFile = async ({ session, accessContext, projectId, input }: ProductionActor & { projectId: string; input: ProductionProjectFileInput }): Promise<ProductionProjectFileRecord> => {
  await assertProductionProjectWriteAccess({ session, accessContext });
  const response = await createServiceRoleSupabaseClient().request(`/rest/v1/production_project_files?select=${projectFileBaseSelect}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      project_id: projectId,
      project_file: input.projectFile,
      project_sequence: input.projectSequence,
      total_time_minutes: input.totalTimeMinutes,
      total_volume_m3: input.totalVolumeM3,
      is_archived: input.isArchived ?? false,
    }),
  });
  if (!response.ok) throw new Error("Failed to create production project file");
  const [record] = (await response.json()) as ProductionProjectFileRecord[];
  return { ...record, project_name: "" };
};

export const updateProductionProjectFile = async ({ session, accessContext, projectFileId, input }: ProductionActor & { projectFileId: string; input: Partial<ProductionProjectFileInput> }): Promise<ProductionProjectFileRecord> => {
  await assertProductionProjectWriteAccess({ session, accessContext });
  const response = await createServiceRoleSupabaseClient().request(`/rest/v1/production_project_files?id=eq.${projectFileId}&select=${projectFileBaseSelect}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({
      project_file: input.projectFile,
      project_sequence: input.projectSequence,
      total_time_minutes: input.totalTimeMinutes,
      total_volume_m3: input.totalVolumeM3,
      is_archived: input.isArchived,
    }),
  });
  if (!response.ok) throw new Error("Failed to update production project file");
  const [record] = (await response.json()) as ProductionProjectFileRecord[];
  if (!record) throw new Error("Production project file not found");
  return { ...record, project_name: "" };
};

export const createProductionProject = async ({ session, accessContext, input }: ProductionActor & { input: ProductionProjectInput }): Promise<ProductionProjectRecord> => {
  await assertProductionProjectWriteAccess({ session, accessContext });
  const response = await createServerSupabaseClient().request("/rest/v1/rpc/create_production_project_with_file", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...createSessionHeaders(session) },
    body: JSON.stringify({
      p_project_sequence: input.projectSequence,
      p_project_name: input.projectName,
      p_project_file: input.projectFile,
      p_total_time_minutes: input.totalTimeMinutes,
      p_total_volume_m3: input.totalVolumeM3,
      p_is_archived: input.isArchived ?? false,
    }),
  });
  if (!response.ok) throw new Error("Failed to create production project");
  return (await response.json()) as ProductionProjectRecord;
};

export const updateProductionProject = async ({ session, accessContext, projectId, input }: ProductionActor & { projectId: string; input: Partial<ProductionProjectInput> }): Promise<ProductionProjectRecord> => {
  await assertProductionProjectWriteAccess({ session, accessContext });
  const response = await createServiceRoleSupabaseClient().request(`/rest/v1/production_projects?id=eq.${projectId}&select=${projectSelect}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify({ project_name: input.projectName, is_archived: input.isArchived }),
  });
  if (!response.ok) throw new Error("Failed to update production project");
  const [record] = (await response.json()) as ProductionProjectRecord[];
  if (!record) throw new Error("Production project not found");
  return record;
};

export const archiveProductionProject = async ({ session, accessContext, projectId }: ProductionActor & { projectId: string }): Promise<ProductionProjectRecord> =>
  updateProductionProject({ session, accessContext, projectId, input: { isArchived: true } });

export const getProductionProjectDetail = async ({ session, accessContext, route, projectId }: ProductionActor & { projectId: string }): Promise<ProductionProjectSummaryRecord | null> =>
  withServerTiming({
    name: "getProductionProjectDetail",
    route,
    meta: { projectId },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const response = await createServerSupabaseClient().request(`/rest/v1/production_project_summaries?project_id=eq.${projectId}&select=*&limit=1`, {
        cache: "no-store",
        headers: createSessionHeaders(session),
      });
      if (!response.ok) throw new Error("Failed to load production project summary");
      const [record] = (await response.json()) as ProductionProjectSummaryRecord[];
      return record ?? null;
    },
  });

export const findProductionProjectByFileAndSequence = async ({ session, accessContext, route, projectFile, projectSequence }: ProductionActor & { projectFile: string; projectSequence: number }): Promise<ProductionProjectRecord | null> =>
  withServerTiming({
    name: "findProductionProjectByFileAndSequence",
    route,
    meta: { projectFile, projectSequence },
    operation: async () => {
      await assertProductionReadAccess({ session, accessContext, route });
      const response = await createServerSupabaseClient().request(
        `/rest/v1/production_projects?select=${projectSelect}&project_file=eq.${encodeURIComponent(normalizeProjectKeyText(projectFile))}&project_sequence=eq.${projectSequence}&limit=1`,
        { cache: "no-store", headers: createSessionHeaders(session) },
      );
      if (!response.ok) throw new Error("Failed to find production project");
      const [record] = (await response.json()) as ProductionProjectRecord[];
      return record ?? null;
    },
  });

export const upsertProductionProjectByFileAndSequence = async ({ session, accessContext, input }: ProductionActor & { input: ProductionProjectInput }): Promise<{ record: ProductionProjectRecord; mode: "created" | "updated" }> => {
  await assertProductionProjectWriteAccess({ session, accessContext });
  const normalizedProjectFile = input.projectFile.trim();
  const existing = await findProductionProjectByFileAndSequence({ session, accessContext, route: "/production/projects", projectFile: normalizedProjectFile, projectSequence: input.projectSequence });
  if (!existing) {
    const record = await createProductionProject({ session, accessContext, input: { ...input, projectFile: normalizedProjectFile } });
    return { record, mode: "created" };
  }
  const record = await updateProductionProject({ session, accessContext, projectId: existing.id, input: { projectName: input.projectName, isArchived: input.isArchived } });
  return { record, mode: "updated" };
};

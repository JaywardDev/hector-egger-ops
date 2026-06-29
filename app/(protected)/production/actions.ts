"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOperationalWriteAccess, requireProtectedAccess } from "@/src/lib/auth/guards";
import { formatRoleDisjunction } from "@/src/lib/auth/role-labels";
import { parseNzDate } from "@/src/lib/dateTime";
import { archiveProductionProject, createProductionProject, createProductionProjectFile, getProductionProjectDetail, listProductionProjects, updateProductionProject, updateProductionProjectFile } from "@/src/lib/production/projects";
import { createProductionEntry, deleteProductionEntry, getProductionEntryDetail, listProductionEntries, updateProductionEntry } from "@/src/lib/production/entries";
import { createProductionDowntimeReason, createProductionInterruptionReason, listProductionDowntimeReasons, listProductionInterruptionReasons, updateProductionDowntimeReason, updateProductionInterruptionReason } from "@/src/lib/production/reasons";
import { hasProductionReasonAdminRole } from "@/src/lib/production/access";
import type { ProductionEntryReasonLine } from "@/src/lib/production/types";

const toMessage = (path: string, message: string, type: "success" | "error" = "success") => redirect(`${path}?${type}=${encodeURIComponent(message)}`);
const normalizeText = (value: FormDataEntryValue | null) => { const normalized = String(value ?? "").trim(); return normalized.length ? normalized : null; };
const normalizeNumber = (value: FormDataEntryValue | null) => { const text = normalizeText(value); if (!text) return null; const parsed = Number(text); return Number.isFinite(parsed) ? parsed : Number.NaN; };
const normalizeRequiredNumber = (value: FormDataEntryValue | null) => { const parsed = Number(String(value ?? "").trim()); return Number.isFinite(parsed) ? parsed : Number.NaN; };
const normalizeUuid = (value: FormDataEntryValue | null) => { const normalized = normalizeText(value); return normalized && /^[0-9a-f-]{36}$/i.test(normalized) ? normalized : null; };
const hasSupervisorOrAdminRole = (roles: string[]) => roles.includes("admin") || roles.includes("supervisor");
const hasReasonAdminRole = hasProductionReasonAdminRole;
const assertFiniteNonNegative = (value: number, label: string) => { if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a valid non-negative number.`); };
const assertTimeWindow = (start: string, end: string) => { if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) throw new Error("Start Time and Finish Time are required."); if (end <= start) throw new Error("Finish Time must be after Start Time."); };
const resolveOperatorProfileIdForWrite = ({ requestedOperatorProfileId, currentProfileId, roles }: { requestedOperatorProfileId: string; currentProfileId: string; roles: string[] }) => hasSupervisorOrAdminRole(roles) ? requestedOperatorProfileId : currentProfileId;

const parseReasonRows = (formData: FormData, prefix: "downtime" | "interruption"): ProductionEntryReasonLine[] => {
  const reasonIds = formData.getAll(`${prefix}_reason_id`).map((v) => String(v).trim());
  const durations = formData.getAll(`${prefix}_duration_minutes`).map((v) => String(v).trim());
  return reasonIds.map((reasonId, index) => {
    const durationMinutes = Number(durations[index] ?? "");
    if (!reasonId || !Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error(`${prefix === "downtime" ? "Downtime" : "Interruption"} reason and positive duration are required for each row.`);
    return { reasonId, durationMinutes, sortOrder: index };
  });
};

export async function listProductionProjectsAction() { const { session, roles } = await requireProtectedAccess(); return listProductionProjects({ session, accessContext: { accountStatus: "approved", roles }, route: "/production/projects" }); }
export async function getProductionProjectDetailAction(projectId: string) { const { session, roles } = await requireProtectedAccess(); return getProductionProjectDetail({ session, accessContext: { accountStatus: "approved", roles }, route: "/production/projects", projectId }); }

export async function createProductionProjectAction(input: { projectFile: string; projectName: string; projectSequence: number; totalTimeMinutes: number | null; totalVolumeM3: number | null; isArchived?: boolean }) {
  const { session, roles } = await requireOperationalWriteAccess();
  const record = await createProductionProject({ session, accessContext: { accountStatus: "approved", roles }, input });
  revalidatePath("/production"); revalidatePath("/production/projects"); return record;
}
export async function createProductionProjectFormAction(formData: FormData) {
  const projectFile = String(formData.get("project_file") ?? "").trim(); const projectName = String(formData.get("project_name") ?? "").trim(); const projectSequence = normalizeRequiredNumber(formData.get("project_sequence"));
  const totalTimeMinutes = normalizeNumber(formData.get("total_time_minutes")); const totalVolumeM3 = normalizeNumber(formData.get("total_volume_m3"));
  if (!projectFile || !projectName || !Number.isFinite(projectSequence)) toMessage("/production/projects/new", "Project File, Project Name, and Project Sequence are required.", "error");
  let createdProjectId: string | null = null;
  // redirect() signals via a thrown NEXT_REDIRECT; keep it out of the try so the
  // success redirect is never caught and surfaced as an error.
  try { [projectSequence, totalTimeMinutes, totalVolumeM3].forEach((v, i) => v !== null && assertFiniteNonNegative(v, ["Project Sequence", "Total Time", "Total Volume"][i])); const created = await createProductionProjectAction({ projectFile, projectName, projectSequence, totalTimeMinutes, totalVolumeM3 }); createdProjectId = created.id; } catch (error) { toMessage("/production/projects/new", error instanceof Error ? error.message : "Could not create project.", "error"); }
  if (createdProjectId) redirect(`/production/projects/${createdProjectId}?success=${encodeURIComponent("Project created.")}`);
}
export async function updateProductionProjectAction(projectId: string, input: { projectFile?: string; projectName?: string; projectSequence?: number; totalTimeMinutes?: number | null; totalVolumeM3?: number | null; isArchived?: boolean }) {
  const { session, roles } = await requireOperationalWriteAccess(); const record = await updateProductionProject({ session, accessContext: { accountStatus: "approved", roles }, projectId, input });
  revalidatePath("/production"); revalidatePath("/production/projects"); revalidatePath(`/production/projects/${projectId}`); return record;
}
export async function updateProductionProjectFormAction(formData: FormData) {
  const projectId = normalizeUuid(formData.get("project_id")); if (!projectId) return toMessage("/production/projects", "Project id is required.", "error");
  try { await updateProductionProjectAction(projectId, { projectFile: String(formData.get("project_file") ?? "").trim() || undefined, projectName: String(formData.get("project_name") ?? "").trim() || undefined, projectSequence: normalizeNumber(formData.get("project_sequence")) ?? undefined, totalTimeMinutes: normalizeNumber(formData.get("total_time_minutes")), totalVolumeM3: normalizeNumber(formData.get("total_volume_m3")), isArchived: formData.get("is_archived") === "true" }); } catch (error) { toMessage(`/production/projects/${projectId}`, error instanceof Error ? error.message : "Could not update project.", "error"); }
  toMessage(`/production/projects/${projectId}`, "Project updated.");
}

export async function createProductionProjectFileFormAction(formData: FormData) {
  const projectId = normalizeUuid(formData.get("project_id"));
  if (!projectId) return toMessage("/production/projects", "Project id is required.", "error");
  const projectFile = String(formData.get("project_file") ?? "").trim();
  const projectSequence = normalizeNumber(formData.get("project_sequence"));
  const totalTimeMinutes = normalizeNumber(formData.get("total_time_minutes"));
  const totalVolumeM3 = normalizeNumber(formData.get("total_volume_m3"));
  if (!projectFile) toMessage(`/production/projects/${projectId}`, "Project File is required.", "error");
  try {
    [projectSequence, totalTimeMinutes, totalVolumeM3].forEach((v, i) => v !== null && assertFiniteNonNegative(v, ["Project Sequence", "Total Time", "Total Volume"][i]));
    const { session, roles } = await requireOperationalWriteAccess();
    await createProductionProjectFile({ session, accessContext: { accountStatus: "approved", roles }, projectId, input: { projectFile, projectSequence, totalTimeMinutes, totalVolumeM3 } });
    revalidatePath("/production"); revalidatePath("/production/projects"); revalidatePath(`/production/projects/${projectId}`);
  } catch (error) { toMessage(`/production/projects/${projectId}`, error instanceof Error ? error.message : "Could not create project file.", "error"); }
  toMessage(`/production/projects/${projectId}`, "Project file created.");
}

export async function updateProductionProjectFileFormAction(formData: FormData) {
  const projectId = normalizeUuid(formData.get("project_id")); const projectFileId = normalizeUuid(formData.get("project_file_id"));
  if (!projectId || !projectFileId) return toMessage("/production/projects", "Project and file ids are required.", "error");
  try {
    const { session, roles } = await requireOperationalWriteAccess();
    await updateProductionProjectFile({ session, accessContext: { accountStatus: "approved", roles }, projectFileId, input: { projectFile: String(formData.get("project_file") ?? "").trim() || undefined, projectSequence: normalizeNumber(formData.get("project_sequence")), totalTimeMinutes: normalizeNumber(formData.get("total_time_minutes")), totalVolumeM3: normalizeNumber(formData.get("total_volume_m3")), isArchived: formData.get("is_archived") === "true" } });
    revalidatePath("/production"); revalidatePath("/production/projects"); revalidatePath(`/production/projects/${projectId}`);
  } catch (error) { toMessage(`/production/projects/${projectId}`, error instanceof Error ? error.message : "Could not update project file.", "error"); }
  toMessage(`/production/projects/${projectId}`, "Project file updated.");
}

export async function archiveProductionProjectAction(projectId: string) { const { session, roles } = await requireOperationalWriteAccess(); const record = await archiveProductionProject({ session, accessContext: { accountStatus: "approved", roles }, projectId }); revalidatePath("/production"); revalidatePath("/production/projects"); return record; }

export async function listProductionEntriesAction(filters?: { projectId?: string; operatorProfileId?: string; dateFrom?: string; dateTo?: string; limit?: number }) { const { session, roles } = await requireProtectedAccess(); return listProductionEntries({ session, accessContext: { accountStatus: "approved", roles }, route: "/production/entries", ...filters }); }
export async function createProductionEntryAction(input: { entryDate: string; operatorProfileId: string; startTime: string; finishTime: string; projectFileId: string; timeRemainingStartMinutes: number; timeRemainingEndMinutes: number; actualVolumeCutM3: number; runThroughBreak: boolean; downtimeReasons: ProductionEntryReasonLine[]; interruptionReasons: ProductionEntryReasonLine[] }) {
  const { session, roles, profile } = await requireProtectedAccess(); if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) throw new Error(`${formatRoleDisjunction(["operator", "supervisor", "admin"])} access is required for entry writes`); if (!profile) throw new Error("Profile record is required for production entry writes");
  const entryDate = parseNzDate(input.entryDate); if (!entryDate) throw new Error("Enter a valid Date in YYYY-MM-DD format."); assertTimeWindow(input.startTime, input.finishTime); assertFiniteNonNegative(input.timeRemainingStartMinutes, "Time Remaining Start"); assertFiniteNonNegative(input.timeRemainingEndMinutes, "Time Remaining End"); assertFiniteNonNegative(input.actualVolumeCutM3, "Actual Volume Cut");
  const record = await createProductionEntry({ session, accessContext: { accountStatus: "approved", roles }, input: { ...input, entryDate, operatorProfileId: resolveOperatorProfileIdForWrite({ requestedOperatorProfileId: input.operatorProfileId, currentProfileId: profile.id, roles }), createdByProfileId: profile.id } });
  revalidatePath("/production"); revalidatePath("/production/entries"); revalidatePath("/dashboard"); return record;
}
export async function createProductionEntryFormAction(formData: FormData) {
  let createdEntryId: string | null = null;
  // redirect() signals via a thrown NEXT_REDIRECT; keep it out of the try so the
  // success redirect is never caught and surfaced as an error.
  try { const entryDate = String(formData.get("entry_date") ?? "").trim(); const operatorProfileId = String(formData.get("operator_profile_id") ?? "").trim(); const startTime = String(formData.get("start_time") ?? "").trim(); const finishTime = String(formData.get("finish_time") ?? "").trim(); const projectFileId = String(formData.get("project_file_id") ?? "").trim(); if (!entryDate || !operatorProfileId || !startTime || !finishTime || !projectFileId) throw new Error("Date, Operator, Start Time, Finish Time, and Project File are required."); const created = await createProductionEntryAction({ entryDate, operatorProfileId, startTime, finishTime, projectFileId, timeRemainingStartMinutes: normalizeRequiredNumber(formData.get("time_remaining_start_minutes")), timeRemainingEndMinutes: normalizeRequiredNumber(formData.get("time_remaining_end_minutes")), actualVolumeCutM3: normalizeRequiredNumber(formData.get("actual_volume_cut_m3")), runThroughBreak: formData.get("run_through_break") === "on", downtimeReasons: parseReasonRows(formData, "downtime"), interruptionReasons: parseReasonRows(formData, "interruption") }); createdEntryId = created.id; } catch (error) { toMessage("/production/entries/new", error instanceof Error ? error.message : "Could not create entry.", "error"); }
  if (createdEntryId) redirect(`/production/entries/${createdEntryId}?success=${encodeURIComponent("Entry created.")}`);
}
export async function updateProductionEntryAction(entryId: string, input: { entryDate?: string; operatorProfileId?: string; startTime?: string; finishTime?: string; projectFileId?: string; timeRemainingStartMinutes?: number; timeRemainingEndMinutes?: number; actualVolumeCutM3?: number; runThroughBreak?: boolean; downtimeReasons?: ProductionEntryReasonLine[]; interruptionReasons?: ProductionEntryReasonLine[] }) {
  const { session, roles, profile } = await requireProtectedAccess("/production/entries"); if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) throw new Error(`${formatRoleDisjunction(["operator", "supervisor", "admin"])} access is required for entry writes`);
  const existingEntry = await getProductionEntryDetail({ session, accessContext: { accountStatus: "approved", roles }, route: "/production/entries", entryId }); if (!existingEntry) throw new Error("Production entry not found"); if (!hasSupervisorOrAdminRole(roles) && existingEntry.operator_profile_id !== profile?.id) throw new Error("You can only update your own production entries");
  const entryDate = input.entryDate === undefined ? existingEntry.entry_date : (parseNzDate(input.entryDate) ?? undefined); if (input.entryDate !== undefined && !entryDate) throw new Error("Enter a valid Date in YYYY-MM-DD format."); const startTime = input.startTime ?? existingEntry.start_time; const finishTime = input.finishTime ?? existingEntry.finish_time; assertTimeWindow(startTime, finishTime);
  const timeRemainingStartMinutes = input.timeRemainingStartMinutes ?? existingEntry.time_remaining_start_minutes; const timeRemainingEndMinutes = input.timeRemainingEndMinutes ?? existingEntry.time_remaining_end_minutes; const actualVolumeCutM3 = input.actualVolumeCutM3 ?? Number(existingEntry.actual_volume_cut_m3); assertFiniteNonNegative(timeRemainingStartMinutes, "Time Remaining Start"); assertFiniteNonNegative(timeRemainingEndMinutes, "Time Remaining End"); assertFiniteNonNegative(actualVolumeCutM3, "Actual Volume Cut");
  const record = await updateProductionEntry({ session, accessContext: { accountStatus: "approved", roles }, entryId, input: { ...input, entryDate, startTime, finishTime, timeRemainingStartMinutes, timeRemainingEndMinutes, actualVolumeCutM3, projectFileId: input.projectFileId ?? existingEntry.project_file_id, runThroughBreak: input.runThroughBreak ?? existingEntry.run_through_break, downtimeReasons: input.downtimeReasons ?? existingEntry.downtime_reasons.map((row) => ({ reasonId: row.reason_id, durationMinutes: row.duration_minutes, sortOrder: row.sort_order })), interruptionReasons: input.interruptionReasons ?? existingEntry.interruption_reasons.map((row) => ({ reasonId: row.reason_id, durationMinutes: row.duration_minutes, sortOrder: row.sort_order })), operatorProfileId: resolveOperatorProfileIdForWrite({ requestedOperatorProfileId: input.operatorProfileId ?? existingEntry.operator_profile_id, currentProfileId: profile?.id ?? existingEntry.operator_profile_id, roles }), createdByProfileId: existingEntry.created_by_profile_id } });
  revalidatePath("/production"); revalidatePath("/production/entries"); revalidatePath(`/production/entries/${entryId}`); revalidatePath("/dashboard"); return record;
}
export async function updateProductionEntryFormAction(formData: FormData) { const entryId = normalizeUuid(formData.get("entry_id")); if (!entryId) return toMessage("/production/entries", "Entry id is required.", "error"); try { await updateProductionEntryAction(entryId, { entryDate: String(formData.get("entry_date") ?? "").trim() || undefined, operatorProfileId: String(formData.get("operator_profile_id") ?? "").trim() || undefined, startTime: String(formData.get("start_time") ?? "").trim() || undefined, finishTime: String(formData.get("finish_time") ?? "").trim() || undefined, projectFileId: String(formData.get("project_file_id") ?? "").trim() || undefined, timeRemainingStartMinutes: normalizeRequiredNumber(formData.get("time_remaining_start_minutes")), timeRemainingEndMinutes: normalizeRequiredNumber(formData.get("time_remaining_end_minutes")), actualVolumeCutM3: normalizeRequiredNumber(formData.get("actual_volume_cut_m3")), runThroughBreak: formData.get("run_through_break") === "on", downtimeReasons: parseReasonRows(formData, "downtime"), interruptionReasons: parseReasonRows(formData, "interruption") }); } catch (error) { toMessage(`/production/entries/${entryId}`, error instanceof Error ? error.message : "Could not update entry.", "error"); } toMessage(`/production/entries/${entryId}`, "Entry updated."); }
export async function deleteProductionEntryAction(entryId: string) { const { session, roles, profile } = await requireProtectedAccess("/production/entries"); const existingEntry = await getProductionEntryDetail({ session, accessContext: { accountStatus: "approved", roles }, route: "/production/entries", entryId }); if (!existingEntry) throw new Error("Production entry not found"); if (!hasSupervisorOrAdminRole(roles) && existingEntry.operator_profile_id !== profile?.id) throw new Error("You can only delete your own production entries"); await deleteProductionEntry({ session, accessContext: { accountStatus: "approved", roles }, entryId }); revalidatePath("/production"); revalidatePath("/production/entries"); revalidatePath("/dashboard"); redirect(`/production/entries?success=${encodeURIComponent("Entry deleted.")}`); }

export async function listProductionDowntimeReasonsAction() { const { session, roles } = await requireProtectedAccess(); return listProductionDowntimeReasons({ session, accessContext: { accountStatus: "approved", roles }, route: "/production" }); }
export async function listProductionInterruptionReasonsAction() { const { session, roles } = await requireProtectedAccess(); return listProductionInterruptionReasons({ session, accessContext: { accountStatus: "approved", roles }, route: "/production" }); }
export async function createProductionReasonFormAction(formData: FormData) { const { session, roles } = await requireProtectedAccess("/production/reasons"); if (!hasReasonAdminRole(roles)) throw new Error("Admin access is required for production reason management"); const kind = String(formData.get("kind") ?? ""); const label = String(formData.get("label") ?? "").trim(); const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""); if (!label || !code) toMessage("/production/reasons", "Reason label is required.", "error"); const input = { code, label, sortOrder: 999, isActive: true }; if (kind === "downtime") await createProductionDowntimeReason({ session, accessContext: { accountStatus: "approved", roles }, input }); else await createProductionInterruptionReason({ session, accessContext: { accountStatus: "approved", roles }, input }); revalidatePath("/production/reasons"); toMessage("/production/reasons", "Reason added."); }
export async function updateProductionReasonFormAction(formData: FormData) { const { session, roles } = await requireProtectedAccess("/production/reasons"); if (!hasReasonAdminRole(roles)) throw new Error("Admin access is required for production reason management"); const kind = String(formData.get("kind") ?? ""); const reasonId = normalizeUuid(formData.get("reason_id")); if (!reasonId) toMessage("/production/reasons", "Reason id is required.", "error"); const input = { isActive: formData.get("is_active") === "true" }; if (kind === "downtime") await updateProductionDowntimeReason({ session, accessContext: { accountStatus: "approved", roles }, reasonId: reasonId!, input }); else await updateProductionInterruptionReason({ session, accessContext: { accountStatus: "approved", roles }, reasonId: reasonId!, input }); revalidatePath("/production/reasons"); toMessage("/production/reasons", "Reason updated."); }

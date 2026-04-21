"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  requireOperationalWriteAccess,
  requireProtectedAccess,
} from "@/src/lib/auth/guards";
import {
  archiveProductionProject,
  createProductionProject,
  getProductionProjectDetail,
  listProductionProjects,
  updateProductionProject,
} from "@/src/lib/production/projects";
import {
  createProductionEntry,
  deleteProductionEntry,
  getProductionEntryDetail,
  listProductionEntries,
  updateProductionEntry,
} from "@/src/lib/production/entries";
import {
  listProductionDowntimeReasons,
  listProductionInterruptionReasons,
} from "@/src/lib/production/reasons";

const toMessage = (
  path: string,
  message: string,
  type: "success" | "error" = "success",
) => redirect(`${path}?${type}=${encodeURIComponent(message)}`);

const normalizeText = (value: FormDataEntryValue | null) => {
  const normalized = String(value ?? "").trim();
  return normalized.length ? normalized : null;
};

const normalizeNumber = (value: FormDataEntryValue | null) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRequiredNumber = (value: FormDataEntryValue | null, fallback = 0) => {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeUuid = (value: FormDataEntryValue | null) => {
  const normalized = normalizeText(value);
  return normalized && /^[0-9a-f-]{36}$/i.test(normalized) ? normalized : null;
};

const hasSupervisorOrAdminRole = (roles: string[]) =>
  roles.includes("admin") || roles.includes("supervisor");

const resolveOperatorProfileIdForWrite = ({
  requestedOperatorProfileId,
  currentProfileId,
  roles,
}: {
  requestedOperatorProfileId: string;
  currentProfileId: string;
  roles: string[];
}) => (hasSupervisorOrAdminRole(roles) ? requestedOperatorProfileId : currentProfileId);

export async function listProductionProjectsAction() {
  const { session, roles } = await requireProtectedAccess();
  return listProductionProjects({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production/projects",
  });
}

export async function getProductionProjectDetailAction(projectId: string) {
  const { session, roles } = await requireProtectedAccess();
  return getProductionProjectDetail({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production/projects",
    projectId,
  });
}

export async function createProductionProjectAction(input: {
  projectFile: string;
  projectName: string;
  projectSequence: number;
  totalOperationalMinutes: number | null;
  estimatedTotalVolumeM3: number | null;
  notes: string | null;
  status?: "active" | "completed" | "archived";
}) {
  const { session, roles } = await requireOperationalWriteAccess();

  const record = await createProductionProject({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    input,
  });

  revalidatePath("/production");
  revalidatePath("/production/projects");
  return record;
}

export async function createProductionProjectFormAction(formData: FormData) {
  const projectFile = String(formData.get("project_file") ?? "").trim();
  const projectName = String(formData.get("project_name") ?? "").trim();
  const projectSequence = normalizeRequiredNumber(formData.get("project_sequence"), Number.NaN);
  const totalOperationalMinutes = normalizeNumber(formData.get("total_operational_minutes"));
  const estimatedTotalVolumeM3 = normalizeNumber(formData.get("estimated_total_volume_m3"));
  const status = (normalizeText(formData.get("status")) ?? "active") as
    | "active"
    | "completed"
    | "archived";
  const notes = normalizeText(formData.get("notes"));

  if (!projectFile || !projectName || !Number.isFinite(projectSequence)) {
    toMessage("/production/projects/new", "Project file, name, and sequence are required.", "error");
  }

  try {
    const created = await createProductionProjectAction({
      projectFile,
      projectName,
      projectSequence,
      totalOperationalMinutes,
      estimatedTotalVolumeM3,
      notes,
      status,
    });

    redirect(`/production/projects/${created.id}?success=${encodeURIComponent("Project created.")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create project.";
    toMessage("/production/projects/new", message, "error");
  }
}

export async function updateProductionProjectAction(
  projectId: string,
  input: {
    projectFile?: string;
    projectName?: string;
    projectSequence?: number;
    totalOperationalMinutes?: number | null;
    estimatedTotalVolumeM3?: number | null;
    notes?: string | null;
    status?: "active" | "completed" | "archived";
  },
) {
  const { session, roles } = await requireOperationalWriteAccess();

  const record = await updateProductionProject({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    projectId,
    input,
  });

  revalidatePath("/production");
  revalidatePath("/production/projects");
  revalidatePath(`/production/projects/${projectId}`);
  return record;
}

export async function updateProductionProjectFormAction(formData: FormData) {
  const projectId = normalizeUuid(formData.get("project_id"));
  if (!projectId) {
    return toMessage("/production/projects", "Project id is required.", "error");
  }

  try {
    await updateProductionProjectAction(projectId, {
      projectFile: String(formData.get("project_file") ?? "").trim() || undefined,
      projectName: String(formData.get("project_name") ?? "").trim() || undefined,
      projectSequence: normalizeNumber(formData.get("project_sequence")) ?? undefined,
      totalOperationalMinutes: normalizeNumber(formData.get("total_operational_minutes")),
      estimatedTotalVolumeM3: normalizeNumber(formData.get("estimated_total_volume_m3")),
      notes: normalizeText(formData.get("notes")),
      status: (normalizeText(formData.get("status")) ?? undefined) as
        | "active"
        | "completed"
        | "archived"
        | undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update project.";
    toMessage(`/production/projects/${projectId}`, message, "error");
  }

  toMessage(`/production/projects/${projectId}`, "Project updated.");
}

export async function archiveProductionProjectAction(projectId: string) {
  const { session, roles } = await requireOperationalWriteAccess();

  const record = await archiveProductionProject({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    projectId,
  });

  revalidatePath("/production");
  revalidatePath("/production/projects");
  return record;
}

export async function listProductionEntriesAction(filters?: {
  projectId?: string;
  operatorProfileId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}) {
  const { session, roles } = await requireProtectedAccess();

  return listProductionEntries({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production/entries",
    ...filters,
  });
}

export async function createProductionEntryAction(input: {
  workDate: string;
  operatorProfileId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  projectId: string;
  fileMinutesLeftStart: number;
  fileMinutesLeftEnd: number;
  actualVolumeCutM3: number;
  downtimeMinutes: number;
  downtimeReasonId: string | null;
  interruptionMinutes: number;
  interruptionReasonId: string | null;
  notes: string | null;
}) {
  const { session, roles, profile } = await requireProtectedAccess();

  if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) {
    throw new Error("Operator, supervisor, or admin access is required for entry writes");
  }

  if (!profile) {
    throw new Error("Profile record is required for production entry writes");
  }

  const operatorProfileId = resolveOperatorProfileIdForWrite({
    requestedOperatorProfileId: input.operatorProfileId,
    currentProfileId: profile.id,
    roles,
  });

  const record = await createProductionEntry({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    input: {
      ...input,
      operatorProfileId,
      createdByProfileId: profile.id,
    },
  });

  revalidatePath("/production");
  revalidatePath("/production/entries");
  revalidatePath("/dashboard");
  return record;
}

export async function createProductionEntryFormAction(formData: FormData) {
  const workDate = String(formData.get("work_date") ?? "").trim();
  const operatorProfileId = String(formData.get("operator_profile_id") ?? "").trim();
  const shiftStartTime = String(formData.get("shift_start_time") ?? "").trim();
  const shiftEndTime = String(formData.get("shift_end_time") ?? "").trim();
  const projectId = String(formData.get("project_id") ?? "").trim();
  const fileMinutesLeftStart = normalizeRequiredNumber(formData.get("file_minutes_left_start"));
  const fileMinutesLeftEnd = normalizeRequiredNumber(formData.get("file_minutes_left_end"));
  const actualVolumeCutM3 = normalizeRequiredNumber(formData.get("actual_volume_cut_m3"));
  const downtimeMinutes = normalizeRequiredNumber(formData.get("downtime_minutes"));
  const interruptionMinutes = normalizeRequiredNumber(formData.get("interruption_minutes"));
  const downtimeReasonId = normalizeUuid(formData.get("downtime_reason_id"));
  const interruptionReasonId = normalizeUuid(formData.get("interruption_reason_id"));
  const notes = normalizeText(formData.get("notes"));

  if (!workDate || !operatorProfileId || !shiftStartTime || !shiftEndTime || !projectId) {
    toMessage("/production/entries/new", "Work date, operator, shift times, and project are required.", "error");
  }

  try {
    const created = await createProductionEntryAction({
      workDate,
      operatorProfileId,
      shiftStartTime,
      shiftEndTime,
      projectId,
      fileMinutesLeftStart,
      fileMinutesLeftEnd,
      actualVolumeCutM3,
      downtimeMinutes,
      downtimeReasonId: downtimeMinutes > 0 ? downtimeReasonId : null,
      interruptionMinutes,
      interruptionReasonId: interruptionMinutes > 0 ? interruptionReasonId : null,
      notes,
    });

    redirect(`/production/entries/${created.id}?success=${encodeURIComponent("Entry created.")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create entry.";
    toMessage("/production/entries/new", message, "error");
  }
}

export async function updateProductionEntryAction(
  entryId: string,
  input: {
    workDate?: string;
    operatorProfileId?: string;
    shiftStartTime?: string;
    shiftEndTime?: string;
    projectId?: string;
    fileMinutesLeftStart?: number;
    fileMinutesLeftEnd?: number;
    actualVolumeCutM3?: number;
    downtimeMinutes?: number;
    downtimeReasonId?: string | null;
    interruptionMinutes?: number;
    interruptionReasonId?: string | null;
    notes?: string | null;
  },
) {
  const { session, roles, profile } = await requireProtectedAccess("/production/entries");

  if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) {
    throw new Error("Operator, supervisor, or admin access is required for entry writes");
  }

  const existingEntry = await getProductionEntryDetail({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production/entries",
    entryId,
  });

  if (!existingEntry) {
    throw new Error("Production entry not found");
  }

  if (!hasSupervisorOrAdminRole(roles) && existingEntry.operator_profile_id !== profile?.id) {
    throw new Error("You can only update your own production entries");
  }

  const record = await updateProductionEntry({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    entryId,
    input: {
      ...input,
      operatorProfileId: resolveOperatorProfileIdForWrite({
        requestedOperatorProfileId: input.operatorProfileId ?? existingEntry.operator_profile_id,
        currentProfileId: profile?.id ?? existingEntry.operator_profile_id,
        roles,
      }),
    },
  });

  revalidatePath("/production");
  revalidatePath("/production/entries");
  revalidatePath(`/production/entries/${entryId}`);
  revalidatePath("/dashboard");
  return record;
}

export async function updateProductionEntryFormAction(formData: FormData) {
  const entryId = normalizeUuid(formData.get("entry_id"));
  if (!entryId) {
    return toMessage("/production/entries", "Entry id is required.", "error");
  }

  const downtimeMinutes = normalizeRequiredNumber(formData.get("downtime_minutes"));
  const interruptionMinutes = normalizeRequiredNumber(formData.get("interruption_minutes"));

  try {
    await updateProductionEntryAction(entryId, {
      workDate: String(formData.get("work_date") ?? "").trim() || undefined,
      operatorProfileId: String(formData.get("operator_profile_id") ?? "").trim() || undefined,
      shiftStartTime: String(formData.get("shift_start_time") ?? "").trim() || undefined,
      shiftEndTime: String(formData.get("shift_end_time") ?? "").trim() || undefined,
      projectId: String(formData.get("project_id") ?? "").trim() || undefined,
      fileMinutesLeftStart: normalizeRequiredNumber(formData.get("file_minutes_left_start")),
      fileMinutesLeftEnd: normalizeRequiredNumber(formData.get("file_minutes_left_end")),
      actualVolumeCutM3: normalizeRequiredNumber(formData.get("actual_volume_cut_m3")),
      downtimeMinutes,
      downtimeReasonId: downtimeMinutes > 0 ? normalizeUuid(formData.get("downtime_reason_id")) : null,
      interruptionMinutes,
      interruptionReasonId:
        interruptionMinutes > 0 ? normalizeUuid(formData.get("interruption_reason_id")) : null,
      notes: normalizeText(formData.get("notes")),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update entry.";
    toMessage(`/production/entries/${entryId}`, message, "error");
  }

  toMessage(`/production/entries/${entryId}`, "Entry updated.");
}

export async function deleteProductionEntryAction(entryId: string) {
  const { session, roles, profile } = await requireProtectedAccess("/production/entries");

  if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) {
    throw new Error("Operator, supervisor, or admin access is required for entry writes");
  }

  const existingEntry = await getProductionEntryDetail({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production/entries",
    entryId,
  });

  if (!existingEntry) {
    throw new Error("Production entry not found");
  }

  if (!hasSupervisorOrAdminRole(roles) && existingEntry.operator_profile_id !== profile?.id) {
    throw new Error("You can only delete your own production entries");
  }

  await deleteProductionEntry({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    entryId,
  });

  revalidatePath("/production");
  revalidatePath("/production/entries");
  revalidatePath("/dashboard");
}

export async function listProductionDowntimeReasonsAction() {
  const { session, roles } = await requireProtectedAccess();

  return listProductionDowntimeReasons({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production",
  });
}

export async function listProductionInterruptionReasonsAction() {
  const { session, roles } = await requireProtectedAccess();

  return listProductionInterruptionReasons({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    route: "/production",
  });
}

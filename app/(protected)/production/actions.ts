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
  upsertProductionProjectByFileAndSequence,
  updateProductionProject,
} from "@/src/lib/production/projects";
import {
  createProductionEntry,
  deleteProductionEntry,
  getProductionEntryDetail,
  listAssignableProductionOperators,
  listProductionEntries,
  updateProductionEntry,
} from "@/src/lib/production/entries";
import {
  createProductionDowntimeReason,
  createProductionInterruptionReason,
  listProductionDowntimeReasons,
  listProductionInterruptionReasons,
} from "@/src/lib/production/reasons";
import {
  buildOperatorLookup,
  buildProjectLookup,
  buildReasonLookup,
  normalizeDate,
  normalizeLookupKey,
  normalizeProjectKey,
  normalizeReasonLabel,
  normalizeTimeOfDay,
  normalizeWhitespace,
  parseDecimalHoursToMinutes,
  parseDurationHoursMinutesSecondsToMinutes,
  toReasonCode,
} from "@/src/lib/production/import";

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

type ImportedProjectRegistryRow = {
  rowNumber: number;
  projectFile: string;
  projectName: string;
  projectSequence: string;
  totalTime: string;
  totalVolume: string;
};

type ImportedDailyRegistryRow = {
  rowNumber: number;
  date: string;
  operator: string;
  startTime: string;
  finishTime: string;
  projectFile: string;
  projectSequence: string;
  projectName: string;
  timeRemainingStart: string;
  timeRemainingEnd: string;
  actualVolumeCutM3: string;
  downtimeHours: string;
  downtimeReason: string;
  interruptionHours: string;
  interruptionReason: string;
};

const parseNumeric = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

export async function importProjectRegistryAction(rows: ImportedProjectRegistryRow[]) {
  const { session, roles } = await requireOperationalWriteAccess();

  const result: {
    totalRowsParsed: number;
    imported: number;
    updated: number;
    failed: number;
    warnings: number;
    rowResults: Array<{ rowNumber: number; status: "imported" | "updated" | "failed"; message: string }>;
  } = {
    totalRowsParsed: rows.length,
    imported: 0,
    updated: 0,
    failed: 0,
    warnings: 0,
    rowResults: [],
  };

  for (const row of rows) {
    const projectFile = normalizeWhitespace(row.projectFile ?? "");
    const projectName = normalizeWhitespace(row.projectName ?? "");
    const projectSequence = Number.parseInt(String(row.projectSequence ?? "").trim(), 10);

    if (!projectFile || !projectName || !Number.isInteger(projectSequence)) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        message: "Project File, Project Name, and Project Sequence are required and must be valid.",
      });
      continue;
    }

    const totalOperationalMinutesRaw = parseDurationHoursMinutesSecondsToMinutes(row.totalTime);
    if (Number.isNaN(totalOperationalMinutesRaw)) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        message: "Total Time must be HH:MM:SS.",
      });
      continue;
    }

    const estimatedTotalVolumeRaw = normalizeWhitespace(row.totalVolume ?? "");
    const estimatedTotalVolumeM3 = estimatedTotalVolumeRaw ? parseNumeric(estimatedTotalVolumeRaw) : null;
    if (Number.isNaN(estimatedTotalVolumeM3)) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        message: "Total Volume must be numeric when provided.",
      });
      continue;
    }

    try {
      const upserted = await upsertProductionProjectByFileAndSequence({
        session,
        accessContext: {
          accountStatus: "approved",
          roles,
        },
        input: {
          projectFile,
          projectName,
          projectSequence,
          totalOperationalMinutes: totalOperationalMinutesRaw,
          estimatedTotalVolumeM3,
          notes: null,
        },
      });

      if (upserted.mode === "created") {
        result.imported += 1;
        result.rowResults.push({
          rowNumber: row.rowNumber,
          status: "imported",
          message: "Project created.",
        });
      } else {
        result.updated += 1;
        result.rowResults.push({
          rowNumber: row.rowNumber,
          status: "updated",
          message: "Project updated by project_file + project_sequence.",
        });
      }
    } catch (error) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        message: error instanceof Error ? error.message : "Failed to import project row.",
      });
    }
  }

  revalidatePath("/production");
  revalidatePath("/production/projects");
  revalidatePath("/production/import");
  return result;
}

export async function importDailyRegistryAction(rows: ImportedDailyRegistryRow[]) {
  const { session, roles } = await requireOperationalWriteAccess();
  const route = "/production/import";

  const [projects, operators, downtimeReasons, interruptionReasons] = await Promise.all([
    listProductionProjects({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listAssignableProductionOperators({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listProductionDowntimeReasons({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
    listProductionInterruptionReasons({
      session,
      accessContext: { accountStatus: "approved", roles },
      route,
    }),
  ]);

  const projectsByKey = buildProjectLookup(projects);
  const operatorsByName = buildOperatorLookup(operators);
  const downtimeLookup = buildReasonLookup(downtimeReasons);
  const interruptionLookup = buildReasonLookup(interruptionReasons);
  const knownDowntimeCodes = new Set(downtimeReasons.map((reason) => normalizeLookupKey(reason.code)));
  const knownInterruptionCodes = new Set(interruptionReasons.map((reason) => normalizeLookupKey(reason.code)));

  const result: {
    totalRowsParsed: number;
    imported: number;
    failed: number;
    warnings: number;
    rowResults: Array<{
      rowNumber: number;
      status: "imported" | "failed";
      warnings: string[];
      message: string;
    }>;
  } = {
    totalRowsParsed: rows.length,
    imported: 0,
    failed: 0,
    warnings: 0,
    rowResults: [],
  };

  const resolveReason = async ({
    kind,
    rawLabel,
  }: {
    kind: "downtime" | "interruption";
    rawLabel: string;
  }) => {
    const normalizedLabel = normalizeReasonLabel(rawLabel);
    if (!normalizedLabel) {
      return null;
    }

    const lookup = kind === "downtime" ? downtimeLookup : interruptionLookup;
    const matchedByLabel = lookup.byLabel.get(normalizeLookupKey(normalizedLabel));
    if (matchedByLabel) {
      return matchedByLabel.id;
    }

    const reasonCodeBase = toReasonCode(normalizedLabel);
    const knownCodes = kind === "downtime" ? knownDowntimeCodes : knownInterruptionCodes;
    let candidateCode = reasonCodeBase;
    let suffix = 2;
    while (knownCodes.has(normalizeLookupKey(candidateCode))) {
      candidateCode = `${reasonCodeBase}-${suffix}`;
      suffix += 1;
    }

    if (kind === "downtime") {
      const created = await createProductionDowntimeReason({
        session,
        accessContext: { accountStatus: "approved", roles },
        input: {
          code: candidateCode,
          label: normalizedLabel,
          sortOrder: 999,
          isActive: true,
        },
      });
      lookup.byLabel.set(normalizeLookupKey(created.label), created);
      lookup.byCode.set(normalizeLookupKey(created.code), created);
      knownCodes.add(normalizeLookupKey(created.code));
      return created.id;
    }

    const created = await createProductionInterruptionReason({
      session,
      accessContext: { accountStatus: "approved", roles },
      input: {
        code: candidateCode,
        label: normalizedLabel,
        sortOrder: 999,
        isActive: true,
      },
    });
    lookup.byLabel.set(normalizeLookupKey(created.label), created);
    lookup.byCode.set(normalizeLookupKey(created.code), created);
    knownCodes.add(normalizeLookupKey(created.code));
    return created.id;
  };

  for (const row of rows) {
    const rowWarnings: string[] = [];
    const workDate = normalizeDate(row.date);
    const shiftStartTime = normalizeTimeOfDay(row.startTime);
    const shiftEndTime = normalizeTimeOfDay(row.finishTime);
    const projectFile = normalizeWhitespace(row.projectFile ?? "");
    const projectSequence = Number.parseInt(String(row.projectSequence ?? "").trim(), 10);
    const operator = operatorsByName.get(normalizeLookupKey(row.operator ?? ""));
    const fileMinutesLeftStart = parseDurationHoursMinutesSecondsToMinutes(row.timeRemainingStart);
    const fileMinutesLeftEnd = parseDurationHoursMinutesSecondsToMinutes(row.timeRemainingEnd);
    const actualVolumeCutRaw = normalizeWhitespace(row.actualVolumeCutM3 ?? "");
    const actualVolumeCutM3 = actualVolumeCutRaw ? parseNumeric(actualVolumeCutRaw) : 0;
    const downtimeMinutes = parseDecimalHoursToMinutes(row.downtimeHours);
    const interruptionMinutes = parseDecimalHoursToMinutes(row.interruptionHours);

    if (!workDate || !shiftStartTime || !shiftEndTime || !projectFile || !Number.isInteger(projectSequence)) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        warnings: rowWarnings,
        message: "Invalid required date/time/project fields.",
      });
      continue;
    }

    if (!operator) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        warnings: rowWarnings,
        message: `Operator '${row.operator}' could not be resolved.`,
      });
      continue;
    }

    if (
      Number.isNaN(fileMinutesLeftStart) ||
      Number.isNaN(fileMinutesLeftEnd) ||
      Number.isNaN(actualVolumeCutM3) ||
      Number.isNaN(downtimeMinutes) ||
      Number.isNaN(interruptionMinutes)
    ) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        warnings: rowWarnings,
        message: "Invalid numeric or duration field.",
      });
      continue;
    }

    const project = projectsByKey.get(normalizeProjectKey(projectFile, projectSequence));
    if (!project) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        warnings: rowWarnings,
        message: `No canonical project found for ${projectFile} #${projectSequence}. Import Project Registry first.`,
      });
      continue;
    }

    const providedProjectName = normalizeWhitespace(row.projectName ?? "");
    if (providedProjectName && normalizeLookupKey(providedProjectName) !== normalizeLookupKey(project.project_name)) {
      rowWarnings.push("Project name mismatch: matched canonical project by project_file + project_sequence.");
    }

    if (fileMinutesLeftEnd > fileMinutesLeftStart) {
      rowWarnings.push("file_minutes_left_end is greater than file_minutes_left_start.");
    }

    const operationalMinutes =
      (Date.parse(`1970-01-01T${shiftEndTime}Z`) - Date.parse(`1970-01-01T${shiftStartTime}Z`)) / 60000;
    if (Number.isFinite(operationalMinutes) && downtimeMinutes + interruptionMinutes > operationalMinutes) {
      rowWarnings.push("downtime + interruption exceeds operational shift minutes.");
    }

    let downtimeReasonId: string | null = null;
    let interruptionReasonId: string | null = null;

    try {
      downtimeReasonId =
        downtimeMinutes > 0 ? await resolveReason({ kind: "downtime", rawLabel: row.downtimeReason }) : null;
      interruptionReasonId =
        interruptionMinutes > 0
          ? await resolveReason({ kind: "interruption", rawLabel: row.interruptionReason })
          : null;

      if (downtimeMinutes > 0 && !downtimeReasonId) {
        throw new Error("Downtime reason is required when downtime is greater than zero.");
      }
      if (interruptionMinutes > 0 && !interruptionReasonId) {
        throw new Error("Interruption reason is required when interruption is greater than zero.");
      }

      await createProductionEntryAction({
        workDate,
        operatorProfileId: operator.profile_id,
        shiftStartTime,
        shiftEndTime,
        projectId: project.id,
        fileMinutesLeftStart,
        fileMinutesLeftEnd,
        actualVolumeCutM3,
        downtimeMinutes,
        downtimeReasonId,
        interruptionMinutes,
        interruptionReasonId,
        notes: `Imported from Daily Registry row ${row.rowNumber}`,
      });

      result.imported += 1;
      result.warnings += rowWarnings.length;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "imported",
        warnings: rowWarnings,
        message: "Entry imported via production entry action.",
      });
    } catch (error) {
      result.failed += 1;
      result.rowResults.push({
        rowNumber: row.rowNumber,
        status: "failed",
        warnings: rowWarnings,
        message: error instanceof Error ? error.message : "Failed to import Daily Registry row.",
      });
    }
  }

  revalidatePath("/production");
  revalidatePath("/production/entries");
  revalidatePath("/production/import");
  return result;
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

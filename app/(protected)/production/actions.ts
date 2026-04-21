"use server";

import { revalidatePath } from "next/cache";
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
  listProductionEntries,
  updateProductionEntry,
} from "@/src/lib/production/entries";
import {
  listProductionDowntimeReasons,
  listProductionInterruptionReasons,
} from "@/src/lib/production/reasons";

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
  return record;
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
  return record;
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

  const record = await createProductionEntry({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    input: {
      ...input,
      createdByProfileId: profile.id,
    },
  });

  revalidatePath("/production");
  return record;
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
  const { session, roles } = await requireProtectedAccess();

  if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) {
    throw new Error("Operator, supervisor, or admin access is required for entry writes");
  }

  const record = await updateProductionEntry({
    session,
    accessContext: {
      accountStatus: "approved",
      roles,
    },
    entryId,
    input,
  });

  revalidatePath("/production");
  return record;
}

export async function deleteProductionEntryAction(entryId: string) {
  const { session, roles } = await requireProtectedAccess();

  if (!roles.some((role) => ["admin", "supervisor", "operator"].includes(role))) {
    throw new Error("Operator, supervisor, or admin access is required for entry writes");
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

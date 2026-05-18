"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import {
  applyCBaseImport,
  prepareCBaseImport,
  type CBaseImportDiffSummary,
  type CBaseImportValidationError,
} from "@/src/lib/timesheets/c-base-import";

export type CBaseImportActionState = {
  status: "idle" | "success" | "error";
  mode: "dry-run" | "apply" | null;
  message: string | null;
  summary: CBaseImportDiffSummary | null;
  errors: CBaseImportValidationError[];
};

export const initialCBaseImportState: CBaseImportActionState = {
  status: "idle",
  mode: null,
  message: null,
  summary: null,
  errors: [],
};

const fileFromFormData = (formData: FormData, fieldName: string) => {
  const value = formData.get(fieldName);
  return value instanceof File && value.size > 0 ? value : null;
};

const readWorkbook = async (file: File | null, label: "buildings" | "costcodes") => {
  if (!file) {
    throw new Error(`${label === "buildings" ? "BuildingsExport" : "CostcodesExport"} .xlsx file is required.`);
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error(`${file.name} must be an .xlsx file.`);
  }

  return Buffer.from(await file.arrayBuffer());
};

export async function importCBaseTimesheetLookupsAction(
  _previousState: CBaseImportActionState,
  formData: FormData,
): Promise<CBaseImportActionState> {
  const authContext = await requireAdminAccess();
  const mode = formData.get("mode") === "apply" ? "apply" : "dry-run";
  const buildingsFile = fileFromFormData(formData, "buildingsFile");
  const costcodesFile = fileFromFormData(formData, "costcodesFile");

  try {
    if (!authContext.profile) {
      throw new Error("Admin profile could not be resolved.");
    }

    const [buildingsBuffer, costcodesBuffer] = await Promise.all([
      readWorkbook(buildingsFile, "buildings"),
      readWorkbook(costcodesFile, "costcodes"),
    ]);
    const result = await prepareCBaseImport(authContext.session, buildingsBuffer, costcodesBuffer);

    if (result.validationErrors.length > 0) {
      return {
        status: "error",
        mode,
        message: "Validation failed. No database rows were written.",
        summary: result.summary,
        errors: result.validationErrors,
      };
    }

    if (mode === "apply") {
      await applyCBaseImport({
        session: authContext.session,
        actorProfileId: authContext.profile.id,
        buildingsFilename: buildingsFile?.name ?? "",
        costcodesFilename: costcodesFile?.name ?? "",
        result,
      });
      revalidatePath("/timesheet");
      revalidatePath("/admin/timesheet-lookups/import");
      return {
        status: "success",
        mode,
        message: "C Base timesheet lookup sync applied successfully.",
        summary: result.summary,
        errors: [],
      };
    }

    return {
      status: "success",
      mode,
      message: "Dry run completed. Review the summary below, then apply with the same latest export files when ready.",
      summary: result.summary,
      errors: [],
    };
  } catch (error) {
    return {
      status: "error",
      mode,
      message: error instanceof Error ? error.message : "C Base import failed before any rows were written.",
      summary: null,
      errors: [],
    };
  }
}

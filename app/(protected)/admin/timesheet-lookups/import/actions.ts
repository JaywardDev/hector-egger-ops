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


const fileFromFormData = (formData: FormData, fieldName: string) => {
  const value = formData.get(fieldName);
  return value instanceof File ? value : null;
};

const fieldLabel = (label: "buildings" | "costcodes") => (label === "buildings" ? "Buildings" : "Costcodes");

const normalizeFileExtension = (filename: string) => filename.toLowerCase().split(".").pop() ?? "";

const validateWorkbookFile = (file: File | null, label: "buildings" | "costcodes") => {
  if (!file || !file.name) {
    throw new Error("Please choose both C Base export files before validating.");
  }

  if (file.size <= 0) {
    throw new Error(`The ${fieldLabel(label)} export file appears to be empty. Please export it again from C Base.`);
  }

  const ext = normalizeFileExtension(file.name);
  if (ext !== "xlsx") {
    throw new Error(`The ${fieldLabel(label)} export must be an .xlsx file.`);
  }
};

const readWorkbook = async (file: File | null, label: "buildings" | "costcodes") => {
  validateWorkbookFile(file, label);

  try {
    return Buffer.from(await file.arrayBuffer());
  } catch {
    throw new Error(`The ${fieldLabel(label)} export file could not be read. Please export it again from C Base.`);
  }
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
    if (!buildingsFile || !buildingsFile.name || !costcodesFile || !costcodesFile.name) {
      throw new Error("Please choose both C Base export files before validating.");
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
    const friendlyParserError = "One of the C Base export files could not be parsed. Please re-export both .xlsx files from C Base and try again.";
    const rawMessage = error instanceof Error ? error.message : null;
    const isParserReadError = rawMessage !== null && /unexpected end of file|invalid|corrupt|inflate/i.test(rawMessage);

    return {
      status: "error",
      mode,
      message: isParserReadError ? friendlyParserError : rawMessage ?? "C Base import failed before any rows were written.",
      summary: null,
      errors: [],
    };
  }
}

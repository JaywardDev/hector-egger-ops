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
  const upload = file;

  if (!(upload instanceof File)) {
    throw new Error("Please choose both C Base export files before validating.");
  }

  try {
    return Buffer.from(await upload.arrayBuffer());
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
  let failedStep: "prevalidate" | "read-buffer" | "parse-workbook" | "validate-workbook" | "prepare-sync" | "apply-sync" = "prevalidate";

  try {
    if (!authContext.profile) {
      throw new Error("Admin profile could not be resolved.");
    }
    if (!buildingsFile || !buildingsFile.name || !costcodesFile || !costcodesFile.name) {
      throw new Error("Please choose both C Base export files before validating.");
    }

    failedStep = "read-buffer";
    const [buildingsBuffer, costcodesBuffer] = await Promise.all([
      readWorkbook(buildingsFile, "buildings"),
      readWorkbook(costcodesFile, "costcodes"),
    ]);
    failedStep = "parse-workbook";
    const result = await prepareCBaseImport(authContext.session, buildingsBuffer, costcodesBuffer);
    failedStep = "validate-workbook";

    if (result.validationErrors.length > 0) {
      return {
        status: "error",
        mode,
        message: "Validation failed. No database rows were written.",
        summary: result.summary,
        errors: result.validationErrors,
      };
    }

    failedStep = "prepare-sync";
    if (mode === "apply") {
      failedStep = "apply-sync";
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

    console.error("[c-base-import] action failed", {
      mode,
      failedStep,
      formDataHasBuildingsFile: formData.has("buildingsFile"),
      formDataHasCostcodesFile: formData.has("costcodesFile"),
      formDataMode: formData.get("mode"),
      buildingsFileType: buildingsFile?.constructor?.name ?? null,
      buildingsFileName: buildingsFile?.name ?? null,
      buildingsFileSize: buildingsFile?.size ?? null,
      buildingsFileMimeType: buildingsFile?.type ?? null,
      costcodesFileType: costcodesFile?.constructor?.name ?? null,
      costcodesFileName: costcodesFile?.name ?? null,
      costcodesFileSize: costcodesFile?.size ?? null,
      costcodesFileMimeType: costcodesFile?.type ?? null,
      rawMessage,
      sanitizedMessage: isParserReadError ? friendlyParserError : rawMessage ?? "C Base import failed before any rows were written.",
    });

    return {
      status: "error",
      mode,
      message: isParserReadError ? friendlyParserError : rawMessage ?? "C Base import failed before any rows were written.",
      summary: null,
      errors: [],
    };
  }
}

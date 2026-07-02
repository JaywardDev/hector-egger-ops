"use server";

import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { parseQaChecklistTemplate } from "@/src/lib/qa/c-base-import";
import {
  applyQaTemplateImport,
  prepareQaTemplateImport,
  type QaTemplateImportAction,
} from "@/src/lib/qa/template-import-apply";

export type QaTemplateFileResult = {
  filename: string;
  action: QaTemplateImportAction | "invalid";
  templateName: string | null;
  version: number | null;
  errors: string[];
  warnings: string[];
};

export type QaTemplateImportState = {
  status: "idle" | "success" | "error";
  mode: "dry-run" | "apply" | null;
  message: string | null;
  results: QaTemplateFileResult[];
};

const normalizeFileExtension = (filename: string) => filename.toLowerCase().split(".").pop() ?? "";

const invalidResult = (filename: string, message: string): QaTemplateFileResult => ({
  filename,
  action: "invalid",
  templateName: null,
  version: null,
  errors: [message],
  warnings: [],
});

export async function importQaTemplatesAction(
  _previousState: QaTemplateImportState,
  formData: FormData,
): Promise<QaTemplateImportState> {
  const authContext = await requireAdminAccess();
  const mode = formData.get("mode") === "apply" ? "apply" : "dry-run";
  // When set, a same-version-different-hash file overwrites the stored version
  // in place instead of being refused as a conflict (used to heal versions after
  // a parser upgrade; started checklists keep their own snapshot).
  const replaceConflicts = formData.get("replace") === "on";

  try {
    if (!authContext.profile) {
      throw new Error("Admin profile could not be resolved.");
    }

    const files = formData.getAll("files").filter((value): value is File => value instanceof File && value.name.length > 0);
    if (files.length === 0) {
      return { status: "error", mode, message: "Choose at least one checklist template .xlsx file.", results: [] };
    }

    const results: QaTemplateFileResult[] = [];
    for (const file of files) {
      if (normalizeFileExtension(file.name) !== "xlsx") {
        results.push(invalidResult(file.name, "Must be an .xlsx checklist template export."));
        continue;
      }
      if (file.size <= 0) {
        results.push(invalidResult(file.name, "File is empty. Please export it again from C-base."));
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(await file.arrayBuffer());
      } catch {
        results.push(invalidResult(file.name, "File could not be read. Please export it again."));
        continue;
      }

      const parse = parseQaChecklistTemplate(buffer);
      const errors = parse.errors.map((issue) => issue.message);
      const warnings = parse.warnings.map((issue) => issue.message);

      if (parse.errors.length > 0 || !parse.fields) {
        results.push({ filename: file.name, action: "invalid", templateName: parse.fields?.name ?? null, version: parse.fields?.version ?? null, errors, warnings });
        continue;
      }

      if (mode === "dry-run") {
        const outcome = await prepareQaTemplateImport(file.name, buffer);
        // Surface what an apply *would* do given the replace choice, so the
        // dry-run badge matches the button the admin is about to press.
        const action = outcome.action === "version_conflict" && replaceConflicts ? "replaced" : outcome.action;
        results.push({ filename: file.name, action, templateName: parse.fields.name, version: parse.fields.version, errors, warnings });
      } else {
        const applied = await applyQaTemplateImport({
          actorProfileId: authContext.profile.id,
          filename: file.name,
          buffer,
          mode: replaceConflicts ? "replace" : "skip",
        });
        results.push({ filename: file.name, action: applied.action, templateName: parse.fields.name, version: parse.fields.version, errors, warnings });
      }
    }

    if (mode === "apply") {
      revalidatePath("/admin/qa-templates/import");
    }

    const invalidCount = results.filter((result) => result.action === "invalid").length;
    const conflictCount = results.filter((result) => result.action === "version_conflict").length;
    const hasProblem = invalidCount > 0 || conflictCount > 0;

    return {
      status: hasProblem ? "error" : "success",
      mode,
      message:
        mode === "dry-run"
          ? `Dry run checked ${results.length} file${results.length === 1 ? "" : "s"}. Review below, then apply with the same files.`
          : `Applied ${results.length} file${results.length === 1 ? "" : "s"}.${hasProblem ? " Some files need attention (see below)." : ""}`,
      results,
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : null;
    const isParserReadError = rawMessage !== null && /unexpected end of file|invalid|corrupt|inflate/i.test(rawMessage);
    console.error("[qa-template-import] action failed", { mode, rawMessage });
    return {
      status: "error",
      mode,
      message: isParserReadError
        ? "A file could not be parsed. Please re-export the .xlsx checklist template from C-base and try again."
        : rawMessage ?? "QA template import failed before any rows were written.",
      results: [],
    };
  }
}

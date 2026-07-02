"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminAccess, requireProtectedAccess } from "@/src/lib/auth/guards";
import { isAdminOrSupervisor, isOperator } from "@/src/lib/permissions/roles";
import { createQaProject } from "@/src/lib/qa/projects";
import { createQaSection, startQaChecklist } from "@/src/lib/qa/checklists";

// Create a QA project. Admin-only (the manager owns project structure) — gated
// here, with the qa_project RLS as defense-in-depth.
export async function createQaProjectAction(formData: FormData) {
  const { profile } = await requireAdminAccess();
  if (!profile) throw new Error("Admin profile could not be resolved.");

  const name = String(formData.get("name") ?? "").trim();
  const ref = String(formData.get("ref") ?? "").trim();
  const lot = String(formData.get("lot") ?? "").trim();

  if (!name) {
    redirect(`/qa/projects/new?error=${encodeURIComponent("Project name is required.")}`);
  }

  let createdId: string | null = null;
  try {
    const created = await createQaProject({ actorProfileId: profile.id, input: { ref, name, lot } });
    createdId = created.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the QA project.";
    redirect(`/qa/projects/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath("/qa");
  redirect(`/qa/projects/${createdId}`);
}

// Add a section (folder) to a project. Admin-only (manager owns structure).
export async function createQaSectionAction(formData: FormData) {
  const { profile } = await requireAdminAccess();
  if (!profile) throw new Error("Admin profile could not be resolved.");

  const projectId = String(formData.get("projectId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!projectId) throw new Error("Project is required.");
  if (!name) {
    redirect(`/qa/projects/${projectId}?error=${encodeURIComponent("Section name is required.")}`);
  }

  try {
    await createQaSection({ projectId, name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not add the section.";
    redirect(`/qa/projects/${projectId}?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/qa/projects/${projectId}`);
  redirect(`/qa/projects/${projectId}`);
}

// Start a checklist from a template. Capture-level (admin/supervisor/operator).
export async function startQaChecklistAction(formData: FormData) {
  const context = await requireProtectedAccess();
  if (!context.profile) throw new Error("Profile could not be resolved.");
  if (!isAdminOrSupervisor(context) && !isOperator(context)) {
    redirect("/qa");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const templateVersionId = String(formData.get("templateVersionId") ?? "").trim();
  const sectionId = String(formData.get("sectionId") ?? "").trim() || null;
  const code = String(formData.get("code") ?? "").trim();

  if (!projectId || !templateVersionId) {
    redirect(`/qa/projects/${projectId}/checklists/new?error=${encodeURIComponent("Choose a template to start a checklist.")}`);
  }

  let checklistId: string | null = null;
  try {
    checklistId = await startQaChecklist({
      actorProfileId: context.profile.id,
      projectId,
      sectionId,
      templateVersionId,
      code,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not start the checklist.";
    redirect(`/qa/projects/${projectId}/checklists/new?error=${encodeURIComponent(message)}`);
  }

  revalidatePath(`/qa/projects/${projectId}`);
  redirect(`/qa/checklists/${checklistId}`);
}


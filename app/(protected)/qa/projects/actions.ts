"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminAccess } from "@/src/lib/auth/guards";
import { createQaProject } from "@/src/lib/qa/projects";

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

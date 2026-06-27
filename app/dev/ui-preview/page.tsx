import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PreviewContent } from "./preview-content";
import type { ProfileRecord } from "@/src/lib/auth/profile-access";

const previewSession = {
  accessToken: "mock-local-preview-access-token",
  refreshToken: null,
  user: {
    id: "mock-local-preview-user",
    email: "designer@example.test",
  },
};

const previewProfile: ProfileRecord = {
  id: "mock-local-preview-profile",
  auth_user_id: "mock-local-preview-user",
  email: "designer@example.test",
  first_name: "Jayward",
  middle_name: null,
  last_name: "Severino",
  full_name: "Jayward Severino",
  profile_completed_at: "2026-01-15T09:30:00.000Z",
  account_status: "approved",
  staff_group: "office",
  avatar_path: null,
  onboarding_source: "preview-seed",
  invited_by_auth_user_id: null,
  invited_at: null,
  approved_at: "2026-01-15T09:45:00.000Z",
  disabled_at: null,
  created_at: "2026-01-15T09:00:00.000Z",
  updated_at: "2026-01-15T09:45:00.000Z",
};

export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <AppShell
      session={previewSession}
      profile={previewProfile}
      accessState="approved"
      roles={["admin", "supervisor", "operator"]}
      signOutAction={null}
    >
      <PreviewContent />
    </AppShell>
  );
}

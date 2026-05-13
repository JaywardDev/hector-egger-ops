import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PreviewContent } from "./preview-content";

const previewSession = {
  accessToken: "mock-local-preview-access-token",
  refreshToken: null,
  user: {
    id: "mock-local-preview-user",
    email: "designer@example.test",
  },
};

export default function UiPreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <AppShell
      session={previewSession}
      accessState="approved"
      roles={["admin", "supervisor", "operator"]}
      signOutAction={null}
    >
      <PreviewContent />
    </AppShell>
  );
}

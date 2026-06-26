import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { PushNotificationPrompt } from "@/src/components/push-notification-prompt";
import { requireProtectedAccess } from "@/src/lib/auth/guards";

export default async function SettingsPage() {
  const { profile } = await requireProtectedAccess("/settings");

  if (!profile) {
    return (
      <PageContainer>
        <PageHeader title="Settings" />
        <Alert variant="error">Authenticated profile is required.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        eyebrow="Your account"
        description="Manage your personal app preferences."
      />

      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Push notifications</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Get reminders on this device when you have unsubmitted timesheet entries. Enable this on each
            device or browser where you want to receive notifications.
          </p>
        </div>
        <PushNotificationPrompt />
      </Card>
    </PageContainer>
  );
}

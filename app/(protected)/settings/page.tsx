import { PageContainer } from "@/src/components/layout/page-container";
import { PageHeader } from "@/src/components/layout/page-header";
import { Alert } from "@/src/components/ui/alert";
import { Card } from "@/src/components/ui/card";
import { PushNotificationPrompt } from "@/src/components/push-notification-prompt";
import { ProfileNameForm } from "@/app/(protected)/settings/components/profile-name-form";
import { AvatarUploader } from "@/app/(protected)/settings/components/avatar-uploader";
import { requireProtectedAccess } from "@/src/lib/auth/guards";

export default async function SettingsPage() {
  const { profile } = await requireProtectedAccess("/settings");

  if (!profile) {
    return (
      <PageContainer>
        <PageHeader title="Profile & settings" />
        <Alert variant="error">Authenticated profile is required.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Profile & settings"
        eyebrow="Your account"
        description="Manage your profile details and personal app preferences."
      />

      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Profile photo</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Upload a photo to show across the app instead of your initials. Drag and zoom to fit the circle.
          </p>
        </div>
        <AvatarUploader
          profileId={profile.id}
          name={profile.full_name ?? profile.email}
          initialHasAvatar={Boolean(profile.avatar_path)}
        />
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Display name</h2>
          <p className="mt-1 text-sm text-zinc-600">
            This is how your name appears across timesheets, approvals, and admin lists.
          </p>
        </div>
        <ProfileNameForm
          firstName={profile.first_name ?? ""}
          middleName={profile.middle_name ?? ""}
          lastName={profile.last_name ?? ""}
        />
      </Card>

      <Card className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">Push notifications</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Get reminders on this device when you have unsaved timesheet entries. Enable this on each
            device or browser where you want to receive notifications.
          </p>
        </div>
        <PushNotificationPrompt />
      </Card>
    </PageContainer>
  );
}

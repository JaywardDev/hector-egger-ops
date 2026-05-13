import { redirect } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { FormErrorText, FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Stack } from "@/src/components/layout/stack";
import { getAuthContext } from "@/src/lib/auth/guards";
import { completeProfileAction } from "@/app/(public)/complete-profile/actions";

export type CompleteProfilePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function CompleteProfilePage({ searchParams }: CompleteProfilePageProps) {
  const { accessState, profile, session } = await getAuthContext();

  if (accessState === "unauthenticated") {
    redirect("/sign-in");
  }

  if (accessState === "approved") {
    redirect("/timesheet");
  }

  if (accessState === "pending_approval") {
    redirect("/pending");
  }

  if (accessState === "disabled") {
    redirect("/pending?status=disabled");
  }

  const params = await searchParams;

  return (
    <Stack gap="lg">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Complete your profile</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Add your first and last name before your account can be reviewed for approval.
        </p>
        <p className="mt-2 text-sm text-zinc-600">
          Signed in as <span className="font-medium text-zinc-900">{session?.user.email ?? "unknown"}</span>
        </p>
      </div>

      <form action={completeProfileAction} className="space-y-4">
        <FormField label="First Name" htmlFor="complete-profile-first-name">
          <Input
            id="complete-profile-first-name"
            required
            type="text"
            name="firstName"
            defaultValue={profile?.first_name ?? ""}
            placeholder="Noah"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Middle Name" htmlFor="complete-profile-middle-name">
          <Input
            id="complete-profile-middle-name"
            type="text"
            name="middleName"
            defaultValue={profile?.middle_name ?? ""}
            placeholder="Optional"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Last Name" htmlFor="complete-profile-last-name">
          <Input
            id="complete-profile-last-name"
            required
            type="text"
            name="lastName"
            defaultValue={profile?.last_name ?? ""}
            placeholder="Smith"
            className="px-3 py-3"
          />
        </FormField>

        {params.error ? <FormErrorText>{params.error}</FormErrorText> : null}

        <Button type="submit" variant="brand" size="lg" className="w-full">
          Complete profile
        </Button>
      </form>
    </Stack>
  );
}

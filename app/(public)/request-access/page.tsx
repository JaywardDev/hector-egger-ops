import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { FormErrorText, FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Stack } from "@/src/components/layout/stack";
import { getAuthContext } from "@/src/lib/auth/guards";
import { requestAccessAction } from "@/app/(public)/request-access/actions";

type RequestAccessPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function RequestAccessPage({ searchParams }: RequestAccessPageProps) {
  const { accessState } = await getAuthContext();

  if (accessState === "approved") {
    redirect("/timesheet");
  }

  if (accessState === "incomplete_profile") {
    redirect("/complete-profile");
  }

  if (accessState === "pending_approval" || accessState === "disabled") {
    redirect("/pending");
  }

  const params = await searchParams;

  return (
    <Stack gap="lg">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Request access</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Create an account for the Hector Egger Operations Platform. Access is granted after admin review.
        </p>
      </div>
      <form action={requestAccessAction} className="space-y-4">
        <FormField label="First Name" htmlFor="request-access-first-name">
          <Input
            id="request-access-first-name"
            required
            type="text"
            name="firstName"
            placeholder="Jane"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Middle Name" htmlFor="request-access-middle-name">
          <Input
            id="request-access-middle-name"
            type="text"
            name="middleName"
            placeholder="Optional"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Last Name" htmlFor="request-access-last-name">
          <Input
            id="request-access-last-name"
            required
            type="text"
            name="lastName"
            placeholder="Doe"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Email" htmlFor="request-access-email">
          <Input
            id="request-access-email"
            required
            type="email"
            name="email"
            placeholder="you@company.com"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Password" htmlFor="request-access-password">
          <Input
            id="request-access-password"
            required
            type="password"
            name="password"
            placeholder="••••••••"
            className="px-3 py-3"
          />
        </FormField>

        {params.error ? <FormErrorText>{params.error}</FormErrorText> : null}

        <Button type="submit" variant="brand" size="lg" className="w-full">
          Request access
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-zinc-900 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </Stack>
  );
}

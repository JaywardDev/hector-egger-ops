import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/src/components/ui/button";
import { FormErrorText, FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Stack } from "@/src/components/layout/stack";
import { getAuthContext } from "@/src/lib/auth/guards";
import { signInAction } from "@/app/(public)/sign-in/actions";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
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
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">Sign in</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Sign in with your company credentials.
        </p>
      </div>
      <form action={signInAction} className="space-y-4">
        <FormField label="Email" htmlFor="sign-in-email">
          <Input
            id="sign-in-email"
            required
            type="email"
            name="email"
            placeholder="you@company.com"
            className="px-3 py-3"
          />
        </FormField>

        <FormField label="Password" htmlFor="sign-in-password">
          <Input
            id="sign-in-password"
            required
            type="password"
            name="password"
            placeholder="••••••••"
            className="px-3 py-3"
          />
        </FormField>

        {params.error ? <FormErrorText>{params.error}</FormErrorText> : null}

        <Button type="submit" variant="brand" size="lg" className="w-full">
          Sign in
        </Button>
      </form>

      <p className="text-center text-sm text-zinc-600">
        Need an account?{" "}
        <Link href="/request-access" className="font-medium text-zinc-900 underline underline-offset-2">
          Request access
        </Link>
      </p>
    </Stack>
  );
}

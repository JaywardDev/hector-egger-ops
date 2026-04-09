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
    redirect("/dashboard");
  }

  if (accessState === "pending_approval" || accessState === "disabled") {
    redirect("/pending");
  }

  const params = await searchParams;

  return (
    <Stack>
      <p className="text-sm text-zinc-700">Sign in with your Supabase credentials.</p>
      <form action={signInAction} className="space-y-3">
        <FormField label="Email" htmlFor="sign-in-email">
          <Input
            id="sign-in-email"
            required
            type="email"
            name="email"
            placeholder="you@company.com"
          />
        </FormField>

        <FormField label="Password" htmlFor="sign-in-password">
          <Input
            id="sign-in-password"
            required
            type="password"
            name="password"
            placeholder="••••••••"
          />
        </FormField>

        {params.error ? <FormErrorText>{params.error}</FormErrorText> : null}

        <Button type="submit" className="w-full">
          Sign in
        </Button>
      </form>

      <p className="text-sm text-zinc-600">
        Need an account?{" "}
        <Link href="/request-access" className="font-medium text-zinc-900 underline underline-offset-2">
          Request access
        </Link>
      </p>
    </Stack>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { FormErrorText, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Stack } from "@/components/ui/layout";
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
    redirect("/dashboard");
  }

  if (accessState === "pending_approval" || accessState === "disabled") {
    redirect("/pending");
  }

  const params = await searchParams;

  return (
    <Stack>
      <p className="text-sm text-zinc-700">Request access to Hector Egger Ops.</p>
      <form action={requestAccessAction} className="space-y-3">
        <FormField label="Full name" htmlFor="request-access-full-name">
          <Input
            id="request-access-full-name"
            required
            type="text"
            name="fullName"
            placeholder="Jane Doe"
          />
        </FormField>

        <FormField label="Email" htmlFor="request-access-email">
          <Input
            id="request-access-email"
            required
            type="email"
            name="email"
            placeholder="you@company.com"
          />
        </FormField>

        <FormField label="Password" htmlFor="request-access-password">
          <Input
            id="request-access-password"
            required
            type="password"
            name="password"
            placeholder="••••••••"
          />
        </FormField>

        {params.error ? <FormErrorText>{params.error}</FormErrorText> : null}

        <Button type="submit" className="w-full">
          Request access
        </Button>
      </form>

      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-zinc-900 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </Stack>
  );
}

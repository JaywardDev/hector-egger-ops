"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Lock, User } from "lucide-react";
import { PendingSubmitButton } from "@/src/components/ui/pending-button";
import { FullScreenPendingOverlay } from "@/src/components/ui/pending-overlay";
import { FormErrorText, FormField } from "@/src/components/ui/form-field";
import { Input } from "@/src/components/ui/input";
import { Stack } from "@/src/components/layout/stack";
import { signInAction } from "@/app/(public)/sign-in/actions";

type SignInFormProps = {
  error?: string;
};

export function SignInForm({ error }: SignInFormProps) {
  const [showPassword, setShowPassword] = useState(false);

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
          <div className="relative">
            <User
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400"
              strokeWidth={1.8}
            />
            <Input
              id="sign-in-email"
              required
              type="email"
              name="email"
              placeholder="you@company.com"
              className="h-12 pl-11 pr-3 py-3"
            />
          </div>
        </FormField>

        <FormField label="Password" htmlFor="sign-in-password">
          <div className="relative">
            <Lock
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-400"
              strokeWidth={1.8}
            />
            <Input
              id="sign-in-password"
              required
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              className="h-12 pl-11 pr-11 py-3"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded text-zinc-400 outline-none transition-colors hover:text-zinc-600 focus-visible:text-zinc-600 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2"
            >
              {showPassword ? (
                <EyeOff aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
              ) : (
                <Eye aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.8} />
              )}
            </button>
          </div>
        </FormField>

        {error ? <FormErrorText>{error}</FormErrorText> : null}

        <PendingSubmitButton type="submit" variant="brand" size="lg" className="w-full" pendingLabel="Signing in…">
          Sign in
        </PendingSubmitButton>
        <FullScreenPendingOverlay message="Signing in…" description="Checking your credentials and opening your workspace." />
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

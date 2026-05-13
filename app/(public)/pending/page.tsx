import Link from "next/link";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Stack } from "@/src/components/layout/stack";
import { requirePendingAccess } from "@/src/lib/auth/guards";

type PendingPageProps = {
  searchParams: Promise<{
    status?: string;
  }>;
};

export default async function PendingPage({ searchParams }: PendingPageProps) {
  const { session, accessState } = await requirePendingAccess();
  const params = await searchParams;
  const isDisabled = accessState === "disabled" || params.status === "disabled";

  return (
    <Stack gap="lg" className="text-sm text-zinc-700">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-zinc-950">
          {isDisabled ? "Account disabled" : "Access pending"}
        </h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          {isDisabled
            ? "This account cannot access the platform right now."
            : "Your profile is complete and is waiting for administrator approval."}
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4">
        <p>
          Signed in as <span className="font-medium text-zinc-900">{session?.user.email ?? "unknown"}</span>
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span>Current status:</span>
          <Badge variant={isDisabled ? "danger" : "warning"}>{isDisabled ? "Disabled" : "Pending"}</Badge>
        </div>
      </div>

      <Alert variant={isDisabled ? "error" : "warning"}>
        {isDisabled
          ? "Your account is currently disabled. Contact admin support."
          : "Your profile is complete and your account is waiting for admin approval. You'll get access once approved."}
      </Alert>

      <div>
        <Link
          className="inline-flex h-12 items-center justify-center rounded-md border border-zinc-950 bg-zinc-950 px-5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
          href="/auth/sign-out"
        >
          Sign out
        </Link>
      </div>
    </Stack>
  );
}

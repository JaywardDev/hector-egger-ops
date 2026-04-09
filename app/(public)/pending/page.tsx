import Link from "next/link";
import { Alert } from "@/src/components/ui/alert";
import { Badge } from "@/src/components/ui/badge";
import { Card } from "@/src/components/ui/card";
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
    <Card>
      <Stack className="text-sm text-zinc-700">
        <p>
          Signed in as <span className="font-medium text-zinc-900">{session?.user.email ?? "unknown"}</span>
        </p>
        <div className="flex items-center gap-2">
          <span>Current status:</span>
          <Badge variant={isDisabled ? "danger" : "warning"}>{isDisabled ? "Disabled" : "Pending"}</Badge>
        </div>
        <Alert variant={isDisabled ? "error" : "warning"}>
          {isDisabled
            ? "Your account is currently disabled. Contact admin support."
            : "Your account is pending admin approval. You'll get access once approved."}
        </Alert>
        <div>
          <Link
            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
            href="/auth/sign-out"
          >
            Sign out
          </Link>
        </div>
      </Stack>
    </Card>
  );
}

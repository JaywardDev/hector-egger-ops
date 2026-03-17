import Link from "next/link";
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
    <section className="space-y-3 text-sm text-zinc-700">
      <p>
        Signed in as <span className="font-medium text-zinc-900">{session?.user.email ?? "unknown"}</span>
      </p>
      <p>
        {isDisabled
          ? "Your account is currently disabled. Contact admin support."
          : "Your account is pending admin approval. You'll get access once approved."}
      </p>
      <Link className="inline-block rounded-md border border-zinc-300 px-3 py-2" href="/auth/sign-out">
        Sign out
      </Link>
    </section>
  );
}

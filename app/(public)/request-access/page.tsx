import Link from "next/link";
import { redirect } from "next/navigation";
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
    <section className="space-y-4">
      <p className="text-sm text-zinc-700">Request access to Hector Egger Ops.</p>
      <form action={requestAccessAction} className="space-y-3">
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">Full name</span>
          <input
            required
            type="text"
            name="fullName"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
            placeholder="Jane Doe"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">Email</span>
          <input
            required
            type="email"
            name="email"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
            placeholder="you@company.com"
          />
        </label>

        <label className="block space-y-1 text-sm">
          <span className="text-zinc-700">Password</span>
          <input
            required
            type="password"
            name="password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2"
            placeholder="••••••••"
          />
        </label>

        {params.error ? <p className="text-sm text-red-600">{params.error}</p> : null}

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
        >
          Request access
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-zinc-900 underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </section>
  );
}

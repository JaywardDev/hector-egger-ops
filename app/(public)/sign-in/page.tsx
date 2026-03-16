import { redirect } from "next/navigation";
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

  if (accessState === "pending_approval" || accessState === "disabled_or_rejected") {
    redirect("/pending");
  }

  const params = await searchParams;

  return (
    <section className="space-y-4">
      <p className="text-sm text-zinc-700">Sign in with your Supabase credentials.</p>
      <form action={signInAction} className="space-y-3">
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
          Sign in
        </button>
      </form>
    </section>
  );
}

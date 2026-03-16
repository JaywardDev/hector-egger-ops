import Link from "next/link";

const routes = [
  { href: "/sign-in", label: "Sign In" },
  { href: "/pending", label: "Pending" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/inventory", label: "Inventory" },
  { href: "/stock-take", label: "Stock Take" },
  { href: "/production", label: "Production" },
  { href: "/history", label: "History" },
  { href: "/admin", label: "Admin" },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Phase 1
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Operations Platform
        </h1>
        <p className="text-zinc-600">
          Initial App Router architecture with public and protected route groups.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-zinc-900">Available routes</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {routes.map((route) => (
            <li key={route.href}>
              <Link
                className="block rounded-md border border-zinc-200 px-4 py-3 text-sm text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
                href={route.href}
              >
                {route.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

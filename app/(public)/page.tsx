import Link from "next/link";
import { APP_NAV_ITEMS } from "@/lib/navigation";

const PUBLIC_ROUTES = [
  { href: "/sign-in", label: "Sign In" },
  { href: "/pending", label: "Pending" },
];

const routes = [...PUBLIC_ROUTES, ...APP_NAV_ITEMS];

export default function LandingPage() {
  return (
    <section className="space-y-3">
      <p className="text-sm text-zinc-600">
        Initial app shell scaffold with public and protected route groups.
      </p>
      <h2 className="text-sm font-medium text-zinc-900">Available routes</h2>
      <ul className="grid gap-2">
        {routes.map((route) => (
          <li key={route.href}>
            <Link
              className="block rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 transition hover:border-zinc-300 hover:text-zinc-900"
              href={route.href}
            >
              {route.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

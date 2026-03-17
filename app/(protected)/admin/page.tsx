import { requireAdminAccess } from "@/src/lib/auth/guards";

export default async function AdminPage() {
  await requireAdminAccess();

  return <section className="text-sm text-zinc-700">Admin page placeholder</section>;
}

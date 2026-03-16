import { AppShell } from "@/components/layout/app-shell";
import { requireProtectedAccess } from "@/src/lib/auth/guards";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { session, accessState } = await requireProtectedAccess();

  return <AppShell session={session} accessState={accessState}>{children}</AppShell>;
}

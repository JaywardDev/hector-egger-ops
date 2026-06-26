import { AppShell } from "@/components/layout/app-shell";
import { ServiceWorkerRegistrar } from "@/src/components/service-worker-registrar";
import { requireProtectedAccess } from "@/src/lib/auth/guards";

export default async function ProtectedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { session, accessState, roles, profile } = await requireProtectedAccess();

  return (
    <AppShell session={session} accessState={accessState} roles={roles} profile={profile}>
      <ServiceWorkerRegistrar />
      {children}
    </AppShell>
  );
}

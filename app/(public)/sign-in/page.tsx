import { redirect } from "next/navigation";
import { hasActiveSessionCookie } from "@/src/lib/auth/public-session";
import { AppQrCodeModalTrigger } from "@/components/share/app-qr-code-card";
import { SignInForm } from "@/app/(public)/sign-in/sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    install?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const hasActiveSession = await hasActiveSessionCookie();

  if (hasActiveSession) {
    redirect("/timesheet");
  }

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <SignInForm error={params.error} />
      <AppQrCodeModalTrigger defaultOpen={params.install === "1"} showInstallHelp />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getAuthContext } from "@/src/lib/auth/guards";
import { AppQrCodeCard } from "@/components/share/app-qr-code-card";
import { SignInForm } from "@/app/(public)/sign-in/sign-in-form";

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    install?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { accessState } = await getAuthContext();

  if (accessState === "approved") {
    redirect("/timesheet");
  }

  if (accessState === "incomplete_profile") {
    redirect("/complete-profile");
  }

  if (accessState === "pending_approval" || accessState === "disabled") {
    redirect("/pending");
  }

  const params = await searchParams;

  return (
    <div className="space-y-6">
      <SignInForm error={params.error} />
      <AppQrCodeCard showInstallHelp={params.install === "1"} />
    </div>
  );
}

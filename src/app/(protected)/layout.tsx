import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";
import { AppSidebar, MobileNav } from "@/components/layout/app-sidebar";
import { SetupBanner } from "@/components/feedback/setup-banner";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const configured = isDatabaseConfigured() && isAuthConfigured();
  const user = configured ? await getCurrentUser() : null;

  if (!configured) {
    return (
      <div className="min-h-screen bg-slate-50">
        <SetupBanner />
        <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
      </div>
    );
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <AppSidebar user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav user={user} />
        <main className="flex-1 px-4 py-4 text-[13px] leading-snug md:px-5 md:py-5">{children}</main>
      </div>
    </div>
  );
}

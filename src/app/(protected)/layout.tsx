import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";
import {
  AppSidebar,
  AppTopbar,
  MobileNav,
} from "@/components/layout/app-sidebar";
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
      <div className="min-h-screen bg-background">
        <SetupBanner />
        <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
      </div>
    );
  }

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-svh overflow-hidden bg-background">
      <AppSidebar user={user} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <MobileNav user={user} />
        <AppTopbar user={user} />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 text-[13px] leading-snug [zoom:0.9] md:px-5 md:py-5">
          {children}
        </main>
      </div>
    </div>
  );
}

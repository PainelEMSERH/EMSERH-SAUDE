import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { isAuthConfigured, isDatabaseConfigured } from "@/lib/env";
import {
  AppSidebar,
  AppTopbar,
  MobileNav,
} from "@/components/layout/app-sidebar";
import { SidebarUiProvider } from "@/components/layout/sidebar-ui";
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

  const pathname = (await headers()).get("x-pathname") ?? "";
  const onPasswordReset = pathname.startsWith("/trocar-senha");

  if (user.mustResetPassword && !onPasswordReset) {
    redirect("/trocar-senha");
  }

  if (user.mustResetPassword && onPasswordReset) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-3xl px-4 py-10">{children}</div>
      </div>
    );
  }

  return (
    <SidebarUiProvider>
      <div className="fixed top-0 left-0 flex h-[calc(100dvh/0.9)] w-[calc(100vw/0.9)] overflow-hidden bg-background">
        <AppSidebar user={user} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MobileNav user={user} />
          <AppTopbar user={user} />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 text-[13px] leading-snug md:px-6 md:py-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarUiProvider>
  );
}

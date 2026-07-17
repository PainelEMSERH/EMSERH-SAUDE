import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { assertCan, can } from "@/lib/permissions";
import type { PermissionAction, ResourceModule, SessionUser } from "@/types";

export async function requireSession(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePermission(
  module: ResourceModule,
  action: PermissionAction,
): Promise<SessionUser> {
  const user = await requireSession();
  assertCan(user, module, action);
  return user;
}

export function userCan(
  user: SessionUser,
  module: ResourceModule,
  action: PermissionAction,
) {
  return can(user, module, action);
}

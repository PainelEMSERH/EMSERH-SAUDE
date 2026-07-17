import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";

export default async function EditarColaboradorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("employees", "view");
  const { id } = await params;
  redirect(`/colaboradores/${id}?notice=alterdata-edit`);
}

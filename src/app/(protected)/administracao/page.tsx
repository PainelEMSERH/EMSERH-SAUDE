import { PageHeader } from "@/components/feedback/setup-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ensureOrgDefaults,
  listRegions,
  listUnits,
} from "@/db/queries/employees";
import { upsertRegionAction, upsertUnitAction } from "@/actions/employees";
import { requirePermission } from "@/lib/auth/guard";

export default async function AdministracaoPage() {
  const user = await requirePermission("admin", "view");
  await ensureOrgDefaults(user.id);
  const [regions, units] = await Promise.all([listRegions(), listUnits()]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Administração"
        description="Regionais, unidades e parâmetros organizacionais."
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Nova regional</h3>
          <form action={upsertRegionAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" placeholder="OESTE" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="Oeste" required />
            </div>
            <Button type="submit" className="bg-teal-700 hover:bg-teal-800">
              Salvar regional
            </Button>
          </form>
          <ul className="mt-4 space-y-1 text-sm">
            {regions.map((r) => (
              <li key={r.id} className="flex justify-between border-b py-1">
                <span>{r.name}</span>
                <span className="text-slate-500">{r.code}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Nova unidade</h3>
          <form action={upsertUnitAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="regionId">Regional</Label>
              <select
                id="regionId"
                name="regionId"
                required
                className="h-8 w-full rounded-lg border border-slate-200 px-2 text-sm"
              >
                <option value="">—</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="unitName">Nome da unidade</Label>
              <Input id="unitName" name="name" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" name="city" />
            </div>
            <Button type="submit" className="bg-teal-700 hover:bg-teal-800">
              Salvar unidade
            </Button>
          </form>
          <ul className="mt-4 max-h-64 space-y-1 overflow-auto text-sm">
            {units.map((u) => (
              <li key={u.id} className="border-b py-1">
                {u.name}
                {u.city ? ` · ${u.city}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

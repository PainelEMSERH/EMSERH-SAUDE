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
import { formatUnitDisplayName } from "@/lib/labels";

export default async function AdministracaoPage() {
  const user = await requirePermission("admin", "view");
  await ensureOrgDefaults(user.id);
  const [regions, units] = await Promise.all([listRegions(), listUnits()]);

  const byRegion = new Map<
    string,
    { label: string; items: typeof units }
  >();
  for (const u of units) {
    const key = u.regionCode ?? "SEM_REGIONAL";
    const label = u.regionName
      ? `${u.regionName} (${u.regionCode})`
      : "Sem regional";
    if (!byRegion.has(key)) byRegion.set(key, { label, items: [] });
    byRegion.get(key)!.items.push(u);
  }

  const orderedKeys = [
    "NORTE",
    "SUL",
    "LESTE",
    "CENTRO",
    ...[...byRegion.keys()].filter(
      (k) => !["NORTE", "SUL", "LESTE", "CENTRO"].includes(k),
    ),
  ].filter((k) => byRegion.has(k));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Administração"
        description="Regionais e unidades hospitalares — vínculo oficial unidade → regional."
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 font-semibold">Nova regional</h3>
          <form action={upsertRegionAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="code">Código</Label>
              <Input id="code" name="code" placeholder="NORTE" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" placeholder="Norte" required />
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
                    {r.name} ({r.code})
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
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-1 font-semibold">Unidades por regional</h3>
        <p className="mb-4 text-sm text-slate-500">
          {units.length} unidades ativas · Regionais oficiais: Norte, Sul, Leste
          e Centro (Oeste = Sul).
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {orderedKeys.map((key) => {
            const group = byRegion.get(key)!;
            return (
              <div
                key={key}
                className="rounded-lg border border-slate-100 bg-slate-50/80 p-3"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <h4 className="text-sm font-semibold text-teal-900">
                    {group.label}
                  </h4>
                  <span className="text-xs text-slate-500">
                    {group.items.length} un.
                  </span>
                </div>
                <ul className="max-h-72 space-y-1 overflow-auto text-sm">
                  {group.items.map((u) => (
                    <li
                      key={u.id}
                      className="border-b border-slate-200/80 py-1 text-slate-800"
                    >
                      {formatUnitDisplayName(u.name)}
                      {u.city ? (
                        <span className="text-slate-500"> · {u.city}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

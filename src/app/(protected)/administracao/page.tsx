import { Building2, MapPinned, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/feedback/setup-banner";
import { MirrorSyncForm } from "@/components/forms/mirror-sync-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ensureOrgDefaults,
  listRegions,
  listUnits,
} from "@/db/queries/employees";
import { upsertRegionAction, upsertUnitAction } from "@/actions/employees";
import { requirePermission, userCan } from "@/lib/auth/guard";
import { formatUnitDisplayName } from "@/lib/labels";

export default async function AdministracaoPage() {
  const user = await requirePermission("admin", "view");
  await ensureOrgDefaults(user.id);
  const [regions, units] = await Promise.all([listRegions(), listUnits()]);

  const canManageOrg = userCan(user, "admin", "manage");
  const canSync = userCan(user, "imports", "sync_global");
  const sheetConfigured = Boolean(
    process.env.ALTERDATA_MIRROR_SHEET_ID?.trim(),
  );

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
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Administração"
        description="Organização institucional e sincronização de dados."
      />

      {/* Sync */}
      <section className="app-surface overflow-hidden">
        <div className="flex items-start gap-3 border-b border-border-subtle px-5 py-4">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
            <RefreshCw className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold tracking-tight text-slate-900">
              Importação · Espelho Alterdata
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-500">
              Sincronização global dos cadastros a partir do espelho em Google
              Sheets.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          {canSync ? (
            <MirrorSyncForm sheetConfigured={sheetConfigured} />
          ) : (
            <p className="text-[13px] text-slate-500">
              Seu perfil pode consultar esta área, mas não executar a
              sincronização global.
            </p>
          )}
        </div>
      </section>

      {/* Org summary */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="app-surface flex items-center gap-3 px-4 py-3.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <MapPinned className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
              Regionais
            </p>
            <p className="text-[20px] font-semibold tracking-tight tabular-nums text-slate-900">
              {regions.length}
            </p>
          </div>
        </div>
        <div className="app-surface flex items-center gap-3 px-4 py-3.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Building2 className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.06em] text-slate-400 uppercase">
              Unidades
            </p>
            <p className="text-[20px] font-semibold tracking-tight tabular-nums text-slate-900">
              {units.length}
            </p>
          </div>
        </div>
      </div>

      {/* Create forms — only managers */}
      {canManageOrg ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="app-surface overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Nova regional
              </h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Código oficial e nome de exibição.
              </p>
            </div>
            <form action={upsertRegionAction} className="space-y-3.5 px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-[12px]">
                    Código
                  </Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="NORTE"
                    required
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[12px]">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Norte"
                    required
                    className="h-9"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="h-9 bg-primary hover:bg-primary-hover"
              >
                Salvar regional
              </Button>
            </form>
            <ul className="divide-y divide-border-subtle border-t border-border-subtle">
              {regions.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]"
                >
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-500 tabular-nums">
                    {r.code}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="app-surface overflow-hidden">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <h3 className="text-[14px] font-semibold text-slate-900">
                Nova unidade
              </h3>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Vincula a unidade à regional correspondente.
              </p>
            </div>
            <form action={upsertUnitAction} className="space-y-3.5 px-5 py-4">
              <div className="space-y-1.5">
                <Label htmlFor="regionId" className="text-[12px]">
                  Regional
                </Label>
                <select
                  id="regionId"
                  name="regionId"
                  required
                  className="h-9 w-full rounded-lg border border-border bg-white px-2.5 text-[13px]"
                >
                  <option value="">Selecionar…</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unitName" className="text-[12px]">
                  Nome da unidade
                </Label>
                <Input id="unitName" name="name" required className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-[12px]">
                  Cidade
                </Label>
                <Input id="city" name="city" className="h-9" />
              </div>
              <Button
                type="submit"
                className="h-9 bg-primary hover:bg-primary-hover"
              >
                Salvar unidade
              </Button>
            </form>
          </div>
        </section>
      ) : null}

      {/* Units by region */}
      <section className="app-surface overflow-hidden">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <h3 className="text-[14px] font-semibold text-slate-900">
            Unidades por regional
          </h3>
          <p className="mt-0.5 text-[12px] text-slate-500">
            {units.length} unidades ativas · Norte, Sul, Leste e Centro (Oeste =
            Sul).
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2">
          {orderedKeys.map((key) => {
            const group = byRegion.get(key)!;
            return (
              <div
                key={key}
                className="overflow-hidden rounded-xl border border-border-subtle bg-slate-50/80"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-border-subtle px-3.5 py-2.5">
                  <h4 className="text-[13px] font-semibold text-emerald-800">
                    {group.label}
                  </h4>
                  <span className="text-[11px] font-medium tabular-nums text-slate-400">
                    {group.items.length}
                  </span>
                </div>
                <ul className="max-h-64 overflow-auto">
                  {group.items.map((u) => (
                    <li
                      key={u.id}
                      className="border-b border-border-subtle/80 px-3.5 py-2 text-[12.5px] text-slate-700 last:border-b-0"
                    >
                      <span className="font-medium">
                        {formatUnitDisplayName(u.name)}
                      </span>
                      {u.city ? (
                        <span className="text-slate-400"> · {u.city}</span>
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

import type { SessionUser } from "@/types";
import { MONTH_NAMES } from "@/lib/aso/constants";

export type DashboardFilterParams = {
  year?: string;
  month?: string;
  regionId?: string;
  unitId?: string;
  chart?: string;
};

export type DashboardFilters = {
  year: number;
  month: number;
  regionId: string;
  unitId: string;
  chart: "aderencia" | "vencidos";
};

/** Espelha clampScope do painel ASO — URL não amplia escopo. */
export function clampDashboardScope(
  user: SessionUser,
  regionId: string,
  unitId: string,
): { regionId: string; unitId: string } {
  let r = regionId === "ALL" ? "" : regionId;
  let u = unitId === "ALL" ? "" : unitId;

  if (user.scopeLevel === "UNIT") {
    if (user.unitIds.length === 1) u = user.unitIds[0];
    else if (u && !user.unitIds.includes(u)) u = user.unitIds[0] ?? "";
    else if (!u) u = user.unitIds[0] ?? "";
    r = "";
  } else if (user.scopeLevel === "REGION") {
    if (r && !user.regionIds.includes(r)) r = "";
    if (!r && user.regionIds.length === 1) r = user.regionIds[0];
    if (r && !user.regionIds.includes(r)) r = user.regionIds[0] ?? "";
  }

  return { regionId: r, unitId: u };
}

export function parseDashboardFilters(
  user: SessionUser,
  params: DashboardFilterParams,
): DashboardFilters {
  const now = new Date();
  let year = Number(params.year);
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    year = now.getFullYear();
  }
  let month = Number(params.month);
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    month = now.getMonth() + 1;
  }

  const scoped = clampDashboardScope(
    user,
    params.regionId || "",
    params.unitId || "",
  );

  const chart =
    params.chart === "vencidos" ? "vencidos" : ("aderencia" as const);

  return {
    year,
    month,
    regionId: scoped.regionId,
    unitId: scoped.unitId,
    chart,
  };
}

export function buildDashboardUrl(
  current: Record<string, string | number | undefined>,
  overrides: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (!str || str === "ALL") continue;
    params.set(key, str);
  }
  const qs = params.toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export function dashboardContextLabel(input: {
  year: number;
  month: number;
  regionName?: string | null;
  unitName?: string | null;
  regionId?: string;
  unitId?: string;
}): string {
  const period = `${MONTH_NAMES[input.month - 1]}/${input.year}`;
  if (input.unitId && input.unitName) {
    return `${input.unitName} · ${period}`;
  }
  if (input.regionId && input.regionName) {
    return `Regional ${input.regionName} · ${period}`;
  }
  return `Consolidado EMSERH · ${period}`;
}

export function asoModuleHref(
  filters: DashboardFilters,
  extra: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set("year", String(filters.year));
  params.set("month", String(filters.month));
  if (filters.regionId) params.set("regionId", filters.regionId);
  if (filters.unitId) params.set("unitId", filters.unitId);
  for (const [k, v] of Object.entries(extra)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (!s || s === "ALL") continue;
    params.set(k, s);
  }
  return `/asos?${params.toString()}`;
}

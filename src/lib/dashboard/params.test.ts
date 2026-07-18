import { describe, expect, it } from "vitest";
import { consolidateWeighted } from "@/lib/aso/indicators";
import {
  clampDashboardScope,
  dashboardContextLabel,
  parseDashboardFilters,
} from "@/lib/dashboard/params";
import type { SessionUser } from "@/types";

function user(partial: Partial<SessionUser> & Pick<SessionUser, "scopeLevel">): SessionUser {
  return {
    id: "u1",
    email: "a@b.c",
    name: "Test",
    role: "ADMIN_CENTRAL",
    regionIds: [],
    unitIds: [],
    mustResetPassword: false,
    ...partial,
  };
}

describe("dashboard scope", () => {
  it("usuário central pode ver consolidado e regionais", () => {
    const u = user({ scopeLevel: "EMSERH" });
    const scoped = clampDashboardScope(u, "reg-1", "");
    expect(scoped.regionId).toBe("reg-1");
    expect(scoped.unitId).toBe("");
  });

  it("usuário regional fica restrito à própria regional", () => {
    const u = user({
      scopeLevel: "REGION",
      regionIds: ["reg-sul"],
      role: "COORDENACAO_REGIONAL",
    });
    const forced = clampDashboardScope(u, "reg-outra", "");
    expect(forced.regionId).toBe("reg-sul");
    const ok = clampDashboardScope(u, "reg-sul", "");
    expect(ok.regionId).toBe("reg-sul");
  });

  it("usuário de unidade não amplia escopo pela URL", () => {
    const u = user({
      scopeLevel: "UNIT",
      unitIds: ["unit-a"],
      role: "OPERADOR_UNIDADE",
    });
    const scoped = clampDashboardScope(u, "qualquer", "unit-b");
    expect(scoped.unitId).toBe("unit-a");
    expect(scoped.regionId).toBe("");
  });

  it("parseDashboardFilters aplica defaults e clamp", () => {
    const u = user({
      scopeLevel: "REGION",
      regionIds: ["r1"],
      role: "COORDENACAO_REGIONAL",
    });
    const f = parseDashboardFilters(u, {
      year: "2026",
      month: "7",
      regionId: "outra",
    });
    expect(f.year).toBe(2026);
    expect(f.month).toBe(7);
    expect(f.regionId).toBe("r1");
  });
});

describe("dashboard labels", () => {
  it("monta contexto EMSERH / regional / unidade", () => {
    expect(
      dashboardContextLabel({ year: 2026, month: 7 }),
    ).toBe("Consolidado EMSERH · Julho/2026");
    expect(
      dashboardContextLabel({
        year: 2026,
        month: 7,
        regionId: "x",
        regionName: "Sul",
      }),
    ).toBe("Regional Sul · Julho/2026");
  });
});

describe("aderência ponderada (paridade com ASO)", () => {
  it("não usa média simples de percentuais", () => {
    const weighted = consolidateWeighted([
      { realizados: 90, previstosElegiveis: 100 },
      { realizados: 10, previstosElegiveis: 100 },
    ]);
    expect(weighted.percent).toBe(50);
    // média simples seria (90+10)/2 = 50 coincidência; outro caso:
    const w2 = consolidateWeighted([
      { realizados: 100, previstosElegiveis: 100 },
      { realizados: 0, previstosElegiveis: 900 },
    ]);
    expect(w2.percent).toBe(10);
    const naiveAvg = (100 + 0) / 2;
    expect(w2.percent).not.toBe(naiveAvg);
  });

  it("mês futuro / sem denominador não vira zero realizado inventado", () => {
    const empty = consolidateWeighted([
      { realizados: 0, previstosElegiveis: 0 },
    ]);
    expect(empty.percent).toBeNull();
  });
});

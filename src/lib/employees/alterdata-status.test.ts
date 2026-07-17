import { describe, expect, it } from "vitest";
import {
  functionalStatusForCompetence,
  isActiveLeavePeriod,
  mapAlterdataFunctionalStatus,
  periodOverlapsCompetence,
} from "./alterdata-status";

describe("isActiveLeavePeriod", () => {
  it("Raimundo: 2025-01-01 a 2028-12-31 ativo em jul/2026", () => {
    expect(
      isActiveLeavePeriod("2025-01-01", "2028-12-31", "2026-07-17"),
    ).toBe(true);
  });

  it("aceita serial Excel", () => {
    expect(isActiveLeavePeriod(45658, 47118, "2026-07-17")).toBe(true);
  });

  it("fora do intervalo não é ativo", () => {
    expect(
      isActiveLeavePeriod("2025-01-01", "2025-06-01", "2026-07-17"),
    ).toBe(false);
  });
});

describe("periodOverlapsCompetence / functionalStatusForCompetence", () => {
  it("Gabriela: férias 08/07–06/08 não afetam janeiro", () => {
    expect(
      periodOverlapsCompetence("2026-07-08", "2026-08-06", 2026, 1),
    ).toBe(false);
    expect(
      functionalStatusForCompetence({
        feriasStartRaw: "2026-07-08",
        feriasEndRaw: "2026-08-06",
        year: 2026,
        month: 1,
      }),
    ).toBe("ATIVO");
  });

  it("férias parciais em janeiro (até dia 7) NÃO tiram da meta", () => {
    // Charlene / Suzana / Thamires: 09/12/2025–07/01/2026
    expect(
      functionalStatusForCompetence({
        feriasStartRaw: "2025-12-09",
        feriasEndRaw: "2026-01-07",
        year: 2026,
        month: 1,
      }),
    ).toBe("ATIVO");
    // Zaira: 07/01–05/02 — havia 01–06
    expect(
      functionalStatusForCompetence({
        feriasStartRaw: "2026-01-07",
        feriasEndRaw: "2026-02-05",
        year: 2026,
        month: 1,
      }),
    ).toBe("ATIVO");
  });

  it("férias cobrindo o mês inteiro tiram da meta", () => {
    expect(
      functionalStatusForCompetence({
        feriasStartRaw: "2025-12-15",
        feriasEndRaw: "2026-02-01",
        year: 2026,
        month: 1,
      }),
    ).toBe("FERIAS");
  });

  it("férias em julho cobrindo julho inteiro", () => {
    expect(
      functionalStatusForCompetence({
        feriasStartRaw: "2026-07-01",
        feriasEndRaw: "2026-07-31",
        year: 2026,
        month: 7,
      }),
    ).toBe("FERIAS");
  });
});

describe("mapAlterdataFunctionalStatus", () => {
  it("marca AFASTADO pelas datas mesmo com Status_ASO=VENCIDO", () => {
    expect(
      mapAlterdataFunctionalStatus({
        statusAso: "VENCIDO",
        leaveStartRaw: 45658,
        leaveEndRaw: 47118,
        todayIso: "2026-07-17",
      }),
    ).toBe("AFASTADO");
  });

  it("Status_Férias=Férias com início futuro não marca férias em jan", () => {
    expect(
      mapAlterdataFunctionalStatus({
        statusFerias: "Férias",
        feriasStartRaw: "2026-07-08",
        feriasEndRaw: "2026-08-06",
        todayIso: "2026-01-15",
      }),
    ).toBe("ATIVO");
  });
});

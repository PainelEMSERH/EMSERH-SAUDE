import { describe, expect, it } from "vitest";
import {
  isActiveLeavePeriod,
  mapAlterdataFunctionalStatus,
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

describe("mapAlterdataFunctionalStatus leave dates", () => {
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

  it("sem datas e sem texto permanece ATIVO", () => {
    expect(
      mapAlterdataFunctionalStatus({
        statusAso: "VENCIDO",
        todayIso: "2026-07-17",
      }),
    ).toBe("ATIVO");
  });
});

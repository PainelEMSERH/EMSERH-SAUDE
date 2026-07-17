import { describe, expect, it } from "vitest";
import {
  dismissedBeforeCompetence,
  dismissedBeforeYear,
  eligibilityFromFunctionalStatus,
} from "./planning";

describe("dismissedBeforeYear / competence", () => {
  it("Cassiana demitida em 2025-01-06 fica fora de 2026", () => {
    expect(dismissedBeforeYear("2025-01-06", 2026)).toBe(true);
    expect(dismissedBeforeCompetence("2025-01-06", 2026, 1)).toBe(true);
  });

  it("demitido em março/2026 ainda conta em janeiro/2026", () => {
    expect(dismissedBeforeCompetence("2026-03-15", 2026, 1)).toBe(false);
    expect(dismissedBeforeCompetence("2026-03-15", 2026, 3)).toBe(false);
    expect(dismissedBeforeCompetence("2026-03-15", 2026, 4)).toBe(true);
  });
});

describe("eligibilityFromFunctionalStatus", () => {
  it("DEMITIDO não vira justificado de periódico", () => {
    expect(eligibilityFromFunctionalStatus("DEMITIDO")).toEqual({
      eligibility: "ELEGIVEL",
      reason: null,
    });
  });

  it("AFASTADO continua justificado", () => {
    expect(eligibilityFromFunctionalStatus("AFASTADO").reason).toBe("AFASTADO");
  });
});

import { describe, expect, it } from "vitest";
import {
  hasAdmissionAsoEvidence,
  resolveTrustedPeriodicNext,
} from "./prediction";

describe("resolveTrustedPeriodicNext", () => {
  it("Sulany: admissão jan/2026 — não agenda periódico em 2026 pelo Proximo_aso de jul", () => {
    const r = resolveTrustedPeriodicNext({
      admissionDate: "2026-01-07",
      lastAsoDate: "2026-06-22",
      alterdataNextDate: "2026-07-01",
      periodicityMonths: 12,
    });
    expect(r.admissionAsoEvidence).toBe(true);
    expect(r.trust).toBe("RECOMPUTED_FROM_LAST");
    expect(r.nextPeriodicDate).toBe("2027-06-22");
  });

  it("Ellizeuda: Proximo_aso antes do atestado → recalcula pelo atestado", () => {
    const r = resolveTrustedPeriodicNext({
      admissionDate: "2020-06-15",
      lastAsoDate: "2026-02-06",
      alterdataNextDate: "2026-01-13",
      periodicityMonths: 12,
    });
    expect(r.trust).toBe("RECOMPUTED_FROM_LAST");
    expect(r.nextPeriodicDate).toBe("2027-02-06");
  });

  it("confia no Alterdata quando consistente", () => {
    const r = resolveTrustedPeriodicNext({
      admissionDate: "2020-06-15",
      lastAsoDate: "2025-03-10",
      alterdataNextDate: "2026-03-10",
      periodicityMonths: 12,
    });
    expect(r.trust).toBe("ALTERDATA");
    expect(r.nextPeriodicDate).toBe("2026-03-10");
  });

  it("sem Proximo_aso usa atestado + periodicidade", () => {
    const r = resolveTrustedPeriodicNext({
      admissionDate: "2020-01-01",
      lastAsoDate: "2025-08-15",
      alterdataNextDate: null,
      periodicityMonths: 12,
    });
    expect(r.trust).toBe("RECOMPUTED_FROM_LAST");
    expect(r.nextPeriodicDate).toBe("2026-08-15");
  });
});

describe("hasAdmissionAsoEvidence", () => {
  it("detecta atestado após admissão", () => {
    expect(hasAdmissionAsoEvidence("2026-01-07", "2026-06-22")).toBe(true);
    expect(hasAdmissionAsoEvidence("2026-01-07", "2025-12-01")).toBe(false);
    expect(hasAdmissionAsoEvidence("2026-01-07", null)).toBe(false);
  });

  it("Viktoria: Ultimo_aso pré-admissão + Proximo_aso após admissão = admissional evidenciado", () => {
    expect(
      hasAdmissionAsoEvidence("2026-01-16", "2025-12-04", "2026-12-04"),
    ).toBe(true);
  });
});

describe("resolveTrustedPeriodicNext — recontratação", () => {
  it("Viktoria: confia no Proximo_aso 04/12/2026 apesar do Ultimo_aso pré-admissão", () => {
    const r = resolveTrustedPeriodicNext({
      admissionDate: "2026-01-16",
      lastAsoDate: "2025-12-04",
      alterdataNextDate: "2026-12-04",
      periodicityMonths: 12,
    });
    expect(r.admissionAsoEvidence).toBe(true);
    expect(r.trust).toBe("ALTERDATA");
    expect(r.nextPeriodicDate).toBe("2026-12-04");
  });
});

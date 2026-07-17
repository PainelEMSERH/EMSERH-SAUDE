import { describe, expect, it } from "vitest";
import { reconcileAlterdataStatus } from "./reconciliation";

describe("reconcileAlterdataStatus", () => {
  it("cenário 1: confirmado quando próximo ASO avança após realização", () => {
    const status = reconcileAlterdataStatus({
      performedDate: "2026-07-15",
      periodicityMonths: 12,
      snapshots: [
        { nextAsoDate: "2026-07-15", syncedAt: "2026-06-01T10:00:00Z" },
        { nextAsoDate: "2027-07-15", syncedAt: "2026-07-20T10:00:00Z" },
      ],
    });
    expect(status).toBe("CONFIRMADO");
  });

  it("cenário 2: pendente quando sync posterior mantém a mesma data", () => {
    const status = reconcileAlterdataStatus({
      performedDate: "2026-07-15",
      periodicityMonths: 12,
      snapshots: [
        { nextAsoDate: "2026-07-15", syncedAt: "2026-06-01T10:00:00Z" },
        { nextAsoDate: "2026-07-15", syncedAt: "2026-07-20T10:00:00Z" },
      ],
    });
    expect(status).toBe("PENDENTE_ATUALIZACAO");
  });

  it("cenário 3: aguardando quando não há sync posterior à realização", () => {
    const status = reconcileAlterdataStatus({
      performedDate: "2026-07-15",
      periodicityMonths: 12,
      snapshots: [{ nextAsoDate: "2026-07-15", syncedAt: "2026-06-01T10:00:00Z" }],
    });
    expect(status).toBe("AGUARDANDO_SINCRONIZACAO");
  });

  it("cenário 4: atualizado sem registro interno", () => {
    const status = reconcileAlterdataStatus({
      performedDate: null,
      snapshots: [
        { nextAsoDate: "2026-07-15", syncedAt: "2026-06-01T10:00:00Z" },
        { nextAsoDate: "2027-07-15", syncedAt: "2026-08-01T10:00:00Z" },
      ],
    });
    expect(status).toBe("ATUALIZADO_SEM_REGISTRO");
  });

  it("cenário 5: divergência de data incompatível com o ciclo", () => {
    const status = reconcileAlterdataStatus({
      performedDate: "2026-07-15",
      periodicityMonths: 12,
      snapshots: [
        { nextAsoDate: "2026-07-15", syncedAt: "2026-06-01T10:00:00Z" },
        { nextAsoDate: "2026-09-01", syncedAt: "2026-07-20T10:00:00Z" },
      ],
    });
    expect(status).toBe("DIVERGENCIA_DATA");
  });

  it("cenário 6: sem histórico suficiente com um único snapshot", () => {
    const status = reconcileAlterdataStatus({
      performedDate: null,
      snapshots: [{ nextAsoDate: "2026-07-15", syncedAt: "2026-06-01T10:00:00Z" }],
    });
    expect(status).toBe("SEM_HISTORICO");
  });
});

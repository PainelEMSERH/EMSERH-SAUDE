import { describe, expect, it } from "vitest";
import { resolveLeaveReturnInfo } from "@/lib/leaves/status";

describe("resolveLeaveReturnInfo", () => {
  it("Janira: fim 02/06 + last ASO 12/06 → ASO ok / encerrado", () => {
    const info = resolveLeaveReturnInfo({
      leaveType: "01 - Afast. por motivo de doen",
      status: "ATIVO",
      startDate: "2026-05-29",
      endDate: "2026-06-02",
      lastAsoDate: "2026-06-12",
      now: new Date("2026-07-17T15:00:00"),
    });
    expect(info.displayStatus).toBe("ENCERRADO");
    expect(info.returnDone).toBe(true);
    expect(info.returnLabel).toBe("ASO ok");
  });

  it("período ainda aberto sem ASO → Em afastamento", () => {
    const info = resolveLeaveReturnInfo({
      leaveType: "01 - Afast. por motivo de doen",
      status: "ATIVO",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      lastAsoDate: "2025-01-01",
      now: new Date("2026-07-17T15:00:00"),
    });
    expect(info.displayStatus).toBe("ATIVO");
    expect(info.returnLabel).toBe("Em afastamento");
  });

  it("período encerrado sem ASO → pendente", () => {
    const info = resolveLeaveReturnInfo({
      leaveType: "01 - Afast. por motivo de doen",
      status: "ATIVO",
      startDate: "2026-05-01",
      endDate: "2026-05-20",
      lastAsoDate: "2025-01-01",
      now: new Date("2026-07-17T15:00:00"),
    });
    expect(info.displayStatus).toBe("ENCERRADO");
    expect(info.returnLabel).toBe("ASO pendente");
  });

  it("atestado não exige retorno ASO", () => {
    const info = resolveLeaveReturnInfo({
      leaveType: "10 - Atestados",
      status: "ATIVO",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      now: new Date("2026-07-17T15:00:00"),
    });
    expect(info.needsReturnAso).toBe(false);
    expect(info.returnLabel).toBe("—");
    expect(info.displayStatus).toBe("ENCERRADO");
  });
});

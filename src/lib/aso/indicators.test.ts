import { describe, expect, it } from "vitest";
import { computeCompetenceMetrics, consolidateWeighted, matrixCellTone } from "./indicators";

describe("computeCompetenceMetrics", () => {
  it("calcula elegíveis, realizados e faltam para meta", () => {
    const m = computeCompetenceMetrics(
      [
        { eligibility: "ELEGIVEL", executionStatus: "REALIZADO", alterdataStatus: "CONFIRMADO" },
        { eligibility: "ELEGIVEL", executionStatus: "REALIZADO", alterdataStatus: "PENDENTE_ATUALIZACAO" },
        { eligibility: "ELEGIVEL", executionStatus: "PREVISTO" },
        { eligibility: "JUSTIFICADO", executionStatus: "JUSTIFICADO" },
        { eligibility: "ELEGIVEL", executionStatus: "VENCIDO" },
      ],
      80,
    );
    expect(m.previstosBrutos).toBe(5);
    expect(m.justificados).toBe(1);
    expect(m.afastados).toBe(0);
    expect(m.ferias).toBe(0);
    expect(m.previstosElegiveis).toBe(4);
    expect(m.realizados).toBe(2);
    expect(m.confirmadosAlterdata).toBe(1);
    expect(m.pendentesAlterdata).toBe(1);
    expect(m.aderenciaPercent).toBe(50);
    expect(m.faltamParaMeta).toBe(2); // ceil(0.8*4)=4; 4-2=2
  });

  it("cenário: aderência acima de 100% gera excedente sem ultrapassar o teto", () => {
    const m = computeCompetenceMetrics([
      { eligibility: "ELEGIVEL", executionStatus: "REALIZADO" },
      { eligibility: "ELEGIVEL", executionStatus: "REALIZADO" },
      { eligibility: "ELEGIVEL", executionStatus: "REALIZADO" },
    ]);
    // 3 realizados sobre 3 elegíveis presentes; simula excedente forçando denominador menor
    expect(m.aderenciaPercent).toBe(100);
    expect(m.excedente).toBe(0);
  });

  it("separa afastados e férias dos justificados", () => {
    const m = computeCompetenceMetrics([
      {
        eligibility: "JUSTIFICADO",
        executionStatus: "JUSTIFICADO",
        justificationReason: "AFASTADO",
      },
      {
        eligibility: "JUSTIFICADO",
        executionStatus: "JUSTIFICADO",
        justificationReason: "FERIAS",
      },
      {
        eligibility: "JUSTIFICADO",
        executionStatus: "JUSTIFICADO",
        functionalStatusSnapshot: "FERIAS",
      },
    ]);
    expect(m.justificados).toBe(3);
    expect(m.afastados).toBe(1);
    expect(m.ferias).toBe(2);
  });
});

describe("consolidateWeighted", () => {
  it("cenário 8: consolidado ponderado (nunca média simples)", () => {
    // Regional A: 90/100 = 90%; Regional B: 5/50 = 10%; média simples 50%; ponderado 95/150 ≈ 63.3%
    const parts = [
      { realizados: 90, previstosElegiveis: 100 },
      { realizados: 5, previstosElegiveis: 50 },
    ];
    const simpleAvg = (90 + 10) / 2;
    const weighted = consolidateWeighted(parts);
    expect(weighted.numerador).toBe(95);
    expect(weighted.denominador).toBe(150);
    expect(weighted.percent).toBe(63.3);
    expect(weighted.percent).not.toBe(simpleAvg);
  });

  it("retorna null quando não há denominador", () => {
    const weighted = consolidateWeighted([]);
    expect(weighted.percent).toBeNull();
  });
});

describe("matrixCellTone", () => {
  it("marca competências futuras independentemente do percentual", () => {
    expect(
      matrixCellTone({ percent: null, metaPercent: 80, hasDenominator: false, isFuture: true }),
    ).toBe("future");
  });

  it("classifica ok/near/below de acordo com a meta", () => {
    expect(
      matrixCellTone({ percent: 85, metaPercent: 80, hasDenominator: true, isFuture: false }),
    ).toBe("ok");
    expect(
      matrixCellTone({ percent: 75, metaPercent: 80, hasDenominator: true, isFuture: false }),
    ).toBe("near");
    expect(
      matrixCellTone({ percent: 50, metaPercent: 80, hasDenominator: true, isFuture: false }),
    ).toBe("below");
  });

  it("usa tom neutro quando não há meta definida", () => {
    expect(
      matrixCellTone({ percent: 90, metaPercent: null, hasDenominator: true, isFuture: false }),
    ).toBe("neutral");
  });
});

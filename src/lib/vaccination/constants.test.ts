import { describe, expect, it } from "vitest";
import {
  classifySituation,
  parseVaccinationNotes,
  situationCompactLabel,
  summarizeVaccinationKit,
} from "@/lib/vaccination/constants";

describe("parseVaccinationNotes", () => {
  it("extrai situações por vacina", () => {
    const parsed = parseVaccinationNotes(
      "TETANO: 1,2 e 3 dose | HEPATITE_B: Ant Hbs Reagente | COVID: Termo de Recusa",
    );
    expect(parsed.TETANO).toBe("1,2 e 3 dose");
    expect(parsed.HEPATITE_B).toBe("Ant Hbs Reagente");
    expect(parsed.COVID).toBe("Termo de Recusa");
  });
});

describe("classifySituation", () => {
  it("classifica recusa, ok e atenção", () => {
    expect(classifySituation("COVID", "Termo de Recusa")).toBe("refusal");
    expect(classifySituation("TETANO", "1,2 e 3 dose")).toBe("ok");
    expect(classifySituation("TETANO", "Dose de reforço mais de 10 anos")).toBe(
      "attention",
    );
    expect(classifySituation("HEPATITE_B", "1 e 2 dose")).toBe("partial");
  });
});

describe("summarizeVaccinationKit", () => {
  it("marca kit completo só com 6/6 em dia", () => {
    const kit = summarizeVaccinationKit({
      TETANO: "1,2 e 3 dose",
      HEPATITE_B: "Ant Hbs Reagente",
      TRIPLICE: "1  dose Maior de 29 anos",
      FEBRE_AMARELA: "1  dose",
      H1N1: "1 dose menos de um ano",
      COVID: "1 dose menos de um ano",
    });
    expect(kit.kitComplete).toBe(true);
    expect(kit.kitLabel).toBe("Kit completo");
  });

  it("incompleto quando falta vacina", () => {
    const kit = summarizeVaccinationKit({
      TETANO: "1,2 e 3 dose",
      HEPATITE_B: "1 e 2 dose",
    });
    expect(kit.kitComplete).toBe(false);
    expect(kit.missingCount).toBe(4);
  });
});

describe("situationCompactLabel", () => {
  it("abrevia rótulos longos da planilha", () => {
    expect(situationCompactLabel("Dose de reforço menos de 10 anos")).toBe(
      "Reforço <10a",
    );
    expect(situationCompactLabel("Dose de reforço mais de 10 anos")).toBe(
      "Reforço >10a",
    );
    expect(situationCompactLabel("1 dose menos de um ano")).toBe("<1 ano");
    expect(situationCompactLabel("1  dose Maior de 29 anos")).toBe(
      "1 dose >29a",
    );
    expect(situationCompactLabel("Termo de Recusa")).toBe("Recusa");
    expect(situationCompactLabel("Ant Hbs Reagente")).toBe("Ant HBs+");
  });
});

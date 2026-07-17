import { describe, expect, it } from "vitest";
import {
  classifySituation,
  parseVaccinationNotes,
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

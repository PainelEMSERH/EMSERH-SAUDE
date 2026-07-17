import { describe, expect, it } from "vitest";
import { formatAdherencePercent } from "./format-percent";

describe("formatAdherencePercent", () => {
  it("100% somente quando numerador = denominador", () => {
    expect(
      formatAdherencePercent(100, { realizados: 283, elegiveis: 283 }),
    ).toBe("100%");
    expect(
      formatAdherencePercent(99.547, { realizados: 440, elegiveis: 442 }),
    ).toBe("99,5%");
    expect(
      formatAdherencePercent(99.526, { realizados: 420, elegiveis: 422 }),
    ).toBe("99,5%");
    expect(
      formatAdherencePercent(99.404, { realizados: 334, elegiveis: 336 }),
    ).toBe("99,4%");
  });

  it("não mostra 100% por arredondamento quando falta alguém", () => {
    expect(
      formatAdherencePercent(100, { realizados: 441, elegiveis: 442 }),
    ).toBe("99,8%");
  });
});

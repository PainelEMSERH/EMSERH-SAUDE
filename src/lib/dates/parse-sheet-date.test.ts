import { describe, expect, it } from "vitest";
import { parseSheetDate } from "./index";

describe("parseSheetDate", () => {
  it("interpreta DD/MM/YYYY como data brasileira", () => {
    expect(parseSheetDate("04/08/2026")).toBe("2026-08-04");
    expect(parseSheetDate("08/04/2026")).toBe("2026-04-08");
    expect(parseSheetDate("4/8/2025")).toBe("2025-08-04");
  });

  it("não usa new Date() americano em barras", () => {
    // Regressão: new Date("04/08/2026") === 2026-04-08 (US)
    expect(parseSheetDate("04/08/2026")).not.toBe("2026-04-08");
  });

  it("aceita ISO e serial Excel", () => {
    expect(parseSheetDate("2026-08-04")).toBe("2026-08-04");
    expect(parseSheetDate(46238)).toBe("2026-08-04");
    expect(parseSheetDate("46238")).toBe("2026-08-04");
  });

  it("rejeita vazio", () => {
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate(null)).toBeNull();
  });
});

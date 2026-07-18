import { describe, expect, it } from "vitest";
import { parseBooleanPtBr } from "./boolean-pt";

describe("parseBooleanPtBr", () => {
  it("aceita afirmativos comuns", () => {
    expect(parseBooleanPtBr("SIM")).toBe(true);
    expect(parseBooleanPtBr("S")).toBe(true);
    expect(parseBooleanPtBr("1")).toBe(true);
    expect(parseBooleanPtBr("REALIZADA")).toBe(true);
    expect(parseBooleanPtBr(true)).toBe(true);
  });

  it("rejeita negativos e vazio (não usa Boolean() de string)", () => {
    expect(parseBooleanPtBr("NÃO")).toBe(false);
    expect(parseBooleanPtBr("NAO")).toBe(false);
    expect(parseBooleanPtBr("N")).toBe(false);
    expect(parseBooleanPtBr("0")).toBe(false);
    expect(parseBooleanPtBr("")).toBe(false);
    expect(parseBooleanPtBr(null)).toBe(false);
    expect(parseBooleanPtBr(false)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  resolveFollowupDisplay,
  summarizeFollowups,
  bioStatusLabel,
} from "@/lib/biological/constants";

describe("resolveFollowupDisplay", () => {
  it("marca atrasado quando dueDate passou", () => {
    expect(resolveFollowupDisplay("PENDENTE", "2026-01-01", "2026-07-17")).toEqual({
      overdue: true,
      displayStatus: "ATRASADO",
    });
  });

  it("mantém pendente no prazo", () => {
    expect(resolveFollowupDisplay("PENDENTE", "2026-12-01", "2026-07-17")).toEqual({
      overdue: false,
      displayStatus: "PENDENTE",
    });
  });

  it("realizado não atrasa", () => {
    expect(resolveFollowupDisplay("REALIZADO", "2026-01-01", "2026-07-17")).toEqual({
      overdue: false,
      displayStatus: "REALIZADO",
    });
  });
});

describe("summarizeFollowups", () => {
  it("prioriza atrasados no resumo", () => {
    const s = summarizeFollowups([
      {
        id: "1",
        dayOffset: 30,
        dueDate: "2026-01-01",
        performedAt: null,
        status: "PENDENTE",
        notes: null,
        overdue: true,
        displayStatus: "ATRASADO",
      },
      {
        id: "2",
        dayOffset: 60,
        dueDate: "2026-08-01",
        performedAt: null,
        status: "PENDENTE",
        notes: null,
        overdue: false,
        displayStatus: "PENDENTE",
      },
      {
        id: "3",
        dayOffset: 90,
        dueDate: "2026-09-01",
        performedAt: null,
        status: "PENDENTE",
        notes: null,
        overdue: false,
        displayStatus: "PENDENTE",
      },
    ]);
    expect(s.summaryTone).toBe("danger");
    expect(s.overdueCount).toBe(1);
  });
});

describe("bioStatusLabel", () => {
  it("abreviado operacional", () => {
    expect(bioStatusLabel("EM_ACOMPANHAMENTO")).toBe("Em acomp.");
    expect(bioStatusLabel("CONCLUIDO")).toBe("Concluído");
  });
});

/**
 * Status operacional de afastamento + retorno ASO.
 * Fontes: leave_records + último espelho Alterdata.
 */

import { leaveRequiresReturnAso } from "@/lib/leaves/constants";

export type LeaveReturnTone = "ok" | "warn" | "danger" | "muted";

export type LeaveReturnInfo = {
  /** Status exibido (pode fechar automaticamente se o período já acabou). */
  displayStatus: "ATIVO" | "ENCERRADO";
  /** Precisa de ASO de retorno (tipo 01 / INSS etc.). */
  needsReturnAso: boolean;
  /** Rótulo curto na coluna Retorno. */
  returnLabel: string;
  returnTone: LeaveReturnTone;
  /** ASO de retorno evidenciado no Alterdata ou no registro. */
  returnDone: boolean;
  /** Data do último ASO usada como evidência (yyyy-mm-dd). */
  lastAsoDate: string | null;
};

function dayOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Resolve status de exibição e retorno ASO.
 *
 * Regras:
 * - Se há data fim < hoje → trata como ENCERRADO na UI (mesmo se import veio ATIVO)
 * - Tipo que exige retorno: last_aso ≥ fim do afastamento → retorno OK (não pendente)
 * - Sem evidência e período já acabou → ASO pendente
 * - Ainda no período → "Em afastamento" (não cobra ASO antes do fim)
 */
export function resolveLeaveReturnInfo(input: {
  leaveType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  actualReturnDate?: string | null;
  requiresReturnAso?: boolean | null;
  lastAsoDate?: string | null;
  now?: Date;
}): LeaveReturnInfo {
  const start = dayOnly(input.startDate);
  const end = dayOnly(input.endDate);
  const actual = dayOnly(input.actualReturnDate);
  const lastAso = dayOnly(input.lastAsoDate);
  const today = todayIso(input.now);
  const needsReturnAso =
    Boolean(input.requiresReturnAso) || leaveRequiresReturnAso(input.leaveType);

  const periodEnded = Boolean(end && end < today);
  const displayStatus: "ATIVO" | "ENCERRADO" =
    input.status === "ENCERRADO" || periodEnded || Boolean(actual)
      ? "ENCERRADO"
      : "ATIVO";

  if (!needsReturnAso) {
    return {
      displayStatus,
      needsReturnAso: false,
      returnLabel: "—",
      returnTone: "muted",
      returnDone: false,
      lastAsoDate: lastAso,
    };
  }

  const anchor = end ?? start;
  const returnDone = Boolean(
    actual || (lastAso && anchor && lastAso >= anchor),
  );

  if (returnDone) {
    return {
      displayStatus: "ENCERRADO",
      needsReturnAso: true,
      returnLabel: "ASO ok",
      returnTone: "ok",
      returnDone: true,
      lastAsoDate: lastAso,
    };
  }

  if (!periodEnded && displayStatus === "ATIVO") {
    return {
      displayStatus: "ATIVO",
      needsReturnAso: true,
      returnLabel: "Em afastamento",
      returnTone: "warn",
      returnDone: false,
      lastAsoDate: lastAso,
    };
  }

  return {
    displayStatus: "ENCERRADO",
    needsReturnAso: true,
    returnLabel: "ASO pendente",
    returnTone: "danger",
    returnDone: false,
    lastAsoDate: lastAso,
  };
}

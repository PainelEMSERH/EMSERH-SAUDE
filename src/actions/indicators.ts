"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  ambulatoryAttendances,
  indicatorDefinitions,
} from "@/db/schemas";
import { writeAuditLog } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/guard";
import { findEmployeeIdByRegistration } from "@/db/queries/occupational";
import type { ActionState } from "@/actions/occupational";

export async function createAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await requirePermission("attendances", "create");
    const registration = String(formData.get("registration") || "");
    const attendanceType = String(formData.get("attendanceType") || "");
    const attendedAt = String(formData.get("attendedAt") || "");
    const conduct = String(formData.get("conduct") || "") || null;
    const notes = String(formData.get("notes") || "") || null;
    if (!registration || !attendanceType || !attendedAt) {
      return { error: "Preencha matrícula, tipo e data." };
    }
    const employeeId = await findEmployeeIdByRegistration(registration);
    if (!employeeId) return { error: "Colaborador não encontrado." };

    const db = getDb();
    const [created] = await db
      .insert(ambulatoryAttendances)
      .values({
        employeeId,
        attendanceType,
        attendedAt: new Date(attendedAt),
        conduct,
        notes,
        createdBy: user.id,
        updatedBy: user.id,
      })
      .returning({ id: ambulatoryAttendances.id });

    await writeAuditLog({
      user,
      action: "CREATE",
      entityType: "ambulatory_attendance",
      entityId: created.id,
    });
    revalidatePath("/atendimentos");
    return { ok: true };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Falha ao salvar atendimento.",
    };
  }
}

const INDICATOR_SEED: Array<{
  code: string;
  name: string;
  category: string;
  calculationRule: string;
  ruleValidationStatus: string;
}> = [
  {
    code: "ASO_ADERENCIA",
    name: "Aderência aos ASOs",
    category: "exames_ocupacionais",
    calculationRule: "realizados / previstos * 100 (planilha sugeria invertido)",
    ruleValidationStatus: "PENDENTE_VALIDACAO",
  },
  {
    code: "ASO_VENCIDOS",
    name: "ASOs vencidos",
    category: "exames_ocupacionais",
    calculationRule: "count(deadline_status = VENCIDO)",
    ruleValidationStatus: "VALIDADA",
  },
  {
    code: "ASO_A_VENCER_30",
    name: "ASOs a vencer em 30 dias",
    category: "exames_ocupacionais",
    calculationRule: "count(deadline_status = A_VENCER)",
    ruleValidationStatus: "VALIDADA",
  },
  {
    code: "VAC_ATUALIZACAO",
    name: "Atualização vacinal",
    category: "imunizacao",
    calculationRule: "motor configurável por vacina/dose/recusa/Anti-HBs",
    ruleValidationStatus: "PENDENTE_VALIDACAO",
  },
  {
    code: "GEST_INSALUBRE_SEM_REALOC",
    name: "Gestantes em insalubridade sem realocação",
    category: "gestacao",
    calculationRule: "hazardous_activity = true AND relocation_date is null",
    ruleValidationStatus: "VALIDADA",
  },
  {
    code: "BIO_FOLLOWUP_PENDENTE",
    name: "Acompanhamentos 30/60/90 pendentes",
    category: "material_biologico",
    calculationRule: "count(followups status = PENDENTE)",
    ruleValidationStatus: "VALIDADA",
  },
  {
    code: "AFAST_ATIVOS",
    name: "Afastamentos ativos",
    category: "gestao_ambulatorial",
    calculationRule: "count(leave status = ATIVO)",
    ruleValidationStatus: "VALIDADA",
  },
  {
    code: "NOTIF_TAXA",
    name: "Taxa de notificações",
    category: "notificacoes",
    calculationRule: "quantidade/30 (possivelmente falta *100 se percentual)",
    ruleValidationStatus: "PENDENTE_VALIDACAO",
  },
  {
    code: "ESPACO_CUIDAR_SAT",
    name: "Satisfação Espaço Cuidar",
    category: "satisfacao",
    calculationRule: "média das respostas no período",
    ruleValidationStatus: "PENDENTE_VALIDACAO",
  },
];

export async function seedIndicatorsAction() {
  const user = await requirePermission("indicators", "manage");
  const db = getDb();
  let created = 0;
  for (const item of INDICATOR_SEED) {
    const [existing] = await db
      .select()
      .from(indicatorDefinitions)
      .where(eq(indicatorDefinitions.code, item.code))
      .limit(1);
    if (existing) continue;
    await db.insert(indicatorDefinitions).values({
      ...item,
      description: item.name,
      periodicity: "MENSAL",
      createdBy: user.id,
      updatedBy: user.id,
    });
    created += 1;
  }
  await writeAuditLog({
    user,
    action: "SEED",
    entityType: "indicator_definitions",
    metadata: { created },
  });
  revalidatePath("/indicadores");
  return { created };
}

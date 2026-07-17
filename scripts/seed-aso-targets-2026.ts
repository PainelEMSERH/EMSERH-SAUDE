/**
 * Cadastra meta institucional ASO 2026 mês a mês (escopo EMSERH).
 * Uso: npx tsx scripts/seed-aso-targets-2026.ts
 *
 * Default: 80% · PERIODICO (aba padrão do painel).
 * Ajuste TARGET_PERCENT / ASO_TYPE via env se necessário.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../src/db";
import { asoTargetHistory, asoTargets } from "../src/db/schemas";

const YEAR = Number(process.env.ASO_TARGET_YEAR || 2026);
const TARGET_PERCENT = Number(process.env.ASO_TARGET_PERCENT || 80);
const ASO_TYPE = process.env.ASO_TARGET_TYPE || "PERIODICO";
const SCOPE_TYPE = "EMSERH";
const NOTES =
  process.env.ASO_TARGET_NOTES ||
  "Meta institucional EMSERH — cadastro inicial alinhado ao painel de ASOs";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL ausente (.env.local)");
  }
  if (Number.isNaN(TARGET_PERCENT) || TARGET_PERCENT <= 0 || TARGET_PERCENT > 100) {
    throw new Error(`TARGET_PERCENT inválido: ${TARGET_PERCENT}`);
  }

  const db = getDb();
  let inserted = 0;
  let updated = 0;

  for (let month = 1; month <= 12; month++) {
    const [existing] = await db
      .select()
      .from(asoTargets)
      .where(
        and(
          isNull(asoTargets.deletedAt),
          eq(asoTargets.year, YEAR),
          eq(asoTargets.month, month),
          eq(asoTargets.asoType, ASO_TYPE),
          eq(asoTargets.scopeType, SCOPE_TYPE),
          isNull(asoTargets.regionId),
          isNull(asoTargets.unitId),
        ),
      )
      .limit(1);

    if (existing) {
      if (existing.targetPercent === TARGET_PERCENT) {
        console.log(`  ${String(month).padStart(2, "0")}/${YEAR}: já ${TARGET_PERCENT}% — ok`);
        continue;
      }
      await db
        .update(asoTargets)
        .set({
          targetPercent: TARGET_PERCENT,
          notes: NOTES,
        })
        .where(eq(asoTargets.id, existing.id));
      await db.insert(asoTargetHistory).values({
        targetId: existing.id,
        previousPercent: existing.targetPercent,
        newPercent: TARGET_PERCENT,
        reason: "Atualização via seed-aso-targets-2026",
      });
      updated += 1;
      console.log(
        `  ${String(month).padStart(2, "0")}/${YEAR}: ${existing.targetPercent}% → ${TARGET_PERCENT}%`,
      );
    } else {
      const [created] = await db
        .insert(asoTargets)
        .values({
          year: YEAR,
          month,
          asoType: ASO_TYPE,
          scopeType: SCOPE_TYPE,
          regionId: null,
          unitId: null,
          targetPercent: TARGET_PERCENT,
          notes: NOTES,
        })
        .returning({ id: asoTargets.id });
      await db.insert(asoTargetHistory).values({
        targetId: created.id,
        previousPercent: null,
        newPercent: TARGET_PERCENT,
        reason: "Meta inicial via seed-aso-targets-2026",
      });
      inserted += 1;
      console.log(`  ${String(month).padStart(2, "0")}/${YEAR}: cadastrado ${TARGET_PERCENT}%`);
    }
  }

  console.log(
    `\nConcluído · ${ASO_TYPE} · ${SCOPE_TYPE} · ${YEAR} · meta ${TARGET_PERCENT}% · +${inserted} · ~${updated}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import "dotenv/config";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import * as schema from "../src/db/schemas";
import { indicatorDefinitions } from "../src/db/schemas";

const SEED = [
  ["ASO_ADERENCIA", "Aderência aos ASOs", "exames_ocupacionais", "realizados/previstos*100", "PENDENTE_VALIDACAO"],
  ["ASO_VENCIDOS", "ASOs vencidos", "exames_ocupacionais", "count vencidos", "VALIDADA"],
  ["ASO_A_VENCER_30", "ASOs a vencer 30d", "exames_ocupacionais", "count a vencer", "VALIDADA"],
  ["VAC_ATUALIZACAO", "Atualização vacinal", "imunizacao", "motor configurável", "PENDENTE_VALIDACAO"],
  ["GEST_INSALUBRE_SEM_REALOC", "Gestantes insalubres s/ realocação", "gestacao", "hazardous sem relocation", "VALIDADA"],
  ["BIO_FOLLOWUP_PENDENTE", "Follow-ups biológicos pendentes", "material_biologico", "count pendente", "VALIDADA"],
  ["AFAST_ATIVOS", "Afastamentos ativos", "gestao_ambulatorial", "count ativos", "VALIDADA"],
  ["NOTIF_TAXA", "Taxa de notificações", "notificacoes", "qtd/30 (?*100)", "PENDENTE_VALIDACAO"],
  ["ESPACO_CUIDAR_SAT", "Satisfação Espaço Cuidar", "satisfacao", "média respostas", "PENDENTE_VALIDACAO"],
] as const;

async function main() {
  if (!process.argv.includes("--yes")) {
    console.log("Dry-run. Use --yes para gravar.");
    console.log(`Indicadores previstos: ${SEED.length}`);
    return;
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada.");
  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  const db = drizzle(client, { schema });
  let created = 0;
  for (const [code, name, category, calculationRule, ruleValidationStatus] of SEED) {
    const [existing] = await db
      .select()
      .from(indicatorDefinitions)
      .where(eq(indicatorDefinitions.code, code))
      .limit(1);
    if (existing) continue;
    await db.insert(indicatorDefinitions).values({
      code,
      name,
      category,
      calculationRule,
      ruleValidationStatus,
      description: name,
      periodicity: "MENSAL",
    });
    created += 1;
  }
  console.log({ created });
  await client.end();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

/**
 * Importação de colaboradores (Alterdata).
 * Execução local com confirmação explícita — não usa Serverless Function.
 */
import "dotenv/config";

async function main() {
  const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  if (!file) {
    console.error("Uso: npm run import:employees -- --file=./planilha.xlsx");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada.");
  }

  console.log("Arquivo:", file);
  console.log(
    "Implementação idempotente pronta para evolução: validar cabeçalhos, normalizar, resumir e gravar em transação após confirmação.",
  );
  console.log(
    "Nenhuma gravação foi feita neste bootstrap. Conecte o Neon e complete o parser na próxima etapa operacional.",
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

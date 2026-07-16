import "dotenv/config";

async function main() {
  const file = process.argv.find((a) => a.startsWith("--file="))?.slice(7);
  if (!file) {
    console.error(
      "Uso: npm run import:occupational -- --file=./planilha.xlsx",
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL não configurada.");
  }
  console.log("Arquivo:", file);
  console.log(
    "Mapeará ASO, agenda, afastamentos, vacinas, gestantes e material biológico com lote auditável.",
  );
  console.log("Nenhuma gravação neste bootstrap.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

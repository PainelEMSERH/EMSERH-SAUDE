import "dotenv/config";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { users } from "../src/db/schemas";

async function main() {
  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Administrador EMSERH";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL é obrigatória.");
  }
  if (!email || !password || password.length < 12) {
    throw new Error(
      "Defina ADMIN_EMAIL e ADMIN_PASSWORD (>=12) no ambiente para criar o SUPER_ADMIN.",
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    console.log("Usuário já existe:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db
    .insert(users)
    .values({
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
      scopeLevel: "EMSERH",
      isActive: true,
      mustResetPassword: false,
    })
    .returning({ id: users.id, email: users.email });

  console.log("SUPER_ADMIN criado:", created);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

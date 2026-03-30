/**
 * Roda uma vez ao subir o servidor Node (dev/prod).
 * Ajuda a diagnosticar 500 por variáveis obrigatórias ausentes.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const checks: { key: string; hint: string }[] = [
    {
      key: "DATABASE_URL",
      hint: "Defina no .env.local (Postgres). Depois: npx prisma db push",
    },
    {
      key: "NEXTAUTH_SECRET",
      hint: "Gere com: openssl rand -base64 32 e coloque no .env.local",
    },
    {
      key: "NEXTAUTH_URL",
      hint: "Em dev use: http://localhost:3000",
    },
  ];

  const missing = checks.filter((c) => !process.env[c.key]?.trim());
  if (missing.length === 0) return;

  console.warn(
    "\n[dash-performance] Variáveis de ambiente ausentes ou vazias:\n" +
      missing.map((m) => `  - ${m.key}: ${m.hint}`).join("\n") +
      "\nCopie .env.example para .env.local e preencha.\n"
  );
}

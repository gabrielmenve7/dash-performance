import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Público: diagnóstico deploy + Neon (sem segredos na resposta). */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, database: "connected" });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: "error",
        hint: "Confira DATABASE_URL na Vercel (Neon pooler; sem channel_binding=require).",
      },
      { status: 503 }
    );
  }
}

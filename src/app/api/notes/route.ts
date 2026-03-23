import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const noteSchema = z.object({
  clientId: z.string(),
  content: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: {
      clientId: parsed.data.clientId,
      userId: session.user.id,
      content: parsed.data.content,
    },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    id: note.id,
    content: note.content,
    userName: note.user.name,
    createdAt: note.createdAt.toISOString(),
  });
}

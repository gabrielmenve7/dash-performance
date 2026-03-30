import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getGenderBreakdown,
  getAgeBreakdown,
  getRegionBreakdown,
  getAdLevelMetrics,
} from "@/lib/domain";
import { endOfDay, parseISO, startOfDay } from "date-fns";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  if (session.user.role === "CLIENT") {
    const access = await prisma.clientUser.findFirst({
      where: { userId: session.user.id, clientId },
    });
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const fromStr = req.nextUrl.searchParams.get("from");
  const toStr = req.nextUrl.searchParams.get("to");

  if (!fromStr || !toStr) {
    return NextResponse.json(
      { error: "Missing from or to (ISO date)" },
      { status: 400 }
    );
  }

  const from = startOfDay(parseISO(fromStr));
  const to = endOfDay(parseISO(toStr));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const [gender, age, regions, ads] = await Promise.all([
    getGenderBreakdown(clientId, from, to),
    getAgeBreakdown(clientId, from, to),
    getRegionBreakdown(clientId, from, to),
    getAdLevelMetrics(clientId, from, to),
  ]);

  return NextResponse.json({ gender, age, regions, ads });
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  aggregateCampaignListMetrics,
  getClientCampaigns,
  getDailyMetrics,
  sumMetricsSummaries,
} from "@/lib/data";
import { endOfDay, parseISO, startOfDay, subDays } from "date-fns";
import type { PlatformType } from "@/types";

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
  const platformParam = req.nextUrl.searchParams.get("platform");
  const objectiveParam = req.nextUrl.searchParams.get("objective");

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

  const platform: PlatformType | "ALL" =
    platformParam === "META" || platformParam === "GOOGLE"
      ? platformParam
      : "ALL";

  const diffDays = Math.max(
    1,
    Math.round((to.getTime() - from.getTime()) / 86400000)
  );
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, diffDays);

  const [campaigns, dailyData] = await Promise.all([
    getClientCampaigns(clientId, from, to, platform, prevFrom, prevTo, objectiveParam ?? "ALL"),
    getDailyMetrics(clientId, from, to, platform, objectiveParam ?? "ALL"),
  ]);

  const metrics = aggregateCampaignListMetrics(campaigns);
  const previousMetrics = sumMetricsSummaries(
    campaigns
      .map((c) => c.previousMetrics)
      .filter((m): m is NonNullable<typeof m> => m != null)
  );

  return NextResponse.json({ campaigns, metrics, dailyData, previousMetrics });
}

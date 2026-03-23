import { prisma } from "@/lib/prisma";
import type { MetricsSummary, ClientWithMetrics, CampaignWithMetrics, DailyMetric, PlatformType } from "@/types";

function aggregateMetrics(
  metrics: { spend: number; impressions: number; reach: number; clicks: number; conversions: number; revenue: number; leads: number; ctr: number; cpc: number; cpm: number; cpa: number; roas: number; frequency: number }[]
): MetricsSummary {
  if (metrics.length === 0) {
    return { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, leads: 0, ctr: 0, cpc: 0, cpm: 0, cpa: 0, roas: 0, frequency: 0 };
  }

  const totals = metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      reach: acc.reach + m.reach,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      revenue: acc.revenue + m.revenue,
      leads: acc.leads + m.leads,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, revenue: 0, leads: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
  const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
  const cpa = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
  const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
  const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;

  return { ...totals, ctr, cpc, cpm, cpa, roas, frequency };
}

export async function getOverviewMetrics(from: Date, to: Date): Promise<MetricsSummary> {
  const metrics = await prisma.campaignMetrics.findMany({
    where: { date: { gte: from, lte: to } },
  });
  return aggregateMetrics(metrics);
}

export async function getClientsWithMetrics(
  from: Date,
  to: Date,
  prevFrom?: Date,
  prevTo?: Date
): Promise<ClientWithMetrics[]> {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: {
      adAccounts: {
        include: {
          campaigns: {
            include: {
              metrics: { where: { date: { gte: from, lte: to } } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const results: ClientWithMetrics[] = [];

  for (const client of clients) {
    const allMetrics = client.adAccounts.flatMap((a) =>
      a.campaigns.flatMap((c) => c.metrics)
    );
    const platforms = [...new Set(client.adAccounts.map((a) => a.platform))] as PlatformType[];
    const campaignCount = client.adAccounts.reduce((sum, a) => sum + a.campaigns.length, 0);

    let previousMetrics: MetricsSummary | undefined;
    if (prevFrom && prevTo) {
      const prevMetricsData = await prisma.campaignMetrics.findMany({
        where: {
          date: { gte: prevFrom, lte: prevTo },
          campaign: {
            adAccount: { clientId: client.id },
          },
        },
      });
      previousMetrics = aggregateMetrics(prevMetricsData);
    }

    results.push({
      id: client.id,
      name: client.name,
      slug: client.slug,
      industry: client.industry,
      logoUrl: client.logoUrl,
      isActive: client.isActive,
      metrics: aggregateMetrics(allMetrics),
      previousMetrics: previousMetrics,
      campaignCount,
      platforms,
    });
  }

  return results;
}

export async function getClientById(clientId: string) {
  return prisma.client.findUnique({
    where: { id: clientId },
    include: { adAccounts: true },
  });
}

export async function getClientCampaigns(
  clientId: string,
  from: Date,
  to: Date,
  platform?: PlatformType | "ALL",
  prevFrom?: Date,
  prevTo?: Date
): Promise<CampaignWithMetrics[]> {
  const whereClause: Record<string, unknown> = {
    adAccount: { clientId },
  };

  if (platform && platform !== "ALL") {
    whereClause.adAccount = { clientId, platform };
  }

  const campaigns = await prisma.campaign.findMany({
    where: whereClause,
    include: {
      adAccount: true,
      metrics: {
        where: { date: { gte: from, lte: to } },
        orderBy: { date: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const results: CampaignWithMetrics[] = [];

  for (const campaign of campaigns) {
    let previousMetrics: MetricsSummary | undefined;
    if (prevFrom && prevTo) {
      const prevData = await prisma.campaignMetrics.findMany({
        where: {
          campaignId: campaign.id,
          date: { gte: prevFrom, lte: prevTo },
        },
      });
      previousMetrics = aggregateMetrics(prevData);
    }

    const dailyData: DailyMetric[] = campaign.metrics.map((m) => ({
      date: m.date.toISOString().split("T")[0],
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
      revenue: m.revenue,
      ctr: m.ctr,
      cpc: m.cpc,
      roas: m.roas,
    }));

    results.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      objective: campaign.objective,
      platform: campaign.adAccount.platform as PlatformType,
      accountName: campaign.adAccount.accountName,
      metrics: aggregateMetrics(campaign.metrics),
      previousMetrics,
      dailyData,
    });
  }

  return results;
}

export async function getDailyMetrics(
  clientId: string,
  from: Date,
  to: Date,
  platform?: PlatformType | "ALL"
): Promise<DailyMetric[]> {
  const campaignFilter: Record<string, unknown> = {};
  if (clientId) {
    campaignFilter.adAccount = platform && platform !== "ALL"
      ? { clientId, platform }
      : { clientId };
  } else if (platform && platform !== "ALL") {
    campaignFilter.adAccount = { platform };
  }

  const whereClause: Record<string, unknown> = {
    date: { gte: from, lte: to },
  };

  if (Object.keys(campaignFilter).length > 0) {
    whereClause.campaign = campaignFilter;
  }

  const metrics = await prisma.campaignMetrics.findMany({
    where: whereClause,
    orderBy: { date: "asc" },
  });

  const grouped = new Map<string, typeof metrics>();
  for (const m of metrics) {
    const key = m.date.toISOString().split("T")[0];
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }

  return Array.from(grouped.entries()).map(([date, dayMetrics]) => {
    const agg = aggregateMetrics(dayMetrics);
    return { date, ...agg };
  });
}

export async function getClientForUser(userId: string) {
  const clientUser = await prisma.clientUser.findFirst({
    where: { userId },
    include: { client: true },
  });
  return clientUser?.client ?? null;
}

/** Soma métricas de várias campanhas (KPIs do cliente no período). */
export function aggregateCampaignListMetrics(
  campaigns: CampaignWithMetrics[]
): MetricsSummary {
  const totalMetrics = campaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + c.metrics.spend,
      revenue: acc.revenue + c.metrics.revenue,
      impressions: acc.impressions + c.metrics.impressions,
      reach: acc.reach + c.metrics.reach,
      clicks: acc.clicks + c.metrics.clicks,
      conversions: acc.conversions + c.metrics.conversions,
      leads: acc.leads + c.metrics.leads,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      cpa: 0,
      roas: 0,
      frequency: 0,
    }),
    {
      spend: 0,
      revenue: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversions: 0,
      leads: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      cpa: 0,
      roas: 0,
      frequency: 0,
    }
  );

  totalMetrics.ctr =
    totalMetrics.impressions > 0
      ? (totalMetrics.clicks / totalMetrics.impressions) * 100
      : 0;
  totalMetrics.cpc =
    totalMetrics.clicks > 0 ? totalMetrics.spend / totalMetrics.clicks : 0;
  totalMetrics.cpm =
    totalMetrics.impressions > 0
      ? (totalMetrics.spend / totalMetrics.impressions) * 1000
      : 0;
  totalMetrics.cpa =
    totalMetrics.conversions > 0
      ? totalMetrics.spend / totalMetrics.conversions
      : 0;
  totalMetrics.roas =
    totalMetrics.spend > 0 ? totalMetrics.revenue / totalMetrics.spend : 0;
  totalMetrics.frequency =
    totalMetrics.reach > 0
      ? totalMetrics.impressions / totalMetrics.reach
      : 0;

  return totalMetrics;
}

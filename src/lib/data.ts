import { prisma } from "@/lib/prisma";
import type { MetricsSummary, ClientWithMetrics, CampaignWithMetrics, DailyMetric, PlatformType } from "@/types";

function objectiveFilter(objective?: string | "ALL"): Record<string, unknown> | undefined {
  if (!objective || objective === "ALL") return undefined;

  if (objective === "CONVERSAS") {
    return {
      OR: [
        { objective: { contains: "message", mode: "insensitive" } },
        { objective: { contains: "messaging", mode: "insensitive" } },
        { objective: { contains: "lead", mode: "insensitive" } },
        { objective: { contains: "conversa", mode: "insensitive" } },
        { objective: { contains: "whatsapp", mode: "insensitive" } },
      ],
    };
  }

  if (objective === "COMPRAS") {
    return {
      OR: [
        { objective: { contains: "sale", mode: "insensitive" } },
        { objective: { contains: "purchase", mode: "insensitive" } },
        { objective: { contains: "shopping", mode: "insensitive" } },
        { objective: { contains: "compra", mode: "insensitive" } },
      ],
    };
  }

  if (objective === "OUTROS") {
    return {
      AND: [
        {
          NOT: {
            OR: [
              { objective: { contains: "message", mode: "insensitive" } },
              { objective: { contains: "messaging", mode: "insensitive" } },
              { objective: { contains: "lead", mode: "insensitive" } },
              { objective: { contains: "conversa", mode: "insensitive" } },
              { objective: { contains: "whatsapp", mode: "insensitive" } },
              { objective: { contains: "sale", mode: "insensitive" } },
              { objective: { contains: "purchase", mode: "insensitive" } },
              { objective: { contains: "shopping", mode: "insensitive" } },
              { objective: { contains: "compra", mode: "insensitive" } },
            ],
          },
        },
      ],
    };
  }

  return { objective };
}

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

/** KPIs agregados de todas as campanhas do cliente no período (via campaignMetrics). */
export async function getOverviewMetricsForClient(
  clientId: string,
  from: Date,
  to: Date
): Promise<MetricsSummary> {
  const metrics = await prisma.campaignMetrics.findMany({
    where: {
      date: { gte: from, lte: to },
      campaign: { adAccount: { clientId } },
    },
  });
  return aggregateMetrics(metrics);
}

export async function getActiveClientsForSelector(): Promise<{ id: string; name: string }[]> {
  return prisma.client.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getActiveClientById(clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, isActive: true },
    select: { id: true, name: true, slug: true, industry: true },
  });
}

/** Soma totais brutos de vários resumos e recalcula taxas (para período anterior agregado). */
export function sumMetricsSummaries(summaries: MetricsSummary[]): MetricsSummary {
  if (summaries.length === 0) {
    return {
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      leads: 0,
      ctr: 0,
      cpc: 0,
      cpm: 0,
      cpa: 0,
      roas: 0,
      frequency: 0,
    };
  }
  const t = summaries.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      reach: acc.reach + m.reach,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      revenue: acc.revenue + m.revenue,
      leads: acc.leads + m.leads,
    }),
    {
      spend: 0,
      impressions: 0,
      reach: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
      leads: 0,
    }
  );
  const ctr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
  const cpc = t.clicks > 0 ? t.spend / t.clicks : 0;
  const cpm = t.impressions > 0 ? (t.spend / t.impressions) * 1000 : 0;
  const cpa = t.conversions > 0 ? t.spend / t.conversions : 0;
  const roas = t.spend > 0 ? t.revenue / t.spend : 0;
  const frequency = t.reach > 0 ? t.impressions / t.reach : 0;
  return { ...t, ctr, cpc, cpm, cpa, roas, frequency };
}

/** Campanhas com métricas agregadas no período, sem série diária (contexto leve para o assistente). */
export async function getAssistantCampaignSummaries(
  clientId: string,
  from: Date,
  to: Date,
  limit = 40
): Promise<
  {
    name: string;
    platform: PlatformType;
    status: string;
    objective: string | null;
    metrics: MetricsSummary;
  }[]
> {
  const campaigns = await prisma.campaign.findMany({
    where: { adAccount: { clientId } },
    include: {
      adAccount: { select: { platform: true } },
      metrics: {
        where: { date: { gte: from, lte: to } },
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  return campaigns.map((c) => ({
    name: c.name,
    platform: c.adAccount.platform as PlatformType,
    status: c.status,
    objective: c.objective,
    metrics: aggregateMetrics(c.metrics),
  }));
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
  prevTo?: Date,
  objective?: string | "ALL"
): Promise<CampaignWithMetrics[]> {
  const whereClause: Record<string, unknown> = {
    adAccount: { clientId },
  };

  if (platform && platform !== "ALL") {
    whereClause.adAccount = { clientId, platform };
  }
  const objectiveWhere = objectiveFilter(objective);
  if (objectiveWhere) {
    Object.assign(whereClause, objectiveWhere);
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
  platform?: PlatformType | "ALL",
  objective?: string | "ALL"
): Promise<DailyMetric[]> {
  const campaignFilter: Record<string, unknown> = {};
  if (clientId) {
    campaignFilter.adAccount = platform && platform !== "ALL"
      ? { clientId, platform }
      : { clientId };
  } else if (platform && platform !== "ALL") {
    campaignFilter.adAccount = { platform };
  }
  const objectiveWhere = objectiveFilter(objective);
  if (objectiveWhere) {
    Object.assign(campaignFilter, objectiveWhere);
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

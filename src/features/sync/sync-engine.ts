import { prisma } from "@/lib/prisma";
import {
  fetchMetaCampaigns,
  fetchMetaInsights,
  fetchMetaAdLevelInsights,
  fetchMetaDemographicInsights,
  fetchMetaRegionInsights,
  fetchMetaAdCreatives,
  parseMetaStatus,
  extractConversions,
  type MetaDemographicInsight,
  type MetaRegionInsight,
} from "@/lib/integrations/meta/meta-ads";
import {
  fetchGoogleCampaigns,
  fetchGoogleMetrics,
  parseGoogleStatus,
  microsToDecimal,
} from "@/lib/integrations/google/google-ads";
import { subDays, format } from "date-fns";

/** Quantos dias de histórico buscar na Meta/Google a cada sync (máx. 730). Padrão 7 para caber nos 10s da Vercel Hobby. */
function syncHistoryDays(): number {
  const n = parseInt(process.env.ADS_SYNC_HISTORY_DAYS ?? "7", 10);
  if (Number.isNaN(n) || n < 1) return 7;
  return Math.min(n, 730);
}

function safeFloat(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

function safeInt(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : 0;
}

export async function syncAllAccounts() {
  const accounts = await prisma.adAccount.findMany({
    where: { isActive: true },
  });

  const results = [];
  for (const account of accounts) {
    try {
      if (account.platform === "META") {
        await syncMetaAccount(account);
      } else if (account.platform === "GOOGLE") {
        await syncGoogleAccount(account);
      }
      results.push({ accountId: account.id, status: "success" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      await prisma.syncLog.create({
        data: {
          adAccountId: account.id,
          status: "error",
          message,
        },
      });
      results.push({ accountId: account.id, status: "error", message });
    }
  }

  return results;
}

async function syncMetaAccount(account: {
  id: string;
  accountId: string;
  accessToken: string | null;
}) {
  if (!account.accessToken) throw new Error("No access token for Meta account");

  const days = syncHistoryDays();
  const dateFrom = format(subDays(new Date(), days), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const syncLog = await prisma.syncLog.create({
    data: { adAccountId: account.id, status: "running" },
  });

  try {
    const campaigns = await fetchMetaCampaigns(account.accessToken, account.accountId);

    for (const campaign of campaigns) {
      await prisma.campaign.upsert({
        where: {
          adAccountId_platformCampaignId: {
            adAccountId: account.id,
            platformCampaignId: campaign.id,
          },
        },
        update: {
          name: campaign.name,
          status: parseMetaStatus(campaign.status) as "ACTIVE" | "PAUSED" | "REMOVED" | "ARCHIVED",
          objective: campaign.objective,
          dailyBudget: campaign.daily_budget ? safeFloat(campaign.daily_budget) / 100 : null,
          lifetimeBudget: campaign.lifetime_budget ? safeFloat(campaign.lifetime_budget) / 100 : null,
        },
        create: {
          adAccountId: account.id,
          platformCampaignId: campaign.id,
          name: campaign.name,
          status: parseMetaStatus(campaign.status) as "ACTIVE" | "PAUSED" | "REMOVED" | "ARCHIVED",
          objective: campaign.objective,
          dailyBudget: campaign.daily_budget ? safeFloat(campaign.daily_budget) / 100 : null,
          lifetimeBudget: campaign.lifetime_budget ? safeFloat(campaign.lifetime_budget) / 100 : null,
          startDate: campaign.start_time ? new Date(campaign.start_time) : null,
          endDate: campaign.stop_time ? new Date(campaign.stop_time) : null,
        },
      });
    }

    const campaignRows = await prisma.campaign.findMany({
      where: { adAccountId: account.id },
      select: { id: true, platformCampaignId: true },
    });
    const campaignIdByMeta = new Map(campaignRows.map((c) => [c.platformCampaignId, c.id]));

    const insights = await fetchMetaInsights(account.accessToken, account.accountId, dateFrom, dateTo);
    let recordsSync = 0;

    for (const insight of insights) {
      const campaignId = campaignIdByMeta.get(insight.campaign_id);
      if (!campaignId) continue;

      const { conversationsStarted, purchases, revenue, leads } = extractConversions(insight);
      const spend = safeFloat(insight.spend);
      const impressions = safeInt(insight.impressions);
      const clicks = safeInt(insight.clicks);
      const reach = safeInt(insight.reach);
      const ctr = safeFloat(insight.ctr);
      const cpc = safeFloat(insight.cpc);
      const cpm = safeFloat(insight.cpm);
      const frequency = safeFloat(insight.frequency);

      await prisma.campaignMetrics.upsert({
        where: {
          campaignId_date: {
            campaignId,
            date: new Date(insight.date_start),
          },
        },
        update: {
          spend,
          impressions,
          reach,
          clicks,
          conversions: conversationsStarted,
          purchases,
          revenue,
          leads,
          ctr,
          cpc,
          cpm,
          cpa: conversationsStarted > 0 ? spend / conversationsStarted : 0,
          roas: spend > 0 ? revenue / spend : 0,
          frequency,
        },
        create: {
          campaignId,
          date: new Date(insight.date_start),
          spend,
          impressions,
          reach,
          clicks,
          conversions: conversationsStarted,
          purchases,
          revenue,
          leads,
          ctr,
          cpc,
          cpm,
          cpa: conversationsStarted > 0 ? spend / conversationsStarted : 0,
          roas: spend > 0 ? revenue / spend : 0,
          frequency,
        },
      });

      recordsSync++;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        completedAt: new Date(),
        recordsSync,
        message: null,
      },
    });

  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

/**
 * Sincroniza breakdowns (demografia, região, ads) para um cliente específico.
 * Chamado sob demanda por endpoint separado — não faz parte do sync principal.
 */
export async function syncBreakdownsForClient(clientId: string) {
  const accounts = await prisma.adAccount.findMany({
    where: { clientId, isActive: true, platform: "META", accessToken: { not: null } },
    select: { id: true, accountId: true, accessToken: true },
  });

  const days = parseInt(process.env.ADS_SYNC_BREAKDOWN_DAYS ?? "14", 10);
  const dateFrom = format(subDays(new Date(), Math.min(Math.max(days, 1), 730)), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  for (const account of accounts) {
    if (!account.accessToken) continue;

    const campaignRows = await prisma.campaign.findMany({
      where: { adAccountId: account.id },
      select: { id: true, platformCampaignId: true },
    });
    const campaignIdByMeta = new Map(campaignRows.map((c) => [c.platformCampaignId, c.id]));

    const [demoRows, regionRows] = await Promise.all([
      fetchMetaDemographicInsights(account.accessToken, account.accountId, dateFrom, dateTo).catch(() => [] as MetaDemographicInsight[]),
      fetchMetaRegionInsights(account.accessToken, account.accountId, dateFrom, dateTo).catch(() => [] as MetaRegionInsight[]),
    ]);

    await syncMetaDemographicsRows(demoRows, campaignIdByMeta).catch(() => {});
    await syncMetaRegionRows(regionRows, campaignIdByMeta).catch(() => {});
    await syncMetaAdLevel(account, dateFrom, dateTo, campaignIdByMeta).catch(() => {});
  }
}

async function syncMetaDemographicsRows(
  rows: MetaDemographicInsight[],
  campaignIdByMeta: Map<string, string>
) {
  for (const row of rows) {
    const campaignId = campaignIdByMeta.get(row.campaign_id);
    if (!campaignId) continue;

    const data = {
      impressions: safeInt(row.impressions),
      reach: safeInt(row.reach),
      clicks: safeInt(row.clicks),
      spend: safeFloat(row.spend),
      conversions: 0,
    };

    if (row.actions) {
      for (const action of row.actions) {
        if (
          action.action_type.includes("messaging_conversation_started") ||
          action.action_type.includes("onsite_conversion.messaging_conversation_started")
        ) {
          data.conversions = Math.max(data.conversions, safeInt(action.value));
        }
      }
    }

    await prisma.demographicMetrics.upsert({
      where: {
        campaignId_date_ageRange_gender: {
          campaignId,
          date: new Date(row.date_start),
          ageRange: row.age,
          gender: row.gender,
        },
      },
      update: data,
      create: {
        campaignId,
        date: new Date(row.date_start),
        ageRange: row.age,
        gender: row.gender,
        ...data,
      },
    });
  }
}

async function syncMetaRegionRows(rows: MetaRegionInsight[], campaignIdByMeta: Map<string, string>) {
  for (const row of rows) {
    const campaignId = campaignIdByMeta.get(row.campaign_id);
    if (!campaignId) continue;

    const data = {
      impressions: safeInt(row.impressions),
      reach: safeInt(row.reach),
      clicks: safeInt(row.clicks),
      spend: safeFloat(row.spend),
    };

    await prisma.regionMetrics.upsert({
      where: {
        campaignId_date_region: {
          campaignId,
          date: new Date(row.date_start),
          region: row.region,
        },
      },
      update: data,
      create: {
        campaignId,
        date: new Date(row.date_start),
        region: row.region,
        ...data,
      },
    });
  }
}

async function syncMetaAdLevel(
  account: { id: string; accountId: string; accessToken: string | null },
  dateFrom: string,
  dateTo: string,
  campaignIdByMeta: Map<string, string>
) {
  if (!account.accessToken) return;

  const [insights, thumbnails] = await Promise.all([
    fetchMetaAdLevelInsights(account.accessToken, account.accountId, dateFrom, dateTo),
    fetchMetaAdCreatives(account.accessToken, account.accountId),
  ]);

  for (const insight of insights) {
    if (!insight.ad_id) continue;

    const campaignId = campaignIdByMeta.get(insight.campaign_id);
    if (!campaignId) continue;

    const { conversationsStarted, purchases } = extractConversions(insight);

    const data = {
      adName: insight.ad_name ?? insight.ad_id,
      adsetName: insight.adset_name ?? null,
      thumbnailUrl: thumbnails.get(insight.ad_id) ?? null,
      impressions: safeInt(insight.impressions),
      reach: safeInt(insight.reach),
      clicks: safeInt(insight.clicks),
      spend: safeFloat(insight.spend),
      conversions: conversationsStarted,
      purchases,
    };

    await prisma.adMetrics.upsert({
      where: {
        campaignId_platformAdId_date: {
          campaignId,
          platformAdId: insight.ad_id,
          date: new Date(insight.date_start),
        },
      },
      update: data,
      create: {
        campaignId,
        platformAdId: insight.ad_id,
        date: new Date(insight.date_start),
        ...data,
      },
    });
  }
}

async function syncGoogleAccount(account: {
  id: string;
  accountId: string;
  accessToken: string | null;
}) {
  if (!account.accessToken) throw new Error("No access token for Google account");

  const days = syncHistoryDays();
  const dateFrom = format(subDays(new Date(), days), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const syncLog = await prisma.syncLog.create({
    data: { adAccountId: account.id, status: "running" },
  });

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN?.trim();
  if (!developerToken) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        completedAt: new Date(),
        recordsSync: 0,
        message:
          "Google Ads ignorado: defina GOOGLE_DEVELOPER_TOKEN no ambiente para sincronizar esta conta.",
      },
    });
    return;
  }

  try {
    const campaigns = await fetchGoogleCampaigns(account.accessToken, account.accountId, developerToken);

    for (const { campaign } of campaigns) {
      await prisma.campaign.upsert({
        where: {
          adAccountId_platformCampaignId: {
            adAccountId: account.id,
            platformCampaignId: campaign.id,
          },
        },
        update: {
          name: campaign.name,
          status: parseGoogleStatus(campaign.status) as "ACTIVE" | "PAUSED" | "REMOVED" | "ARCHIVED",
        },
        create: {
          adAccountId: account.id,
          platformCampaignId: campaign.id,
          name: campaign.name,
          status: parseGoogleStatus(campaign.status) as "ACTIVE" | "PAUSED" | "REMOVED" | "ARCHIVED",
          startDate: campaign.startDate ? new Date(campaign.startDate) : null,
          endDate: campaign.endDate ? new Date(campaign.endDate) : null,
        },
      });
    }

    const metrics = await fetchGoogleMetrics(
      account.accessToken,
      account.accountId,
      developerToken,
      dateFrom,
      dateTo
    );

    let recordsSync = 0;

    for (const metric of metrics) {
      const dbCampaign = await prisma.campaign.findUnique({
        where: {
          adAccountId_platformCampaignId: {
            adAccountId: account.id,
            platformCampaignId: metric.campaign.id,
          },
        },
      });

      if (!dbCampaign) continue;

      const spend = microsToDecimal(metric.metrics.costMicros);
      const impressions = safeInt(metric.metrics.impressions);
      const clicks = safeInt(metric.metrics.clicks);
      const conversions = Math.round(safeFloat(metric.metrics.conversions));
      const revenue = safeFloat(metric.metrics.conversionsValue);
      const cpc = safeFloat(microsToDecimal(metric.metrics.averageCpc));
      const cpm = safeFloat(microsToDecimal(metric.metrics.averageCpm));
      const ctr = safeFloat(metric.metrics.ctr) * 100;

      await prisma.campaignMetrics.upsert({
        where: {
          campaignId_date: {
            campaignId: dbCampaign.id,
            date: new Date(metric.segments.date),
          },
        },
        update: {
          spend,
          impressions,
          clicks,
          conversions,
          revenue,
          ctr,
          cpc,
          cpm,
          cpa: conversions > 0 ? spend / conversions : 0,
          roas: spend > 0 ? revenue / spend : 0,
        },
        create: {
          campaignId: dbCampaign.id,
          date: new Date(metric.segments.date),
          spend,
          impressions,
          clicks,
          conversions,
          revenue,
          ctr,
          cpc,
          cpm,
          cpa: conversions > 0 ? spend / conversions : 0,
          roas: spend > 0 ? revenue / spend : 0,
        },
      });

      recordsSync++;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: { status: "success", completedAt: new Date(), recordsSync },
    });
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

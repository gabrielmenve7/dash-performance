import { prisma } from "@/lib/prisma";
import {
  fetchMetaCampaigns,
  fetchMetaInsights,
  parseMetaStatus,
  extractConversions,
} from "@/lib/meta-ads";
import {
  fetchGoogleCampaigns,
  fetchGoogleMetrics,
  parseGoogleStatus,
  microsToDecimal,
} from "@/lib/google-ads";
import { subDays, format } from "date-fns";

/** Quantos dias de histórico buscar na Meta/Google a cada sync (máx. 730). */
function syncHistoryDays(): number {
  const n = parseInt(process.env.ADS_SYNC_HISTORY_DAYS ?? "90", 10);
  if (Number.isNaN(n) || n < 1) return 90;
  return Math.min(n, 730);
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
          dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
          lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
        },
        create: {
          adAccountId: account.id,
          platformCampaignId: campaign.id,
          name: campaign.name,
          status: parseMetaStatus(campaign.status) as "ACTIVE" | "PAUSED" | "REMOVED" | "ARCHIVED",
          objective: campaign.objective,
          dailyBudget: campaign.daily_budget ? parseFloat(campaign.daily_budget) / 100 : null,
          lifetimeBudget: campaign.lifetime_budget ? parseFloat(campaign.lifetime_budget) / 100 : null,
          startDate: campaign.start_time ? new Date(campaign.start_time) : null,
          endDate: campaign.stop_time ? new Date(campaign.stop_time) : null,
        },
      });
    }

    const insights = await fetchMetaInsights(account.accessToken, account.accountId, dateFrom, dateTo);
    let recordsSync = 0;

    for (const insight of insights) {
      const dbCampaign = await prisma.campaign.findUnique({
        where: {
          adAccountId_platformCampaignId: {
            adAccountId: account.id,
            platformCampaignId: insight.campaign_id,
          },
        },
      });

      if (!dbCampaign) continue;

      const { conversions, revenue, leads } = extractConversions(insight);
      const spend = parseFloat(insight.spend);
      const impressions = parseInt(insight.impressions, 10);
      const clicks = parseInt(insight.clicks, 10);
      const reach = parseInt(insight.reach, 10);

      await prisma.campaignMetrics.upsert({
        where: {
          campaignId_date: {
            campaignId: dbCampaign.id,
            date: new Date(insight.date_start),
          },
        },
        update: {
          spend,
          impressions,
          reach,
          clicks,
          conversions,
          revenue,
          leads,
          ctr: parseFloat(insight.ctr),
          cpc: parseFloat(insight.cpc),
          cpm: parseFloat(insight.cpm),
          cpa: conversions > 0 ? spend / conversions : 0,
          roas: spend > 0 ? revenue / spend : 0,
          frequency: parseFloat(insight.frequency),
        },
        create: {
          campaignId: dbCampaign.id,
          date: new Date(insight.date_start),
          spend,
          impressions,
          reach,
          clicks,
          conversions,
          revenue,
          leads,
          ctr: parseFloat(insight.ctr),
          cpc: parseFloat(insight.cpc),
          cpm: parseFloat(insight.cpm),
          cpa: conversions > 0 ? spend / conversions : 0,
          roas: spend > 0 ? revenue / spend : 0,
          frequency: parseFloat(insight.frequency),
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

async function syncGoogleAccount(account: {
  id: string;
  accountId: string;
  accessToken: string | null;
}) {
  if (!account.accessToken) throw new Error("No access token for Google account");

  const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN;
  if (!developerToken) throw new Error("Missing GOOGLE_DEVELOPER_TOKEN");

  const days = syncHistoryDays();
  const dateFrom = format(subDays(new Date(), days), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  const syncLog = await prisma.syncLog.create({
    data: { adAccountId: account.id, status: "running" },
  });

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
      const impressions = parseInt(metric.metrics.impressions, 10);
      const clicks = parseInt(metric.metrics.clicks, 10);
      const conversions = Math.round(metric.metrics.conversions);
      const revenue = metric.metrics.conversionsValue;
      const cpc = microsToDecimal(metric.metrics.averageCpc);
      const cpm = microsToDecimal(metric.metrics.averageCpm);

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
          ctr: metric.metrics.ctr * 100,
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
          ctr: metric.metrics.ctr * 100,
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

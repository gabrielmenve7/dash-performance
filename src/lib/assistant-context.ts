import { subDays } from "date-fns";
import {
  getOverviewMetricsForClient,
  getAssistantCampaignSummaries,
  getDailyMetrics,
  getAssistantAdLevelSummaries,
} from "@/lib/data";

function assistantHistoryDays(): number {
  const n = parseInt(process.env.ADS_SYNC_HISTORY_DAYS ?? "90", 10);
  if (Number.isNaN(n) || n < 7) return 90;
  return Math.min(n, 365);
}

type AssistantDaily = {
  date: string;
  spend: number;
  conversationsStarted: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

function summarizeWindow(daily: AssistantDaily[], days: number) {
  const slice = daily.slice(-days);
  return {
    days,
    rows: slice.length,
    spend: slice.reduce((acc, d) => acc + d.spend, 0),
    conversationsStarted: slice.reduce((acc, d) => acc + d.conversationsStarted, 0),
    clicks: slice.reduce((acc, d) => acc + d.clicks, 0),
    impressions: slice.reduce((acc, d) => acc + d.impressions, 0),
  };
}

/** Resumo estruturado (últimos ~30 dias) para o system prompt do assistente. */
export async function buildAssistantContextJson(clientId: string): Promise<string> {
  const to = new Date();
  const from = subDays(to, assistantHistoryDays());
  const [totals, campaigns, daily, ads] = await Promise.all([
    getOverviewMetricsForClient(clientId, from, to),
    getAssistantCampaignSummaries(clientId, from, to, 40),
    getDailyMetrics(clientId, from, to),
    getAssistantAdLevelSummaries(clientId, from, to),
  ]);

  const dailyRows: AssistantDaily[] = daily.map((d) => ({
    date: d.date,
    spend: d.spend,
    conversationsStarted: d.conversions,
    clicks: d.clicks,
    impressions: d.impressions,
    ctr: d.ctr,
    cpc: d.cpc,
  }));

  const campaignsWithSpend = campaigns.filter((c) => c.metrics.spend > 0);
  const statusBreakdown = campaignsWithSpend.reduce<Record<string, number>>((acc, c) => {
    const key = c.status ?? "UNKNOWN";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return JSON.stringify(
    {
      clientId,
      granularity: "daily",
      period: { from: from.toISOString(), to: to.toISOString() },
      note:
        "ads: performance por anúncio Meta no período (nomes de campanha, conjunto e anúncio + métricas). Não inclui URL de criativo; use ads para comparar desempenho por nomenclatura.",
      totals,
      summaries: {
        last7d: summarizeWindow(dailyRows, 7),
        last14d: summarizeWindow(dailyRows, 14),
        last30d: summarizeWindow(dailyRows, 30),
        campaigns: {
          total: campaigns.length,
          withSpendInWindow: campaignsWithSpend.length,
          statusBreakdownWithSpend: statusBreakdown,
        },
      },
      daily: dailyRows,
      campaigns: campaigns.map((c) => ({
        name: c.name,
        platform: c.platform,
        status: c.status,
        objective: c.objective,
        spend: c.metrics.spend,
        conversationsStarted: c.metrics.conversions,
        clicks: c.metrics.clicks,
        impressions: c.metrics.impressions,
        ctr: c.metrics.ctr,
        costPerConversation: c.metrics.cpa,
      })),
      ads: ads.map((a) => ({
        adName: a.adName,
        adSetName: a.adSetName,
        campaignName: a.campaignName,
        spend: a.spend,
        conversationsStarted: a.conversationsStarted,
        clicks: a.clicks,
        impressions: a.impressions,
        ctr: a.ctr,
        cpc: a.cpc,
        costPerConversation: a.costPerConversation,
      })),
    },
    null,
    0
  );
}

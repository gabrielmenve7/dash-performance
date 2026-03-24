import { subDays } from "date-fns";
import { getOverviewMetricsForClient, getAssistantCampaignSummaries, getDailyMetrics } from "@/lib/data";

function assistantHistoryDays(): number {
  const n = parseInt(process.env.ADS_SYNC_HISTORY_DAYS ?? "90", 10);
  if (Number.isNaN(n) || n < 7) return 90;
  return Math.min(n, 365);
}

/** Resumo estruturado (últimos ~30 dias) para o system prompt do assistente. */
export async function buildAssistantContextJson(clientId: string): Promise<string> {
  const to = new Date();
  const from = subDays(to, assistantHistoryDays());
  const [totals, campaigns, daily] = await Promise.all([
    getOverviewMetricsForClient(clientId, from, to),
    getAssistantCampaignSummaries(clientId, from, to, 40),
    getDailyMetrics(clientId, from, to),
  ]);

  return JSON.stringify(
    {
      clientId,
      granularity: "daily",
      period: { from: from.toISOString(), to: to.toISOString() },
      totals,
      daily: daily.map((d) => ({
        date: d.date,
        spend: d.spend,
        conversationsStarted: d.conversions,
        clicks: d.clicks,
        impressions: d.impressions,
        ctr: d.ctr,
        cpc: d.cpc,
      })),
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
    },
    null,
    0
  );
}

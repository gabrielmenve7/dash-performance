import { subDays } from "date-fns";
import { getOverviewMetricsForClient, getAssistantCampaignSummaries } from "@/lib/data";

/** Resumo estruturado (últimos ~30 dias) para o system prompt do assistente. */
export async function buildAssistantContextJson(clientId: string): Promise<string> {
  const to = new Date();
  const from = subDays(to, 30);
  const [totals, campaigns] = await Promise.all([
    getOverviewMetricsForClient(clientId, from, to),
    getAssistantCampaignSummaries(clientId, from, to, 40),
  ]);

  return JSON.stringify(
    {
      clientId,
      period: { from: from.toISOString(), to: to.toISOString() },
      totals,
      campaigns: campaigns.map((c) => ({
        name: c.name,
        platform: c.platform,
        status: c.status,
        objective: c.objective,
        spend: c.metrics.spend,
        revenue: c.metrics.revenue,
        roas: c.metrics.roas,
        conversions: c.metrics.conversions,
        clicks: c.metrics.clicks,
        impressions: c.metrics.impressions,
        ctr: c.metrics.ctr,
        cpa: c.metrics.cpa,
      })),
    },
    null,
    0
  );
}

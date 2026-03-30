import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { CampaignDetailDashboard } from "@/features/clients/campaign-detail";

interface Props {
  params: Promise<{ clientId: string; campaignId: string }>;
}

export default async function CampaignDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { clientId, campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      adAccount: { include: { client: true } },
      metrics: {
        where: { date: { gte: subDays(new Date(), 30), lte: new Date() } },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!campaign || campaign.adAccount.clientId !== clientId) notFound();

  const dailyData = campaign.metrics.map((m) => ({
    date: m.date.toISOString().split("T")[0],
    spend: m.spend,
    impressions: m.impressions,
    clicks: m.clicks,
    conversions: m.conversions,
    purchases: m.purchases,
    revenue: m.revenue,
    ctr: m.ctr,
    cpc: m.cpc,
    roas: m.roas,
  }));

  const totals = campaign.metrics.reduce(
    (acc, m) => ({
      spend: acc.spend + m.spend,
      impressions: acc.impressions + m.impressions,
      reach: acc.reach + m.reach,
      clicks: acc.clicks + m.clicks,
      conversions: acc.conversions + m.conversions,
      purchases: acc.purchases + m.purchases,
      revenue: acc.revenue + m.revenue,
      leads: acc.leads + m.leads,
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, conversions: 0, purchases: 0, revenue: 0, leads: 0 }
  );

  const metrics = {
    ...totals,
    ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
    cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
    cpm: totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0,
    cpa: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
    roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
    frequency: totals.reach > 0 ? totals.impressions / totals.reach : 0,
  };

  return (
    <CampaignDetailDashboard
      campaign={{
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective,
        platform: campaign.adAccount.platform,
        accountName: campaign.adAccount.accountName,
        dailyBudget: campaign.dailyBudget,
        startDate: campaign.startDate?.toISOString() ?? null,
      }}
      clientId={clientId}
      clientName={campaign.adAccount.client.name}
      metrics={metrics}
      dailyData={dailyData}
    />
  );
}

"use client";

import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Eye,
  BarChart3,
  Radio,
  Users,
  Zap,
} from "lucide-react";
import type { MetricsSummary, DailyMetric } from "@/types";

interface CampaignDetailDashboardProps {
  campaign: {
    id: string;
    name: string;
    status: string;
    objective: string | null;
    platform: string;
    accountName: string;
    dailyBudget: number | null;
    startDate: string | null;
  };
  clientId: string;
  clientName: string;
  metrics: MetricsSummary;
  dailyData: DailyMetric[];
}

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativa", variant: "success" },
  PAUSED: { label: "Pausada", variant: "warning" },
  REMOVED: { label: "Removida", variant: "destructive" },
  ARCHIVED: { label: "Arquivada", variant: "secondary" },
};

export function CampaignDetailDashboard({
  campaign,
  clientId,
  clientName,
  metrics,
  dailyData,
}: CampaignDetailDashboardProps) {
  const status = statusMap[campaign.status] || statusMap.ACTIVE;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/clients/${clientId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{campaign.name}</h1>
            <Badge variant={status.variant}>{status.label}</Badge>
            <Badge variant="secondary">
              {campaign.platform === "META" ? "Meta Ads" : "Google Ads"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {clientName} &middot; {campaign.accountName}
            {campaign.objective && ` &middot; ${campaign.objective}`}
          </p>
        </div>
      </div>

      {campaign.dailyBudget && (
        <Card>
          <CardContent className="p-4 flex items-center gap-6 text-sm">
            <div>
              <span className="text-muted-foreground">Orçamento Diário:</span>{" "}
              <span className="font-medium">{formatCurrency(campaign.dailyBudget)}</span>
            </div>
            {campaign.startDate && (
              <div>
                <span className="text-muted-foreground">Início:</span>{" "}
                <span className="font-medium">
                  {new Date(campaign.startDate).toLocaleDateString("pt-BR")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Investimento" value={formatCurrency(metrics.spend)} icon={DollarSign} />
        <KpiCard title="Receita" value={formatCurrency(metrics.revenue)} icon={TrendingUp} />
        <KpiCard title="ROAS" value={`${metrics.roas.toFixed(2)}x`} icon={BarChart3} />
        <KpiCard title="Conversões" value={formatNumber(metrics.conversions)} icon={Target} />
        <KpiCard title="CPA" value={formatCurrency(metrics.cpa)} icon={DollarSign} />
        <KpiCard title="Leads" value={formatNumber(metrics.leads)} icon={Zap} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Cliques" value={formatNumber(metrics.clicks)} icon={MousePointerClick} />
        <KpiCard title="CTR" value={`${metrics.ctr.toFixed(2)}%`} icon={MousePointerClick} />
        <KpiCard title="CPC" value={formatCurrency(metrics.cpc)} icon={DollarSign} />
        <KpiCard title="CPM" value={formatCurrency(metrics.cpm)} icon={Radio} />
        <KpiCard title="Impressões" value={formatNumber(metrics.impressions)} icon={Eye} />
        <KpiCard title="Alcance" value={formatNumber(metrics.reach)} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart
          data={dailyData}
          title="Investimento vs Receita (Diário)"
          metrics={[
            { key: "spend", label: "Investimento", color: "#3b82f6" },
            { key: "revenue", label: "Receita", color: "#10b981" },
          ]}
        />
        <PerformanceChart
          data={dailyData}
          title="Conversões Diárias"
          metrics={[
            { key: "conversions", label: "Conversões", color: "#8b5cf6" },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart
          data={dailyData}
          title="CTR e CPC Diário"
          metrics={[
            { key: "ctr", label: "CTR (%)", color: "#f59e0b" },
            { key: "cpc", label: "CPC (R$)", color: "#ef4444" },
          ]}
        />
        <PerformanceChart
          data={dailyData}
          title="ROAS Diário"
          metrics={[
            { key: "roas", label: "ROAS", color: "#10b981" },
          ]}
        />
      </div>
    </div>
  );
}

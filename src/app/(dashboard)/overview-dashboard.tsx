"use client";

import { useState } from "react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ClientsTable } from "@/components/dashboard/clients-table";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { formatCurrency, formatNumber, getChangeIndicator } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Eye,
  BarChart3,
} from "lucide-react";
import { subDays } from "date-fns";
import type { MetricsSummary, ClientWithMetrics, DailyMetric } from "@/types";

interface OverviewDashboardProps {
  metrics: MetricsSummary;
  previousMetrics: MetricsSummary;
  clients: ClientWithMetrics[];
  dailyData: DailyMetric[];
}

export function OverviewDashboard({
  metrics,
  previousMetrics,
  clients,
  dailyData,
}: OverviewDashboardProps) {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const spendChange = getChangeIndicator(metrics.spend, previousMetrics.spend);
  const revenueChange = getChangeIndicator(metrics.revenue, previousMetrics.revenue);
  const roasChange = getChangeIndicator(metrics.roas, previousMetrics.roas);
  const conversionsChange = getChangeIndicator(metrics.conversions, previousMetrics.conversions);
  const cpaChange = getChangeIndicator(metrics.cpa, previousMetrics.cpa);
  const clicksChange = getChangeIndicator(metrics.clicks, previousMetrics.clicks);
  const impressionsChange = getChangeIndicator(metrics.impressions, previousMetrics.impressions);
  const ctrChange = getChangeIndicator(metrics.ctr, previousMetrics.ctr);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Overview</h1>
          <p className="text-muted-foreground">
            Visão geral da performance de todos os clientes
          </p>
        </div>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(from, to) => setDateRange({ from, to })}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Investimento Total"
          value={formatCurrency(metrics.spend)}
          change={spendChange.change}
          icon={DollarSign}
          invertChange
        />
        <KpiCard
          title="Receita Total"
          value={formatCurrency(metrics.revenue)}
          change={revenueChange.change}
          icon={TrendingUp}
        />
        <KpiCard
          title="ROAS Médio"
          value={`${metrics.roas.toFixed(2)}x`}
          change={roasChange.change}
          icon={BarChart3}
        />
        <KpiCard
          title="Conversões"
          value={formatNumber(metrics.conversions)}
          change={conversionsChange.change}
          icon={Target}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="CPA Médio"
          value={formatCurrency(metrics.cpa)}
          change={cpaChange.change}
          icon={DollarSign}
          invertChange
        />
        <KpiCard
          title="Cliques"
          value={formatNumber(metrics.clicks)}
          change={clicksChange.change}
          icon={MousePointerClick}
        />
        <KpiCard
          title="Impressões"
          value={formatNumber(metrics.impressions)}
          change={impressionsChange.change}
          icon={Eye}
        />
        <KpiCard
          title="CTR Médio"
          value={`${metrics.ctr.toFixed(2)}%`}
          change={ctrChange.change}
          icon={MousePointerClick}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart
          data={dailyData}
          title="Investimento vs Receita"
          metrics={[
            { key: "spend", label: "Investimento", color: "#3b82f6" },
            { key: "revenue", label: "Receita", color: "#10b981" },
          ]}
        />
        <PerformanceChart
          data={dailyData}
          title="Conversões e Cliques"
          metrics={[
            { key: "conversions", label: "Conversões", color: "#8b5cf6" },
            { key: "clicks", label: "Cliques", color: "#f59e0b" },
          ]}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Clientes</h2>
        <ClientsTable clients={clients} />
      </div>
    </div>
  );
}

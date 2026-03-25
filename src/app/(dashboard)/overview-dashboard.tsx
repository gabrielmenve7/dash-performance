"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { formatCurrency, formatNumber, getChangeIndicator } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Target,
  MousePointerClick,
  Eye,
  BarChart3,
} from "lucide-react";
import { format as formatDate, subDays } from "date-fns";
import { toast } from "sonner";
import type { MetricsSummary, DailyMetric, CampaignWithMetrics } from "@/types";

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativa", variant: "success" },
  PAUSED: { label: "Pausada", variant: "warning" },
  REMOVED: { label: "Removida", variant: "destructive" },
  ARCHIVED: { label: "Arquivada", variant: "secondary" },
};

function objectiveLabel(objective: string) {
  const value = objective.toUpperCase();
  if (isConversationObjective(value)) {
    return "Conversas";
  }
  return "Outros objetivos";
}

function isConversationObjective(raw: string) {
  const value = raw.toUpperCase();
  return (
    value.includes("MESSAGE") ||
    value.includes("MESSAGING") ||
    value.includes("MENSAG") ||
    value.includes("CONVERSA") ||
    value.includes("WHATSAPP") ||
    value.includes("OUTCOME_ENGAGEMENT") ||
    value.includes("OUTCOME_TRAFFIC")
  );
}

interface OverviewDashboardProps {
  client: { id: string; name: string; slug: string; industry: string | null };
  clientOptions: { id: string; name: string }[];
  metrics: MetricsSummary;
  previousMetrics: MetricsSummary;
  dailyData: DailyMetric[];
  campaigns: CampaignWithMetrics[];
}

export function OverviewDashboard({
  client,
  clientOptions,
  metrics: initialMetrics,
  previousMetrics: initialPreviousMetrics,
  dailyData: initialDailyData,
  campaigns: initialCampaigns,
}: OverviewDashboardProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"CONVERSAS" | "COMPRAS">("CONVERSAS");
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [dashMetrics, setDashMetrics] = useState(initialMetrics);
  const [dashPreviousMetrics, setDashPreviousMetrics] = useState(initialPreviousMetrics);
  const [dashDailyData, setDashDailyData] = useState(initialDailyData);
  const [dashCampaigns, setDashCampaigns] = useState(initialCampaigns);
  const [dashLoading, setDashLoading] = useState(false);
  const isInitialMount = useRef(true);

  useEffect(() => {
    setDashMetrics(initialMetrics);
    setDashPreviousMetrics(initialPreviousMetrics);
    setDashDailyData(initialDailyData);
    setDashCampaigns(initialCampaigns);
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    setMode("CONVERSAS");
    isInitialMount.current = true;
  }, [client.id, initialMetrics, initialPreviousMetrics, initialDailyData, initialCampaigns]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      from: formatDate(dateRange.from, "yyyy-MM-dd"),
      to: formatDate(dateRange.to, "yyyy-MM-dd"),
      platform: mode === "COMPRAS" ? "META" : "ALL",
      objective: mode,
    });

    setDashLoading(true);
    fetch(`/api/clients/${client.id}/dashboard?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{
          campaigns: CampaignWithMetrics[];
          metrics: MetricsSummary;
          dailyData: DailyMetric[];
          previousMetrics: MetricsSummary;
        }>;
      })
      .then((data) => {
        setDashCampaigns(data.campaigns);
        setDashMetrics(data.metrics);
        setDashDailyData(data.dailyData);
        setDashPreviousMetrics(data.previousMetrics);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        toast.error("Não foi possível carregar os dados do período");
      })
      .finally(() => setDashLoading(false));

    return () => controller.abort();
  }, [client.id, dateRange.from, dateRange.to, mode]);

  function onClientChange(nextId: string) {
    router.push(`/?client=${nextId}`);
    router.refresh();
  }

  const spendChange = getChangeIndicator(dashMetrics.spend, dashPreviousMetrics.spend);
  const conversionsChange = getChangeIndicator(dashMetrics.conversions, dashPreviousMetrics.conversions);
  const cpaChange = getChangeIndicator(dashMetrics.cpa, dashPreviousMetrics.cpa);
  const cpcChange = getChangeIndicator(dashMetrics.cpc, dashPreviousMetrics.cpc);
  const cpmChange = getChangeIndicator(dashMetrics.cpm, dashPreviousMetrics.cpm);
  const clicksChange = getChangeIndicator(dashMetrics.clicks, dashPreviousMetrics.clicks);
  const impressionsChange = getChangeIndicator(dashMetrics.impressions, dashPreviousMetrics.impressions);
  const ctrChange = getChangeIndicator(dashMetrics.ctr, dashPreviousMetrics.ctr);
  const purchasesChange = getChangeIndicator(dashMetrics.purchases, dashPreviousMetrics.purchases);
  const revenueChange = getChangeIndicator(dashMetrics.revenue, dashPreviousMetrics.revenue);
  const roasChange = getChangeIndicator(dashMetrics.roas, dashPreviousMetrics.roas);

  const periodLabel = `${dateRange.from.toLocaleDateString("pt-BR")} — ${dateRange.to.toLocaleDateString("pt-BR")}`;
  const conversionTitle = mode === "COMPRAS" ? "Compras" : "Conversas Iniciadas";
  const modeLabel = mode === "COMPRAS" ? "Objetivo: Vendas" : "Objetivo: Conversas";
  const costPerPurchase = dashMetrics.purchases > 0 ? dashMetrics.spend / dashMetrics.purchases : 0;
  const prevCostPerPurchase =
    dashPreviousMetrics.purchases > 0 ? dashPreviousMetrics.spend / dashPreviousMetrics.purchases : 0;
  const costPerPurchaseChange = getChangeIndicator(costPerPurchase, prevCostPerPurchase);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Select value={client.id} onValueChange={onClientChange}>
              <SelectTrigger className="w-full sm:w-[280px] h-11 text-base font-semibold">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {client.industry && (
              <Badge variant="secondary" className="w-fit">
                {client.industry}
              </Badge>
            )}
            <Select value={mode} onValueChange={(v) => setMode(v as "CONVERSAS" | "COMPRAS")}>
              <SelectTrigger className="w-full sm:w-[220px] h-10">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CONVERSAS">Conversas</SelectItem>
                <SelectItem value="COMPRAS">Vendas</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="w-fit">{modeLabel}</Badge>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
            <p className="text-muted-foreground">
              Performance de <span className="text-foreground font-medium">{client.name}</span>
              {" · "}
              {dashLoading ? "…" : periodLabel}
            </p>
          </div>
        </div>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(from, to) => setDateRange({ from, to })}
        />
      </div>

      {mode === "CONVERSAS" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Investimento Total"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.spend)}
              change={spendChange.change}
              icon={DollarSign}
              invertChange
            />
            <KpiCard
              title={conversionTitle}
              value={dashLoading ? "…" : formatNumber(dashMetrics.conversions)}
              change={conversionsChange.change}
              icon={Target}
            />
            <KpiCard
              title="Cliques"
              value={dashLoading ? "…" : formatNumber(dashMetrics.clicks)}
              change={clicksChange.change}
              icon={MousePointerClick}
            />
            <KpiCard
              title="CTR Médio"
              value={dashLoading ? "…" : `${dashMetrics.ctr.toFixed(2)}%`}
              change={ctrChange.change}
              icon={MousePointerClick}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Custo por Conversa"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.cpa)}
              change={cpaChange.change}
              icon={DollarSign}
              invertChange
            />
            <KpiCard
              title="Impressões"
              value={dashLoading ? "…" : formatNumber(dashMetrics.impressions)}
              change={impressionsChange.change}
              icon={Eye}
            />
            <KpiCard
              title="CPC Médio"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.cpc)}
              change={cpcChange.change}
              icon={MousePointerClick}
              invertChange
            />
            <KpiCard
              title="CPM Médio"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.cpm)}
              change={cpmChange.change}
              icon={BarChart3}
              invertChange
            />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Investimento (Vendas)"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.spend)}
              change={spendChange.change}
              icon={DollarSign}
              invertChange
            />
            <KpiCard
              title="Compras"
              value={dashLoading ? "…" : formatNumber(dashMetrics.purchases)}
              change={purchasesChange.change}
              icon={Target}
            />
            <KpiCard
              title="Receita"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.revenue)}
              change={revenueChange.change}
              icon={DollarSign}
            />
            <KpiCard
              title="ROAS"
              value={dashLoading ? "…" : dashMetrics.roas.toFixed(2)}
              change={roasChange.change}
              icon={BarChart3}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Custo por Compra"
              value={dashLoading ? "…" : formatCurrency(costPerPurchase)}
              change={costPerPurchaseChange.change}
              icon={DollarSign}
              invertChange
            />
            <KpiCard
              title="Cliques"
              value={dashLoading ? "…" : formatNumber(dashMetrics.clicks)}
              change={clicksChange.change}
              icon={MousePointerClick}
            />
            <KpiCard
              title="Impressões"
              value={dashLoading ? "…" : formatNumber(dashMetrics.impressions)}
              change={impressionsChange.change}
              icon={Eye}
            />
            <KpiCard
              title="CPC Médio"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.cpc)}
              change={cpcChange.change}
              icon={MousePointerClick}
              invertChange
            />
          </div>
        </>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {mode === "COMPRAS" ? (
          <PerformanceChart
            data={dashDailyData}
            title="Investimento e Compras"
            metrics={[
              { key: "spend", label: "Investimento", color: "#3b82f6" },
              { key: "purchases", label: "Compras", color: "#8b5cf6" },
            ]}
          />
        ) : (
          <PerformanceChart
            data={dashDailyData}
            title="Investimento e Conversas Iniciadas"
            metrics={[
              { key: "spend", label: "Investimento", color: "#3b82f6" },
              { key: "conversions", label: "Conversas Iniciadas", color: "#8b5cf6" },
            ]}
          />
        )}
        <PerformanceChart
          data={dashDailyData}
          title={mode === "COMPRAS" ? "Receita e ROAS" : "Cliques e Impressões"}
          metrics={
            mode === "COMPRAS"
              ? [
                  { key: "revenue", label: "Receita", color: "#10b981" },
                  { key: "roas", label: "ROAS", color: "#f59e0b" },
                ]
              : [
                  { key: "clicks", label: "Cliques", color: "#f59e0b" },
                  { key: "impressions", label: "Impressões", color: "#10b981" },
                ]
          }
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Campanhas deste cliente</h2>
          <Link
            href={`/clients/${client.id}`}
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            Ver página do cliente
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  {mode === "COMPRAS" ? (
                    <>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">ROAS</TableHead>
                    </>
                  ) : (
                    <TableHead className="text-right">Conversas Iniciadas</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashCampaigns.map((campaign) => {
                  const status = statusMap[campaign.status] || statusMap.ACTIVE;
                  return (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link
                          href={`/clients/${client.id}/campaigns/${campaign.id}`}
                          className="font-medium hover:text-primary transition-colors"
                        >
                          {campaign.name}
                        </Link>
                        {campaign.objective && (
                          <p className="text-xs text-muted-foreground">{objectiveLabel(campaign.objective)}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {campaign.platform === "META" ? "Meta" : "Google"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(campaign.metrics.spend)}</TableCell>
                      {mode === "COMPRAS" ? (
                        <>
                          <TableCell className="text-right">{formatNumber(campaign.metrics.purchases)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(campaign.metrics.revenue)}</TableCell>
                          <TableCell className="text-right">{campaign.metrics.roas.toFixed(2)}</TableCell>
                        </>
                      ) : (
                        <TableCell className="text-right">{formatNumber(campaign.metrics.conversions)}</TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {dashCampaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={mode === "COMPRAS" ? 7 : 5} className="h-24 text-center text-muted-foreground">
                      Nenhuma campanha no período
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

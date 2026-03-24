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
  TrendingUp,
  Target,
  MousePointerClick,
  Eye,
  BarChart3,
} from "lucide-react";
import { subDays } from "date-fns";
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
  if (isPurchaseObjective(value)) {
    return "Compras";
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
    value.includes("LEAD") ||
    value.includes("OUTCOME_LEADS")
  );
}

function isPurchaseObjective(raw: string) {
  const value = raw.toUpperCase();
  return (
    value.includes("SALE") ||
    value.includes("SALES") ||
    value.includes("PURCHASE") ||
    value.includes("COMPRA") ||
    value.includes("SHOPPING") ||
    value.includes("OUTCOME_SALES")
  );
}

function objectiveGroup(raw: string | null | undefined): "CONVERSAS" | "COMPRAS" | "OUTROS" {
  const value = (raw ?? "").toUpperCase();
  if (isConversationObjective(value)) return "CONVERSAS";
  if (isPurchaseObjective(value)) return "COMPRAS";
  return "OUTROS";
}

function hasPurchaseObjective(campaigns: CampaignWithMetrics[]) {
  return campaigns.some((c) => objectiveGroup(c.objective) === "COMPRAS");
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
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [dashMetrics, setDashMetrics] = useState(initialMetrics);
  const [dashPreviousMetrics, setDashPreviousMetrics] = useState(initialPreviousMetrics);
  const [dashDailyData, setDashDailyData] = useState(initialDailyData);
  const [dashCampaigns, setDashCampaigns] = useState(initialCampaigns);
  const [objective, setObjective] = useState<string>("ALL");
  const [dashLoading, setDashLoading] = useState(false);
  const isInitialMount = useRef(true);
  const [objectiveOptions, setObjectiveOptions] = useState<string[]>(() =>
    Array.from(
      new Set(
        initialCampaigns
          .map((c) => c.objective)
          .filter((o): o is string => Boolean(o))
          .map((o) => objectiveGroup(o))
      )
    ).sort()
  );

  useEffect(() => {
    setDashMetrics(initialMetrics);
    setDashPreviousMetrics(initialPreviousMetrics);
    setDashDailyData(initialDailyData);
    setDashCampaigns(initialCampaigns);
    setObjective("ALL");
    setObjectiveOptions(
      Array.from(
        new Set(
          initialCampaigns
            .map((c) => c.objective)
            .filter((o): o is string => Boolean(o))
            .map((o) => objectiveGroup(o))
        )
      ).sort()
    );
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    isInitialMount.current = true;
  }, [client.id, initialMetrics, initialPreviousMetrics, initialDailyData, initialCampaigns]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      platform: "ALL",
      objective,
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
        setObjectiveOptions((prev) =>
          Array.from(
            new Set([
              ...prev,
              ...data.campaigns
                .map((c) => c.objective)
                .filter((o): o is string => Boolean(o))
                .map((o) => objectiveGroup(o)),
            ])
          ).sort()
        );
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        toast.error("Não foi possível carregar os dados do período");
      })
      .finally(() => setDashLoading(false));

    return () => controller.abort();
  }, [client.id, dateRange.from, dateRange.to, objective]);

  function onClientChange(nextId: string) {
    router.push(`/?client=${nextId}`);
    router.refresh();
  }

  const spendChange = getChangeIndicator(dashMetrics.spend, dashPreviousMetrics.spend);
  const revenueChange = getChangeIndicator(dashMetrics.revenue, dashPreviousMetrics.revenue);
  const roasChange = getChangeIndicator(dashMetrics.roas, dashPreviousMetrics.roas);
  const conversionsChange = getChangeIndicator(dashMetrics.conversions, dashPreviousMetrics.conversions);
  const cpaChange = getChangeIndicator(dashMetrics.cpa, dashPreviousMetrics.cpa);
  const cpcChange = getChangeIndicator(dashMetrics.cpc, dashPreviousMetrics.cpc);
  const cpmChange = getChangeIndicator(dashMetrics.cpm, dashPreviousMetrics.cpm);
  const clicksChange = getChangeIndicator(dashMetrics.clicks, dashPreviousMetrics.clicks);
  const impressionsChange = getChangeIndicator(dashMetrics.impressions, dashPreviousMetrics.impressions);
  const ctrChange = getChangeIndicator(dashMetrics.ctr, dashPreviousMetrics.ctr);

  const periodLabel = `${dateRange.from.toLocaleDateString("pt-BR")} — ${dateRange.to.toLocaleDateString("pt-BR")}`;
  const selectedObjectiveGroup = objective === "ALL" ? "ALL" : objective;
  const showCommerceKpis =
    selectedObjectiveGroup === "COMPRAS" || (objective === "ALL" && hasPurchaseObjective(dashCampaigns));
  const conversionTitle = selectedObjectiveGroup === "CONVERSAS" ? "Conversas Iniciadas" : "Conversões";

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
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os objetivos</SelectItem>
                {objectiveOptions.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group === "CONVERSAS" ? "Conversas" : group === "COMPRAS" ? "Compras" : "Outros objetivos"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        {showCommerceKpis ? (
          <>
            <KpiCard
              title="Receita Total"
              value={dashLoading ? "…" : formatCurrency(dashMetrics.revenue)}
              change={revenueChange.change}
              icon={TrendingUp}
            />
            <KpiCard
              title="ROAS Médio"
              value={dashLoading ? "…" : `${dashMetrics.roas.toFixed(2)}x`}
              change={roasChange.change}
              icon={BarChart3}
            />
          </>
        ) : (
          <>
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
          </>
        )}
      </div>

      {showCommerceKpis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="CPA Médio"
            value={dashLoading ? "…" : formatCurrency(dashMetrics.cpa)}
            change={cpaChange.change}
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
            title="CTR Médio"
            value={dashLoading ? "…" : `${dashMetrics.ctr.toFixed(2)}%`}
            change={ctrChange.change}
            icon={MousePointerClick}
          />
        </div>
      ) : (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PerformanceChart
          data={dashDailyData}
          title="Investimento vs Receita"
          metrics={[
            { key: "spend", label: "Investimento", color: "#3b82f6" },
            { key: "revenue", label: "Receita", color: "#10b981" },
          ]}
        />
        <PerformanceChart
          data={dashDailyData}
          title="Conversões e Cliques"
          metrics={[
            { key: "conversions", label: "Conversões", color: "#8b5cf6" },
            { key: "clicks", label: "Cliques", color: "#f59e0b" },
          ]}
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
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
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
                      <TableCell className="text-right">{formatCurrency(campaign.metrics.revenue)}</TableCell>
                      <TableCell className="text-right font-medium">{campaign.metrics.roas.toFixed(2)}x</TableCell>
                      <TableCell className="text-right">{formatNumber(campaign.metrics.conversions)}</TableCell>
                    </TableRow>
                  );
                })}
                {dashCampaigns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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

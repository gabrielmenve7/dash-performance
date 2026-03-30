"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PerformanceChart } from "@/components/charts/performance-chart";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { PlatformFilter } from "@/components/dashboard/platform-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/utils";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Target,
  MousePointerClick,
  Eye,
  BarChart3,
  Send,
  Radio,
} from "lucide-react";
import { subDays } from "date-fns";
import { toast } from "sonner";
import type { MetricsSummary, CampaignWithMetrics, DailyMetric, PlatformType } from "@/types";

interface ClientDetailDashboardProps {
  client: { id: string; name: string; slug: string; industry: string | null };
  campaigns: CampaignWithMetrics[];
  metrics: MetricsSummary;
  dailyData: DailyMetric[];
  notes: { id: string; content: string; userName: string; createdAt: string }[];
}

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativa", variant: "success" },
  PAUSED: { label: "Pausada", variant: "warning" },
  REMOVED: { label: "Removida", variant: "destructive" },
  ARCHIVED: { label: "Arquivada", variant: "secondary" },
};

export function ClientDetailDashboard({
  client,
  campaigns,
  metrics,
  dailyData,
  notes: initialNotes,
}: ClientDetailDashboardProps) {
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [platform, setPlatform] = useState<PlatformType | "ALL">("ALL");
  const [dashCampaigns, setDashCampaigns] = useState(campaigns);
  const [dashMetrics, setDashMetrics] = useState(metrics);
  const [dashDailyData, setDashDailyData] = useState(dailyData);
  const [dashLoading, setDashLoading] = useState(false);
  const isInitialMount = useRef(true);

  const [notes, setNotes] = useState(initialNotes);
  const [noteText, setNoteText] = useState("");
  const [sendingNote, setSendingNote] = useState(false);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
      platform,
    });

    setDashLoading(true);
    fetch(`/api/clients/${client.id}/dashboard?${params}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text());
        return res.json() as Promise<{
          campaigns: CampaignWithMetrics[];
          metrics: MetricsSummary;
          dailyData: DailyMetric[];
          previousMetrics?: MetricsSummary;
        }>;
      })
      .then((data) => {
        setDashCampaigns(data.campaigns);
        setDashMetrics(data.metrics);
        setDashDailyData(data.dailyData);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        toast.error("Não foi possível carregar os dados do período");
      })
      .finally(() => setDashLoading(false));

    return () => controller.abort();
  }, [client.id, dateRange.from, dateRange.to, platform]);

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSendingNote(true);

    try {
      const res = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: client.id, content: noteText }),
      });

      if (!res.ok) throw new Error();

      const note = await res.json();
      setNotes([note, ...notes]);
      setNoteText("");
      toast.success("Anotação adicionada");
    } catch {
      toast.error("Erro ao adicionar anotação");
    } finally {
      setSendingNote(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/clients">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{client.name}</h1>
            {client.industry && (
              <Badge variant="secondary">{client.industry}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {dashLoading ? "…" : dashCampaigns.length} campanhas
          </p>
        </div>
        <PlatformFilter value={platform} onChange={setPlatform} />
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(from, to) => setDateRange({ from, to })}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard title="Investimento" value={dashLoading ? "…" : formatCurrency(dashMetrics.spend)} icon={DollarSign} />
        <KpiCard title="Receita" value={dashLoading ? "…" : formatCurrency(dashMetrics.revenue)} icon={TrendingUp} />
        <KpiCard title="ROAS" value={dashLoading ? "…" : `${dashMetrics.roas.toFixed(2)}x`} icon={BarChart3} />
        <KpiCard title="Conversões" value={dashLoading ? "…" : formatNumber(dashMetrics.conversions)} icon={Target} />
        <KpiCard title="CPA" value={dashLoading ? "…" : formatCurrency(dashMetrics.cpa)} icon={DollarSign} />
        <KpiCard title="CTR" value={dashLoading ? "…" : `${dashMetrics.ctr.toFixed(2)}%`} icon={MousePointerClick} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Cliques" value={dashLoading ? "…" : formatNumber(dashMetrics.clicks)} icon={MousePointerClick} />
        <KpiCard title="Impressões" value={dashLoading ? "…" : formatNumber(dashMetrics.impressions)} icon={Eye} />
        <KpiCard title="CPC" value={dashLoading ? "…" : formatCurrency(dashMetrics.cpc)} icon={DollarSign} />
        <KpiCard title="CPM" value={dashLoading ? "…" : formatCurrency(dashMetrics.cpm)} icon={Radio} />
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="notes">Anotações</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-6">
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
              title="Cliques e Conversões"
              metrics={[
                { key: "clicks", label: "Cliques", color: "#f59e0b" },
                { key: "conversions", label: "Conversões", color: "#8b5cf6" },
              ]}
            />
          </div>
          <PerformanceChart
            data={dashDailyData}
            title="ROAS Diário"
            metrics={[
              { key: "roas", label: "ROAS", color: "#10b981" },
            ]}
          />
        </TabsContent>

        <TabsContent value="campaigns">
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
                    <TableHead className="text-right">CPA</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
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
                            className="font-medium hover:text-blue-600 transition-colors"
                          >
                            {campaign.name}
                          </Link>
                          {campaign.objective && (
                            <p className="text-xs text-muted-foreground">{campaign.objective}</p>
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
                        <TableCell className="text-right">{formatCurrency(campaign.metrics.cpa)}</TableCell>
                        <TableCell className="text-right">{campaign.metrics.ctr.toFixed(2)}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {dashCampaigns.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                        Nenhuma campanha encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Adicionar Anotação</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder="Registre decisões da reunião, observações..."
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                />
                <Button onClick={handleAddNote} disabled={sendingNote} className="gap-2">
                  <Send className="w-4 h-4" />
                  Enviar
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {notes.map((note) => (
              <Card key={note.id}>
                <CardContent className="p-4">
                  <p className="text-sm">{note.content}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span className="font-medium">{note.userName}</span>
                    <span>&middot;</span>
                    <span>{new Date(note.createdAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {notes.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma anotação registrada
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

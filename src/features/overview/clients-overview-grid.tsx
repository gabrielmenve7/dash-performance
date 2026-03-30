"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { DollarSign, MessageCircle, ShoppingCart } from "lucide-react";
import type { ClientOverviewCard } from "@/types";

interface ClientsOverviewGridProps {
  clients: ClientOverviewCard[];
}

export function ClientsOverviewGrid({ clients }: ClientsOverviewGridProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="text-muted-foreground">
          Selecione um cliente para ver o dashboard completo
          {" · "}
          Dados dos últimos 7 dias
        </p>
      </div>

      {clients.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Nenhum cliente ativo cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/?client=${client.id}`}>
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-md cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base truncate">{client.name}</h3>
                      {client.industry && (
                        <Badge variant="secondary" className="mt-1 text-[10px]">
                          {client.industry}
                        </Badge>
                      )}
                    </div>
                    <Badge
                      variant={client.dominantType === "COMPRAS" ? "success" : "default"}
                      className="shrink-0 text-[10px]"
                    >
                      {client.dominantType === "COMPRAS" ? "Vendas" : "Conversas"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {client.dominantType === "COMPRAS" ? (
                    <ComprasKpis
                      spend={client.spend}
                      purchases={client.purchases}
                      costPerPurchase={client.costPerPurchase}
                    />
                  ) : (
                    <ConversasKpis
                      spend={client.spend}
                      conversions={client.conversions}
                      costPerConversion={client.costPerConversion}
                    />
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ConversasKpis({
  spend,
  conversions,
  costPerConversion,
}: {
  spend: number;
  conversions: number;
  costPerConversion: number;
}) {
  return (
    <div className="space-y-3">
      <MiniKpi icon={DollarSign} label="Investimento" value={formatCurrency(spend)} />
      <MiniKpi icon={MessageCircle} label="Conversas" value={formatNumber(conversions)} />
      <MiniKpi icon={DollarSign} label="Custo / Conversa" value={formatCurrency(costPerConversion)} />
    </div>
  );
}

function ComprasKpis({
  spend,
  purchases,
  costPerPurchase,
}: {
  spend: number;
  purchases: number;
  costPerPurchase: number;
}) {
  return (
    <div className="space-y-3">
      <MiniKpi icon={DollarSign} label="Investimento" value={formatCurrency(spend)} />
      <MiniKpi icon={ShoppingCart} label="Compras" value={formatNumber(purchases)} />
      <MiniKpi icon={DollarSign} label="Custo / Compra" value={formatCurrency(costPerPurchase)} />
    </div>
  );
}

function MiniKpi({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

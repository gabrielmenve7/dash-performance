"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber, getChangeIndicator } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ClientWithMetrics } from "@/types";

interface ClientsTableProps {
  clients: ClientWithMetrics[];
}

function ChangeIndicator({ current, previous, invert = false }: { current: number; previous?: number; invert?: boolean }) {
  if (previous === undefined) return null;
  const { change, isPositive } = getChangeIndicator(current, previous);
  if (change === 0) return null;
  const color = invert
    ? isPositive ? "text-red-500" : "text-emerald-500"
    : isPositive ? "text-emerald-500" : "text-red-500";

  return (
    <span className={`inline-flex items-center text-xs ${color}`}>
      {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

export function ClientsTable({ clients }: ClientsTableProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Plataformas</TableHead>
            <TableHead className="text-right">Investimento</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">ROAS</TableHead>
            <TableHead className="text-right">Conversões</TableHead>
            <TableHead className="text-right">CPA</TableHead>
            <TableHead className="text-right">Campanhas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id} className="cursor-pointer">
              <TableCell>
                <Link href={`/clients/${client.id}`} className="font-medium hover:text-blue-600 transition-colors">
                  {client.name}
                </Link>
                {client.industry && (
                  <p className="text-xs text-muted-foreground">{client.industry}</p>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {client.platforms.map((p) => (
                    <Badge key={p} variant="secondary" className="text-xs">
                      {p === "META" ? "Meta" : "Google"}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div>{formatCurrency(client.metrics.spend)}</div>
                <ChangeIndicator current={client.metrics.spend} previous={client.previousMetrics?.spend} invert />
              </TableCell>
              <TableCell className="text-right">
                <div>{formatCurrency(client.metrics.revenue)}</div>
                <ChangeIndicator current={client.metrics.revenue} previous={client.previousMetrics?.revenue} />
              </TableCell>
              <TableCell className="text-right">
                <div className="font-medium">
                  {client.metrics.roas.toFixed(2)}x
                </div>
                <ChangeIndicator current={client.metrics.roas} previous={client.previousMetrics?.roas} />
              </TableCell>
              <TableCell className="text-right">
                <div>{formatNumber(client.metrics.conversions)}</div>
                <ChangeIndicator current={client.metrics.conversions} previous={client.previousMetrics?.conversions} />
              </TableCell>
              <TableCell className="text-right">
                <div>{formatCurrency(client.metrics.cpa)}</div>
                <ChangeIndicator current={client.metrics.cpa} previous={client.previousMetrics?.cpa} invert />
              </TableCell>
              <TableCell className="text-right">
                {client.campaignCount}
              </TableCell>
            </TableRow>
          ))}
          {clients.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                Nenhum cliente encontrado
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

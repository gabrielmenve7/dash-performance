"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react";

interface KpiCardProps {
  title: string;
  value: string;
  change?: number;
  icon: LucideIcon;
  invertChange?: boolean;
}

export function KpiCard({ title, value, change, icon: Icon, invertChange }: KpiCardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  const changeColor = invertChange
    ? isPositive ? "text-red-500" : isNegative ? "text-emerald-500" : "text-muted-foreground"
    : isPositive ? "text-emerald-500" : isNegative ? "text-red-500" : "text-muted-foreground";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          <div className="p-2 rounded-lg bg-muted">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {!isNeutral && (
            <span className={cn("flex items-center text-xs font-medium mb-0.5", changeColor)}>
              {isPositive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {Math.abs(change!).toFixed(1)}%
            </span>
          )}
          {isNeutral && change !== undefined && (
            <span className="flex items-center text-xs font-medium text-muted-foreground mb-0.5">
              <Minus className="w-3 h-3" />
              0%
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

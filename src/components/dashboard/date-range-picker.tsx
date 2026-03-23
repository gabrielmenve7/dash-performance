"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { subDays, startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DateRangePickerProps {
  from: Date;
  to: Date;
  onChange: (from: Date, to: Date) => void;
}

const presets = [
  { label: "Últimos 7 dias", getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: "Últimos 14 dias", getValue: () => ({ from: subDays(new Date(), 14), to: new Date() }) },
  { label: "Últimos 30 dias", getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: "Este mês", getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  {
    label: "Mês anterior",
    getValue: () => ({
      from: startOfMonth(subMonths(new Date(), 1)),
      to: endOfMonth(subMonths(new Date(), 1)),
    }),
  },
  { label: "Últimos 90 dias", getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: "Últimos 180 dias", getValue: () => ({ from: subDays(new Date(), 180), to: new Date() }) },
  { label: "Últimos 12 meses", getValue: () => ({ from: subDays(new Date(), 365), to: new Date() }) },
];

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const [label, setLabel] = useState("Últimos 30 dias");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline">{label}</span>
          <span className="sm:hidden">
            {format(from, "dd/MM", { locale: ptBR })} - {format(to, "dd/MM", { locale: ptBR })}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {presets.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => {
              const { from: f, to: t } = preset.getValue();
              setLabel(preset.label);
              onChange(f, t);
            }}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {format(from, "dd/MM/yyyy", { locale: ptBR })} - {format(to, "dd/MM/yyyy", { locale: ptBR })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PlatformType } from "@/types";

interface PlatformFilterProps {
  value: PlatformType | "ALL";
  onChange: (value: PlatformType | "ALL") => void;
}

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[160px]">
        <SelectValue placeholder="Plataforma" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="ALL">Todas</SelectItem>
        <SelectItem value="META">Meta Ads</SelectItem>
        <SelectItem value="GOOGLE">Google Ads</SelectItem>
      </SelectContent>
    </Select>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import type { RegionBreakdown } from "@/types";

const BRAZIL_TOPO_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

const STATE_NAME_MAP: Record<string, string[]> = {
  "Acre": ["Acre"],
  "Alagoas": ["Alagoas"],
  "Amapá": ["Amapá", "Amapa"],
  "Amazonas": ["Amazonas"],
  "Bahia": ["Bahia"],
  "Ceará": ["Ceará", "Ceara"],
  "Distrito Federal": ["Distrito Federal"],
  "Espírito Santo": ["Espírito Santo", "Espirito Santo"],
  "Goiás": ["Goiás", "Goias"],
  "Maranhão": ["Maranhão", "Maranhao"],
  "Mato Grosso": ["Mato Grosso"],
  "Mato Grosso do Sul": ["Mato Grosso do Sul"],
  "Minas Gerais": ["Minas Gerais"],
  "Pará": ["Pará", "Para"],
  "Paraíba": ["Paraíba", "Paraiba"],
  "Paraná": ["Paraná", "Parana"],
  "Pernambuco": ["Pernambuco"],
  "Piauí": ["Piauí", "Piaui"],
  "Rio de Janeiro": ["Rio de Janeiro", "Rio de Janeiro (state)"],
  "Rio Grande do Norte": ["Rio Grande do Norte"],
  "Rio Grande do Sul": ["Rio Grande do Sul"],
  "Rondônia": ["Rondônia", "Rondonia"],
  "Roraima": ["Roraima"],
  "Santa Catarina": ["Santa Catarina"],
  "São Paulo": ["São Paulo", "Sao Paulo", "São Paulo (state)"],
  "Sergipe": ["Sergipe"],
  "Tocantins": ["Tocantins"],
};

function matchRegionToState(regionName: string): string | null {
  const normalized = regionName.replace(/\s*\(state\)/i, "").trim();
  for (const [stateName, aliases] of Object.entries(STATE_NAME_MAP)) {
    for (const alias of aliases) {
      if (
        alias.toLowerCase() === normalized.toLowerCase() ||
        alias.toLowerCase() === regionName.toLowerCase()
      ) {
        return stateName;
      }
    }
  }
  return null;
}

interface BrazilMapProps {
  data: RegionBreakdown[];
}

export function BrazilMap({ data }: BrazilMapProps) {
  const [tooltip, setTooltip] = useState<{ name: string; reach: number } | null>(null);

  const reachByState = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of data) {
      const state = matchRegionToState(item.region);
      if (state) {
        map.set(state, (map.get(state) ?? 0) + item.reach);
      }
    }
    return map;
  }, [data]);

  const maxReach = useMemo(
    () => Math.max(1, ...Array.from(reachByState.values())),
    [reachByState]
  );

  function getFillColor(stateName: string): string {
    const reach = reachByState.get(stateName) ?? 0;
    if (reach === 0) return "var(--color-muted)";
    const intensity = Math.min(reach / maxReach, 1);
    const alpha = 0.15 + intensity * 0.85;
    return `rgba(59, 130, 246, ${alpha})`;
  }

  return (
    <Card className="h-full relative">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Mapa de Alcance</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        <div className="h-[350px] relative">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [-54, -15], scale: 600 }}
            style={{ width: "100%", height: "100%" }}
          >
            <ZoomableGroup>
              <Geographies geography={BRAZIL_TOPO_URL}>
                {({ geographies }) =>
                  geographies.map((geo) => {
                    const stateName = geo.properties.name as string;
                    const reach = reachByState.get(stateName) ?? 0;
                    return (
                      <Geography
                        key={geo.rsmKey}
                        geography={geo}
                        fill={getFillColor(stateName)}
                        stroke="var(--color-border)"
                        strokeWidth={0.5}
                        style={{
                          hover: { fill: "#3b82f6", cursor: "pointer" },
                        }}
                        onMouseEnter={() =>
                          setTooltip({ name: stateName, reach })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      />
                    );
                  })
                }
              </Geographies>
            </ZoomableGroup>
          </ComposableMap>

          {tooltip && (
            <div className="absolute top-2 right-2 bg-popover border rounded-lg px-3 py-2 text-sm shadow-md pointer-events-none">
              <p className="font-medium">{tooltip.name}</p>
              <p className="text-muted-foreground">
                Alcance: {formatNumber(tooltip.reach)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

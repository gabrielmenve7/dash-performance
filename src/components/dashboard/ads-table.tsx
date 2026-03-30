"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import type { AdBreakdownMetrics } from "@/types";

interface AdsTableProps {
  data: AdBreakdownMetrics[];
  pageSize?: number;
}

export function AdsTable({ data, pageSize = 8 }: AdsTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const start = page * pageSize;
  const visible = data.slice(start, start + pageSize);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Anúncios</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Thumbnail</TableHead>
                <TableHead>Anúncio</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">Compras</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((ad, idx) => (
                <TableRow key={`${ad.adName}-${idx}`}>
                  <TableCell>
                    {ad.thumbnailUrl ? (
                      <Image
                        src={ad.thumbnailUrl}
                        alt={ad.adName}
                        width={48}
                        height={48}
                        className="rounded object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        —
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {ad.adName}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(ad.impressions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(ad.purchases)}
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    Nenhum anúncio no período
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {data.length > pageSize && (
          <div className="flex items-center justify-end gap-2 px-4 py-2 border-t">
            <span className="text-sm text-muted-foreground">
              {start + 1} – {Math.min(start + pageSize, data.length)} / {data.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useState } from "react";
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
import type { RegionBreakdown } from "@/types";

interface RegionTableProps {
  data: RegionBreakdown[];
  pageSize?: number;
}

export function RegionTable({ data, pageSize = 10 }: RegionTableProps) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const start = page * pageSize;
  const visible = data.slice(start, start + pageSize);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">Região</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Região</TableHead>
              <TableHead className="text-right">Alcance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((r) => (
              <TableRow key={r.region}>
                <TableCell>{r.region}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(r.reach)}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="h-24 text-center text-muted-foreground">
                  Nenhum dado de região no período
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

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

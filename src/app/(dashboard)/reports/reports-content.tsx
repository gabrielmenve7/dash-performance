"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { FileText, Download, Presentation } from "lucide-react";
import { subDays } from "date-fns";
import { toast } from "sonner";

interface ReportsContentProps {
  clients: { id: string; name: string }[];
  userRole: string;
}

export function ReportsContent({ clients }: ReportsContentProps) {
  const [selectedClient, setSelectedClient] = useState<string>(clients[0]?.id || "");
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  function handleExportPDF() {
    toast.info("Função de export PDF será habilitada com a integração completa das APIs.");
  }

  function handlePresentationMode() {
    if (selectedClient) {
      window.open(`/clients/${selectedClient}?presentation=true`, "_blank");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground">
            Gere relatórios e apresentações para seus clientes
          </p>
        </div>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(from, to) => setDateRange({ from, to })}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="w-5 h-5" />
              Relatório PDF
            </CardTitle>
            <CardDescription>
              Exporte um relatório completo em PDF para enviar ao cliente após a reunião.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleExportPDF} className="w-full gap-2">
              <Download className="w-4 h-4" />
              Exportar PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Presentation className="w-5 h-5" />
              Modo Apresentação
            </CardTitle>
            <CardDescription>
              Abra o dashboard em tela cheia, otimizado para apresentar em reuniões com clientes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handlePresentationMode} variant="outline" className="w-full gap-2">
              <Presentation className="w-4 h-4" />
              Iniciar Apresentação
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Download className="w-5 h-5" />
              Exportar Dados
            </CardTitle>
            <CardDescription>
              Exporte os dados das campanhas em formato CSV para análise externa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedClient} onValueChange={setSelectedClient}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => toast.info("Exportação CSV será habilitada com a integração completa das APIs.")}
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dicas para Reuniões</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground">1.</span>
              Use o Modo Apresentação para mostrar os dados em tela cheia durante a reunião.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground">2.</span>
              Registre as decisões tomadas na aba de Anotações do dashboard do cliente.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground">3.</span>
              Compare os períodos (mês atual vs anterior) para mostrar evolução.
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground">4.</span>
              Após a reunião, exporte o relatório PDF e envie ao cliente como referência.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

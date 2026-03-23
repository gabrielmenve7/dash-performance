"use client";

import { useState } from "react";
import { ClientsTable } from "@/components/dashboard/clients-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { ClientWithMetrics } from "@/types";

interface ClientsPageContentProps {
  clients: ClientWithMetrics[];
  allClients: { id: string; name: string; slug: string; industry: string | null; isActive: boolean }[];
}

export function ClientsPageContent({ clients, allClients }: ClientsPageContentProps) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const industry = formData.get("industry") as string;
    const website = formData.get("website") as string;

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, industry, website }),
      });

      if (!res.ok) throw new Error("Erro ao criar cliente");

      toast.success("Cliente criado com sucesso!");
      setDialogOpen(false);
      window.location.reload();
    } catch {
      toast.error("Erro ao criar cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            {allClients.length} clientes cadastrados
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Cliente</DialogTitle>
              <DialogDescription>
                Cadastre um novo cliente para gerenciar suas campanhas.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-name">Nome da Empresa</Label>
                <Input id="client-name" name="name" required placeholder="Ex: Loja XYZ" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-industry">Segmento</Label>
                <Input id="client-industry" name="industry" placeholder="Ex: E-commerce, SaaS" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-website">Website</Label>
                <Input id="client-website" name="website" placeholder="https://..." />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Criar Cliente"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar clientes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ClientsTable clients={filtered} />
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  RefreshCw,
  Trash2,
  Facebook,
  Unplug,
  Loader2,
  AlertCircle,
  CheckCircle2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface AdAccountItem {
  id: string;
  clientId: string;
  clientName: string;
  platform: string;
  accountId: string;
  accountName: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  hasToken: boolean;
  campaignCount: number;
  createdAt: string;
}

interface MetaAdAccount {
  id: string;
  name: string;
  status: string;
  currency?: string;
  timezone?: string;
  businessName?: string;
}

interface SettingsContentProps {
  users: { id: string; name: string; email: string; role: string; createdAt: Date }[];
  syncLogs: {
    id: string;
    status: string;
    message: string | null;
    startedAt: Date;
    completedAt: Date | null;
    recordsSync: number;
    adAccount: { accountName: string; platform: string };
  }[];
  clients: { id: string; name: string }[];
  hasMetaConfig: boolean;
}

export function SettingsContent({ users, syncLogs, clients, hasMetaConfig }: SettingsContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [adAccounts, setAdAccounts] = useState<AdAccountItem[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [metaToken, setMetaToken] = useState<string | null>(null);
  const [metaTokenExpiry, setMetaTokenExpiry] = useState<string | null>(null);
  const [metaAdAccounts, setMetaAdAccounts] = useState<MetaAdAccount[]>([]);
  const [loadingMetaAccounts, setLoadingMetaAccounts] = useState(false);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [connectingAccount, setConnectingAccount] = useState<string | null>(null);

  const [clientOptions, setClientOptions] = useState<{ id: string; name: string }[]>(clients);
  const [loadingClients, setLoadingClients] = useState(false);
  const [quickClientName, setQuickClientName] = useState("");
  const [quickClientSaving, setQuickClientSaving] = useState(false);
  const [showQuickClient, setShowQuickClient] = useState(false);

  const defaultTab = searchParams.get("tab") || "users";

  useEffect(() => {
    setClientOptions(clients);
  }, [clients]);

  const refreshClientsFromApi = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data: { id: string; name: string }[] = await res.json();
        setClientOptions(data.map((c) => ({ id: c.id, name: c.name })));
      }
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const fetchAdAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/ad-accounts");
      if (res.ok) {
        setAdAccounts(await res.json());
      }
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetchAdAccounts();
  }, [fetchAdAccounts]);

  useEffect(() => {
    if (connectDialogOpen) {
      void refreshClientsFromApi();
    }
  }, [connectDialogOpen, refreshClientsFromApi]);

  useEffect(() => {
    if (!connectDialogOpen || clientOptions.length === 0) return;
    if (clientOptions.length === 1) {
      setSelectedClient((prev) => prev || clientOptions[0].id);
    }
  }, [connectDialogOpen, clientOptions]);

  useEffect(() => {
    const token = searchParams.get("meta_token");
    const expiresAt = searchParams.get("expires_at");
    const error = searchParams.get("error");

    if (error) {
      toast.error(`Erro Meta OAuth: ${error}`);
    }

    if (token) {
      setMetaToken(token);
      setMetaTokenExpiry(expiresAt);
      setConnectDialogOpen(true);
      fetchMetaAdAccounts(token);
      window.history.replaceState({}, "", "/settings?tab=accounts");
    }
  }, [searchParams]);

  async function fetchMetaAdAccounts(token: string) {
    setLoadingMetaAccounts(true);
    try {
      const res = await fetch(`/api/meta/ad-accounts?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error();
      setMetaAdAccounts(await res.json());
    } catch {
      toast.error("Erro ao buscar contas de anúncio da Meta");
    } finally {
      setLoadingMetaAccounts(false);
    }
  }

  async function handleConnectMetaAccount(metaAccount: MetaAdAccount) {
    if (!selectedClient || !metaToken) {
      toast.error("Selecione um cliente");
      return;
    }

    setConnectingAccount(metaAccount.id);
    try {
      const res = await fetch("/api/ad-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: selectedClient,
          platform: "META",
          accountId: metaAccount.id,
          accountName: metaAccount.name,
          accessToken: metaToken,
          tokenExpiresAt: metaTokenExpiry,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success(`Conta "${metaAccount.name}" salva. Sincronizando com a Meta...`);
      await fetchAdAccounts();
      try {
        const syncRes = await fetch("/api/sync", { method: "POST" });
        const body = syncRes.ok ? await syncRes.json().catch(() => null) : null;
        const results = body?.results as { status: string; message?: string }[] | undefined;
        const errs = results?.filter((r) => r.status === "error") ?? [];
        if (!syncRes.ok) {
          toast.error(
            "Conta conectada, mas a sincronização falhou. Abra Configurações → Sincronização e clique em Sincronizar agora."
          );
        } else if (errs.length > 0) {
          toast.warning(
            `Sincronização com avisos: ${errs.map((e) => e.message || "erro").join("; ")}`
          );
        } else {
          toast.success("Dados da Meta importados. Atualize a página do cliente se ainda estiver aberta.");
        }
        await fetchAdAccounts();
      } catch {
        toast.error(
          "Conta conectada. Vá em Configurações → Sincronização e clique em Sincronizar agora para buscar campanhas."
        );
      }
    } catch {
      toast.error("Erro ao conectar conta");
    } finally {
      setConnectingAccount(null);
    }
  }

  async function handleQuickCreateClient(e: React.FormEvent) {
    e.preventDefault();
    const name = quickClientName.trim();
    if (!name) return;
    setQuickClientSaving(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error();
      const newClient: { id: string; name: string } = await res.json();
      setClientOptions((prev) =>
        [...prev, { id: newClient.id, name: newClient.name }].sort((a, b) =>
          a.name.localeCompare(b.name, "pt-BR")
        )
      );
      setSelectedClient(newClient.id);
      setQuickClientName("");
      setShowQuickClient(false);
      toast.success(
        `Cliente "${newClient.name}" criado e selecionado. Clique em Conectar na conta da Meta.`
      );
    } catch {
      toast.error("Não foi possível criar o cliente. Tente outro nome.");
    } finally {
      setQuickClientSaving(false);
    }
  }

  async function handleDeleteAccount(id: string) {
    if (!confirm("Tem certeza que deseja remover esta conta? Todas as campanhas e métricas serão excluídas.")) return;

    try {
      const res = await fetch(`/api/ad-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Conta removida");
      setAdAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Erro ao remover conta");
    }
  }

  async function handleCreateUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: formData.get("role"),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Usuário criado com sucesso!");
      setDialogOpen(false);
      window.location.reload();
    } catch {
      toast.error("Erro ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        results?: { status: string; message?: string }[];
      };

      if (!res.ok) {
        const msg =
          body.error ||
          (res.status === 401
            ? "Sessão expirada ou sem permissão. Faça login novamente."
            : `Erro ${res.status}`);
        toast.error(msg);
        return;
      }

      const errs = body.results?.filter((r) => r.status === "error") ?? [];
      if (errs.length > 0) {
        toast.warning(
          `Algumas contas falharam: ${errs.map((e) => e.message || "erro").join("; ")}`
        );
      } else {
        toast.success("Sincronização concluída.");
      }
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof TypeError
          ? "Tempo esgotado ou conexão interrompida. No plano Hobby da Vercel o limite é ~10s; tente reduzir ADS_SYNC_HISTORY_DAYS ou use um plano com funções mais longas."
          : e instanceof Error
            ? e.message
            : "Falha ao sincronizar"
      );
    } finally {
      setSyncing(false);
    }
  }

  const roleMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    ADMIN: { label: "Admin", variant: "default" },
    TEAM: { label: "Equipe", variant: "secondary" },
    CLIENT: { label: "Cliente", variant: "outline" },
  };

  function tokenStatus(account: AdAccountItem) {
    if (!account.hasToken) return { label: "Sem token", variant: "destructive" as const };
    if (!account.tokenExpiresAt) return { label: "Ativo", variant: "default" as const };
    const expires = new Date(account.tokenExpiresAt);
    const daysLeft = Math.ceil((expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 0) return { label: "Expirado", variant: "destructive" as const };
    if (daysLeft <= 7) return { label: `Expira em ${daysLeft}d`, variant: "secondary" as const };
    return { label: `Válido (${daysLeft}d)`, variant: "default" as const };
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-muted-foreground">Gerencie usuários, contas de anúncio e integrações</p>
      </div>

      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="accounts">Contas de Anúncio</TabsTrigger>
          <TabsTrigger value="sync">Sincronização</TabsTrigger>
          <TabsTrigger value="api">APIs</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Usuário</DialogTitle>
                  <DialogDescription>Crie um acesso para um membro da equipe ou cliente.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input name="name" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input name="email" type="email" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha</Label>
                    <Input name="password" type="password" required minLength={6} />
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select name="role" defaultValue="TEAM">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ADMIN">Admin</SelectItem>
                        <SelectItem value="TEAM">Equipe</SelectItem>
                        <SelectItem value="CLIENT">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Criando..." : "Criar Usuário"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => {
                    const role = roleMap[user.role] || roleMap.TEAM;
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant={role.variant}>{role.label}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ad Accounts Tab */}
        <TabsContent value="accounts" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Contas de Anúncio Conectadas</h2>
              <p className="text-sm text-muted-foreground">
                Conecte contas de anúncio da Meta ou Google aos seus clientes
              </p>
            </div>
            <div className="flex gap-2">
              {hasMetaConfig ? (
                <Button
                  className="gap-2"
                  onClick={() => window.location.href = "/api/meta/auth"}
                >
                  <Facebook className="w-4 h-4" />
                  Conectar Meta Ads
                </Button>
              ) : (
                <Button className="gap-2" disabled variant="outline">
                  <AlertCircle className="w-4 h-4" />
                  Meta não configurada
                </Button>
              )}
            </div>
          </div>

          {!hasMetaConfig && (
            <Card className="border-amber-500/50 bg-amber-500/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Meta Ads não configurada</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Para conectar contas da Meta, configure <code className="bg-muted px-1 rounded">META_APP_ID</code> e{" "}
                      <code className="bg-muted px-1 rounded">META_APP_SECRET</code> no arquivo{" "}
                      <code className="bg-muted px-1 rounded">.env.local</code>. Veja a aba &quot;APIs&quot; para mais detalhes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-0">
              {loadingAccounts ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conta</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>Token</TableHead>
                      <TableHead>Campanhas</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adAccounts.map((account) => {
                      const status = tokenStatus(account);
                      return (
                        <TableRow key={account.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{account.accountName}</p>
                              <p className="text-xs text-muted-foreground">ID: {account.accountId}</p>
                            </div>
                          </TableCell>
                          <TableCell>{account.clientName}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {account.platform === "META" ? "Meta Ads" : "Google Ads"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </TableCell>
                          <TableCell>{account.campaignCount}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAccount(account.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {adAccounts.length === 0 && !loadingAccounts && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Unplug className="w-8 h-8" />
                            <p>Nenhuma conta de anúncio conectada</p>
                            <p className="text-xs">Clique em &quot;Conectar Meta Ads&quot; para começar</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Dialog for selecting Meta ad accounts after OAuth */}
          <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Facebook className="w-5 h-5" />
                  Selecionar Contas de Anúncio da Meta
                </DialogTitle>
                <DialogDescription>
                  Escolha as contas de anúncio que deseja conectar e associe a um cliente.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Associar a um cliente do dashboard</Label>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Esta lista <strong>não</strong> vem da Meta: são apenas os clientes cadastrados aqui no sistema (menu{" "}
                    <Link href="/clients" className="underline font-medium text-primary">
                      Clientes
                    </Link>
                    ). Nomes como AutoParts ou Bella Cosméticos são <strong>dados de demonstração</strong> do banco. Para
                    associar &quot;Desentupidora Hortofrança&quot; (ou outro cliente real), cadastre esse nome como cliente
                    abaixo ou em Clientes — depois selecione no dropdown e clique em <strong>Conectar</strong> na linha da
                    conta Meta.
                  </p>
                  {loadingClients && clientOptions.length === 0 ? (
                    <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando clientes...
                    </div>
                  ) : clientOptions.length === 0 ? (
                    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <p className="font-medium text-amber-900 dark:text-amber-100">Nenhum cliente no sistema</p>
                      <p className="text-muted-foreground">
                        Cadastre o nome da empresa do cliente (igual ou parecido com o da conta Meta):
                      </p>
                      <form onSubmit={handleQuickCreateClient} className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          value={quickClientName}
                          onChange={(e) => setQuickClientName(e.target.value)}
                          placeholder="Ex: Desentupidora Hortofrança"
                          className="flex-1"
                        />
                        <Button type="submit" disabled={quickClientSaving || !quickClientName.trim()}>
                          {quickClientSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cadastrar e usar"}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Select value={selectedClient || undefined} onValueChange={setSelectedClient}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione um cliente..." />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[250]">
                          {clientOptions.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => setShowQuickClient((s) => !s)}
                        >
                          <UserPlus className="h-4 w-4" />
                          {showQuickClient ? "Fechar cadastro rápido" : "Cadastrar cliente real aqui"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => void refreshClientsFromApi()}
                          disabled={loadingClients}
                        >
                          {loadingClients ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar lista"}
                        </Button>
                      </div>
                      {showQuickClient && (
                        <form
                          onSubmit={handleQuickCreateClient}
                          className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-end"
                        >
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Nome do novo cliente</Label>
                            <Input
                              value={quickClientName}
                              onChange={(e) => setQuickClientName(e.target.value)}
                              placeholder="Ex: Desentupidora Hortofrança"
                            />
                          </div>
                          <Button type="submit" disabled={quickClientSaving || !quickClientName.trim()}>
                            {quickClientSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Adicionar"}
                          </Button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {loadingMetaAccounts ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Buscando contas...</span>
                  </div>
                ) : metaAdAccounts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma conta de anúncio encontrada nesta conta Facebook.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {metaAdAccounts.map((account) => {
                      const alreadyConnected = adAccounts.some(
                        (a) => a.platform === "META" && a.accountId === account.id
                      );
                      return (
                        <div
                          key={account.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div>
                            <p className="font-medium">{account.name}</p>
                            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                              <span>ID: {account.id}</span>
                              {account.currency && <span>{account.currency}</span>}
                              {account.businessName && <span>{account.businessName}</span>}
                            </div>
                          </div>
                          {alreadyConnected ? (
                            <Badge variant="outline" className="gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Conectada
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              disabled={
                                !selectedClient ||
                                clientOptions.length === 0 ||
                                connectingAccount === account.id
                              }
                              onClick={() => handleConnectMetaAccount(account)}
                            >
                              {connectingAccount === account.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                "Conectar"
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Sync Tab */}
        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sincronização de Dados</CardTitle>
                  <CardDescription>
                    Os dados são sincronizados automaticamente a cada 6 horas. Você também pode iniciar manualmente.
                  </CardDescription>
                </div>
                <Button onClick={handleSync} disabled={syncing} className="gap-2">
                  <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizando..." : "Sincronizar Agora"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Conta</TableHead>
                    <TableHead>Plataforma</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registros</TableHead>
                    <TableHead>Obs.</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {syncLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.adAccount.accountName}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {log.adAccount.platform === "META" ? "Meta" : "Google"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "success" ? "default" : log.status === "error" ? "destructive" : "secondary"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.recordsSync}</TableCell>
                      <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                        {log.message ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(log.startedAt).toLocaleString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {syncLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Nenhum log de sincronização
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Config Tab */}
        <TabsContent value="api" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meta Ads API</CardTitle>
                    <CardDescription>Credenciais da Meta Marketing API</CardDescription>
                  </div>
                  {hasMetaConfig ? (
                    <Badge variant="default" className="gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Configurada
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="w-3 h-3" /> Não configurada
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>App ID</Label>
                  <Input disabled value={hasMetaConfig ? "••••••••" : "Não configurado"} />
                </div>
                <div className="space-y-2">
                  <Label>App Secret</Label>
                  <Input type="password" disabled value={hasMetaConfig ? "••••••••" : "Não configurado"} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure <code className="bg-muted px-1 rounded">META_APP_ID</code> e{" "}
                  <code className="bg-muted px-1 rounded">META_APP_SECRET</code> no arquivo{" "}
                  <code className="bg-muted px-1 rounded">.env.local</code>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Google Ads API</CardTitle>
                <CardDescription>Credenciais da Google Ads API</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Client ID</Label>
                  <Input disabled value="Não configurado" />
                </div>
                <div className="space-y-2">
                  <Label>Client Secret</Label>
                  <Input type="password" disabled value="Não configurado" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_ID</code>,{" "}
                  <code className="bg-muted px-1 rounded">GOOGLE_CLIENT_SECRET</code> e{" "}
                  <code className="bg-muted px-1 rounded">GOOGLE_DEVELOPER_TOKEN</code> no arquivo{" "}
                  <code className="bg-muted px-1 rounded">.env.local</code>
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

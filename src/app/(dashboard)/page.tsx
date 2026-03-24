import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getActiveClientsForSelector,
  getActiveClientById,
  getOverviewMetricsForClient,
  getClientForUser,
  getDailyMetrics,
  getClientCampaigns,
} from "@/lib/data";
import { subDays } from "date-fns";
import { OverviewDashboard } from "./overview-dashboard";
import { ClientDashboardRedirect } from "./client-redirect";

interface Props {
  searchParams: Promise<{ client?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === "CLIENT") {
    const client = await getClientForUser(session.user.id);
    if (!client) {
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Nenhum cliente vinculado à sua conta.</p>
        </div>
      );
    }
    return <ClientDashboardRedirect clientId={client.id} />;
  }

  const sp = await searchParams;
  const clientList = await getActiveClientsForSelector();

  if (clientList.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Nenhum cliente ativo cadastrado.</p>
      </div>
    );
  }

  const requestedId = sp.client;
  if (!requestedId || !clientList.some((c) => c.id === requestedId)) {
    redirect(`/?client=${clientList[0].id}`);
  }

  const client = await getActiveClientById(requestedId);
  if (!client) {
    redirect(`/?client=${clientList[0].id}`);
  }

  const clientId = client.id;

  const to = new Date();
  const from = subDays(to, 30);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, 30);

  const [metrics, previousMetrics, dailyData, campaigns] = await Promise.all([
    getOverviewMetricsForClient(clientId, from, to),
    getOverviewMetricsForClient(clientId, prevFrom, prevTo),
    getDailyMetrics(clientId, from, to),
    getClientCampaigns(clientId, from, to, "ALL", prevFrom, prevTo),
  ]);

  return (
    <OverviewDashboard
      key={client.id}
      client={client}
      clientOptions={clientList}
      metrics={metrics}
      previousMetrics={previousMetrics}
      dailyData={dailyData}
      campaigns={campaigns}
    />
  );
}

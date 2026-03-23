import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClientsWithMetrics, getOverviewMetrics, getClientForUser, getDailyMetrics } from "@/lib/data";
import { subDays } from "date-fns";
import { OverviewDashboard } from "./overview-dashboard";
import { ClientDashboardRedirect } from "./client-redirect";

export default async function DashboardPage() {
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

  const to = new Date();
  const from = subDays(to, 30);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, 30);

  const [metrics, clients, dailyData] = await Promise.all([
    getOverviewMetrics(from, to),
    getClientsWithMetrics(from, to, prevFrom, prevTo),
    getDailyMetrics("", from, to),
  ]);

  const previousMetrics = await getOverviewMetrics(prevFrom, prevTo);

  return (
    <OverviewDashboard
      metrics={metrics}
      previousMetrics={previousMetrics}
      clients={clients}
      dailyData={dailyData}
    />
  );
}

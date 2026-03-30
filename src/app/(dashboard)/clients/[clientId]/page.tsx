import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import {
  aggregateCampaignListMetrics,
  getClientById,
  getClientCampaigns,
  getDailyMetrics,
} from "@/lib/domain";
import { prisma } from "@/lib/prisma";
import { subDays } from "date-fns";
import { ClientDetailDashboard } from "@/features/clients/client-detail-dashboard";

interface Props {
  params: Promise<{ clientId: string }>;
}

export default async function ClientDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { clientId } = await params;

  if (session.user.role === "CLIENT") {
    const access = await prisma.clientUser.findFirst({
      where: { userId: session.user.id, clientId },
    });
    if (!access) redirect("/");
  }

  const client = await getClientById(clientId);
  if (!client) notFound();

  const to = new Date();
  const from = subDays(to, 30);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, 30);

  const [campaigns, dailyData, notes] = await Promise.all([
    getClientCampaigns(clientId, from, to, "ALL", prevFrom, prevTo),
    getDailyMetrics(clientId, from, to),
    prisma.note.findMany({
      where: { clientId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalMetrics = aggregateCampaignListMetrics(campaigns);

  return (
    <ClientDetailDashboard
      key={clientId}
      client={client}
      campaigns={campaigns}
      metrics={totalMetrics}
      dailyData={dailyData}
      notes={notes.map((n) => ({
        id: n.id,
        content: n.content,
        userName: n.user.name,
        createdAt: n.createdAt.toISOString(),
      }))}
    />
  );
}

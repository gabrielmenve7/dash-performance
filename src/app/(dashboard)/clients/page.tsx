import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getClientsWithMetrics } from "@/lib/data";
import { subDays } from "date-fns";
import { ClientsPageContent } from "./clients-page-content";
import { prisma } from "@/lib/prisma";

export default async function ClientsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/");

  const to = new Date();
  const from = subDays(to, 30);
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, 30);

  const clients = await getClientsWithMetrics(from, to, prevFrom, prevTo);
  const allClients = await prisma.client.findMany({ orderBy: { name: "asc" } });

  return <ClientsPageContent clients={clients} allClients={allClients} />;
}

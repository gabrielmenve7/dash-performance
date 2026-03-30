import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ReportsContent } from "@/features/reports/reports-content";

export default async function ReportsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  let clients;
  if (session.user.role === "CLIENT") {
    const clientUser = await prisma.clientUser.findFirst({
      where: { userId: session.user.id },
      include: { client: true },
    });
    clients = clientUser ? [clientUser.client] : [];
  } else {
    clients = await prisma.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }

  return <ReportsContent clients={clients} userRole={session.user.role} />;
}

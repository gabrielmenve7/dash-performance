import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SettingsContent } from "@/features/settings/settings-content";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/");

  const [users, syncLogs, clients] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.syncLog.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { adAccount: { select: { accountName: true, platform: true } } },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const hasMetaConfig = !!(process.env.META_APP_ID && process.env.META_APP_SECRET);

  return (
    <SettingsContent
      users={users}
      syncLogs={syncLogs}
      clients={clients}
      hasMetaConfig={hasMetaConfig}
    />
  );
}

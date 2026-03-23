import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.adAccount.findMany({
    include: {
      client: { select: { id: true, name: true } },
      _count: { select: { campaigns: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const safe = accounts.map((a) => ({
    id: a.id,
    clientId: a.clientId,
    clientName: a.client.name,
    platform: a.platform,
    accountId: a.accountId,
    accountName: a.accountName,
    isActive: a.isActive,
    tokenExpiresAt: a.tokenExpiresAt,
    hasToken: !!a.accessToken,
    campaignCount: a._count.campaigns,
    createdAt: a.createdAt,
  }));

  return NextResponse.json(safe);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { clientId, platform, accountId, accountName, accessToken, tokenExpiresAt } = body;

  if (!clientId || !platform || !accountId || !accountName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const account = await prisma.adAccount.upsert({
    where: {
      platform_accountId: { platform, accountId },
    },
    update: {
      clientId,
      accountName,
      accessToken: accessToken || undefined,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : undefined,
      isActive: true,
    },
    create: {
      clientId,
      platform,
      accountId,
      accountName,
      accessToken,
      tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
      isActive: true,
    },
  });

  return NextResponse.json({ id: account.id, accountName: account.accountName });
}

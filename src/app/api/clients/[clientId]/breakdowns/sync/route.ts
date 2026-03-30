import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncBreakdownsForClient } from "@/features/sync/sync-engine";

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = await params;

  try {
    await syncBreakdownsForClient(clientId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Breakdown sync failed" },
      { status: 500 }
    );
  }
}

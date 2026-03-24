import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getActiveClientsForSelector } from "@/lib/data";
import { AssistantChat } from "./assistant-chat";

interface Props {
  searchParams: Promise<{ client?: string }>;
}

export default async function AssistantPage({ searchParams }: Props) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role === "CLIENT") redirect("/");

  const clients = await getActiveClientsForSelector();
  if (clients.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Nenhum cliente ativo cadastrado.</p>
      </div>
    );
  }

  const sp = await searchParams;
  const clientId = sp.client;
  if (!clientId || !clients.some((c) => c.id === clientId)) {
    redirect(`/assistant?client=${clients[0].id}`);
  }

  const hasApiKey = Boolean(process.env.OPENAI_API_KEY);

  return (
    <AssistantChat
      key={clientId}
      clientId={clientId}
      clientOptions={clients}
      hasApiKey={hasApiKey}
    />
  );
}

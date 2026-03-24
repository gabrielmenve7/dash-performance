import { NextResponse } from "next/server";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getActiveClientById } from "@/lib/data";
import { buildAssistantContextJson } from "@/lib/assistant-context";

export const maxDuration = 60;

const bodySchema = z.object({
  clientId: z.string().min(1),
  messages: z.array(z.unknown()).min(1),
  attachments: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(200),
        type: z.string().min(1).max(120),
        size: z.number().int().nonnegative().max(8 * 1024 * 1024),
        extractedText: z.string().max(8000).optional(),
      })
    )
    .max(8)
    .optional()
    .default([]),
});

const MAX_MESSAGES = 20;
const MAX_TOTAL_EXTRACTED_TEXT = 32000;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role === "CLIENT") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 503 }
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { clientId, attachments } = parsed.data;
  const client = await getActiveClientById(clientId);
  if (!client) {
    return NextResponse.json({ error: "Invalid client" }, { status: 400 });
  }

  const extractedTextTotal = attachments.reduce((acc, a) => acc + (a.extractedText?.length ?? 0), 0);
  if (extractedTextTotal > MAX_TOTAL_EXTRACTED_TEXT) {
    return NextResponse.json(
      { error: "Attachments extracted text exceeds maximum allowed size" },
      { status: 400 }
    );
  }

  const uiMessages = parsed.data.messages.slice(-MAX_MESSAGES) as UIMessage[];
  const forModel = uiMessages.map((m) => {
    const { id, ...rest } = m;
    void id;
    return rest;
  });

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(forModel);
  } catch (err) {
    console.error("[assistant/chat] convertToModelMessages", err);
    return NextResponse.json({ error: "Invalid message format" }, { status: 400 });
  }

  let context: string;
  try {
    context = await buildAssistantContextJson(clientId);
  } catch (err) {
    console.error("[assistant/chat] buildAssistantContextJson", err);
    return NextResponse.json({ error: "Failed to load client context" }, { status: 500 });
  }

  const abortSignal =
    typeof AbortSignal !== "undefined" && "any" in AbortSignal
      ? AbortSignal.any([req.signal, AbortSignal.timeout(110_000)])
      : req.signal;

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: [
      "Você é um assistente de performance de mídia paga. Responda em português quando o usuário escrever em português.",
      "O campo summaries.last7d/last14d/last30d já contém totais prontos por janela.",
      "Se a pergunta for sobre período (ex: últimos 7 dias), use primeiro summaries; só recalcule no daily se necessário.",
      "Se a pergunta for sobre conversas, use conversationsStarted (não confundir com compras).",
      "NUNCA diga que não há dados se summaries.rows > 0 ou spend > 0 na janela pedida.",
      "Não assuma que todas campanhas estão pausadas; use summaries.campaigns.statusBreakdownWithSpend para afirmar status.",
      "Use apenas os fatos do JSON abaixo sobre métricas e campanhas deste cliente; se algo não estiver nos dados, diga que não há dado suficiente.",
      "Não invente números. Custos de uso da API OpenAI são por conta de quem opera o painel.",
      "",
      "Contexto (JSON):",
      context,
      "",
      "Anexos recebidos nesta mensagem (JSON):",
      JSON.stringify(
        attachments.map((a) => ({
          name: a.name,
          type: a.type,
          size: a.size,
          extractedText: a.extractedText ?? null,
        }))
      ),
    ].join("\n"),
    messages: modelMessages,
    maxOutputTokens: 2048,
    abortSignal,
  });

  return result.toUIMessageStreamResponse();
}

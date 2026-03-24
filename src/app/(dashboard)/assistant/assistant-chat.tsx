"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Send, Square } from "lucide-react";
import { toast } from "sonner";

interface AssistantChatProps {
  clientId: string;
  clientOptions: { id: string; name: string }[];
  hasApiKey: boolean;
}

function textFromParts(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

export function AssistantChat({ clientId, clientOptions, hasApiKey }: AssistantChatProps) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant/chat",
        credentials: "include",
        body: { clientId },
      }),
    [clientId]
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat({
    id: `assistant-${clientId}`,
    transport,
    onError: (e) => {
      toast.error(e.message || "Não foi possível obter resposta do assistente");
    },
  });

  const [input, setInput] = useState("");

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  function onClientChange(nextId: string) {
    router.push(`/assistant?client=${nextId}`);
    router.refresh();
  }

  const busy = status === "streaming" || status === "submitted";

  const last = messages[messages.length - 1];
  const lastAssistantText =
    last?.role === "assistant" ? textFromParts(last.parts as { type: string; text?: string }[]) : "";
  const showThinking =
    busy &&
    (messages.length === 0 ||
      last?.role === "user" ||
      (last?.role === "assistant" && !lastAssistantText));

  async function submitMessage() {
    const text = input.trim();
    if (!text || !hasApiKey || busy) return;
    setInput("");
    await sendMessage({ text });
  }

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitMessage();
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-7rem)] max-w-4xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Assistente</h1>
          <p className="text-sm text-muted-foreground">
            Perguntas sobre performance e campanhas do cliente selecionado (contexto: últimos 30 dias).
          </p>
        </div>
        <Select value={clientId} onValueChange={onClientChange}>
          <SelectTrigger className="w-full sm:w-[280px]">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            {clientOptions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasApiKey && (
        <Card className="border-amber-500/40 bg-amber-500/5 shrink-0">
          <CardContent className="py-3 text-sm text-muted-foreground">
            Configure a variável <code className="text-foreground">OPENAI_API_KEY</code> no ambiente
            (local: <code className="text-foreground">.env.local</code>; produção: painel da Vercel →
            Environment Variables) para habilitar respostas da IA.
          </CardContent>
        </Card>
      )}

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !busy && (
              <p className="text-sm text-muted-foreground text-center py-12">
                Envie uma pergunta sobre investimento, ROAS, campanhas ou comparativos do período.
              </p>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive flex flex-col gap-2">
                <span>{error.message}</span>
                <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => clearError()}>
                  Dispensar
                </Button>
              </div>
            )}
            {messages.map((m) => {
              const text = textFromParts(m.parts as { type: string; text?: string }[]);
              if (!text) return null;
              return (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "rounded-lg px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
            {showThinking && (
              <div className="flex justify-start">
                <div className="rounded-lg px-4 py-3 max-w-[90%] bg-muted text-sm text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground animate-pulse">Gerando resposta…</p>
                  <p>
                    Montando contexto no servidor e chamando a OpenAI — pode levar de alguns segundos a mais de um
                    minuto se a rede ou a API estiverem lentas.
                  </p>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onFormSubmit}
            className="border-t p-4 flex gap-2 shrink-0 bg-background"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder={
                hasApiKey ? "Sua pergunta… (Enter envia, Shift+Enter quebra linha)" : "IA desativada até configurar a chave"
              }
              disabled={!hasApiKey || busy}
              rows={2}
              className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {busy ? (
              <Button type="button" variant="secondary" size="icon" className="shrink-0 h-auto" onClick={() => void stop()}>
                <Square className="w-4 h-4" />
              </Button>
            ) : (
              <Button type="submit" size="icon" className="shrink-0 h-auto" disabled={!hasApiKey || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

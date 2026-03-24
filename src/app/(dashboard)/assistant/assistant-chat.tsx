"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileUp, Paperclip, Send, Square, X } from "lucide-react";
import { toast } from "sonner";

interface AssistantChatProps {
  clientId: string;
  hasApiKey: boolean;
}

interface AttachmentDraft {
  id: string;
  name: string;
  type: string;
  size: number;
  extractedText?: string;
}

function textFromParts(parts: { type: string; text?: string }[]): string {
  return parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("");
}

const MAX_ATTACHMENTS = 8;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_TOTAL_EXTRACTED_TEXT = 32000;
const MAX_EXTRACT_PER_FILE = 8000;
const TYPE_SPEED_MS = 45;
const DELETE_SPEED_MS = 24;
const HOLD_FULL_MS = 1300;
const HOLD_EMPTY_MS = 320;

const EXAMPLE_PROMPTS = [
  "Qual campanha teve melhor custo por conversa nos últimos 7 dias?",
  "Onde estamos perdendo orçamento sem gerar conversas?",
  "Quais anúncios devo pausar hoje para melhorar performance?",
  "Compare os últimos 7 dias vs. 7 dias anteriores.",
  "Quais são os principais pontos fracos das campanhas ativas?",
];

const ALLOWED_EXTENSIONS = [
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
];

function isAllowedFile(file: File) {
  const lower = file.name.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function extractTextIfSupported(file: File): Promise<string | undefined> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md") || lower.endsWith(".json") || lower.endsWith(".csv")) {
    const text = await file.text();
    return text.slice(0, MAX_EXTRACT_PER_FILE);
  }
  // For binaries/docs in v1 we send metadata only.
  return undefined;
}

export function AssistantChat({ clientId, hasApiKey }: AssistantChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [animatedPrompt, setAnimatedPrompt] = useState("");
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeletingPrompt, setIsDeletingPrompt] = useState(false);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant/chat",
        credentials: "include",
        body: { clientId, attachments },
      }),
    [clientId, attachments]
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

  const busy = status === "streaming" || status === "submitted";
  const shouldAnimatePrompt = hasApiKey && !busy && input.trim().length === 0;

  const last = messages[messages.length - 1];
  const lastAssistantText =
    last?.role === "assistant" ? textFromParts(last.parts as { type: string; text?: string }[]) : "";
  const showThinking =
    busy &&
    (messages.length === 0 ||
      last?.role === "user" ||
      (last?.role === "assistant" && !lastAssistantText));

  useEffect(() => {
    if (!shouldAnimatePrompt) {
      return;
    }

    const fullText = EXAMPLE_PROMPTS[promptIndex];
    const atFullText = animatedPrompt === fullText;
    const atEmpty = animatedPrompt.length === 0;

    const delay = isDeletingPrompt
      ? DELETE_SPEED_MS
      : atFullText
        ? HOLD_FULL_MS
        : atEmpty
          ? HOLD_EMPTY_MS
          : TYPE_SPEED_MS;

    const timer = window.setTimeout(() => {
      if (!isDeletingPrompt && !atFullText) {
        setAnimatedPrompt(fullText.slice(0, animatedPrompt.length + 1));
        return;
      }

      if (!isDeletingPrompt && atFullText) {
        setIsDeletingPrompt(true);
        return;
      }

      if (isDeletingPrompt && !atEmpty) {
        setAnimatedPrompt(fullText.slice(0, animatedPrompt.length - 1));
        return;
      }

      setIsDeletingPrompt(false);
      setPromptIndex((prev) => (prev + 1) % EXAMPLE_PROMPTS.length);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [animatedPrompt, isDeletingPrompt, promptIndex, shouldAnimatePrompt]);

  useEffect(() => {
    if (input.trim().length > 0) {
      setAnimatedPrompt("");
      setIsDeletingPrompt(false);
    }
  }, [input]);

  async function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      toast.error(`Limite de ${MAX_ATTACHMENTS} anexos por mensagem.`);
      return;
    }

    const next: AttachmentDraft[] = [];
    for (const file of files) {
      if (!isAllowedFile(file)) {
        toast.error(`Tipo de arquivo não suportado: ${file.name}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Arquivo muito grande: ${file.name} (máx ${formatBytes(MAX_FILE_SIZE)})`);
        continue;
      }
      const extractedText = await extractTextIfSupported(file);
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
        extractedText,
      });
    }
    setAttachments((prev) => [...prev, ...next]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  function clearAttachments() {
    setAttachments([]);
  }

  async function submitMessage() {
    const text = input.trim();
    if (!text || !hasApiKey || busy) return;

    const totalText = attachments.reduce((acc, a) => acc + (a.extractedText?.length ?? 0), 0);
    if (totalText > MAX_TOTAL_EXTRACTED_TEXT) {
      toast.error("Texto extraído dos anexos excede o limite para uma única mensagem.");
      return;
    }

    setInput("");
    await sendMessage({ text });
    setAttachments([]);
  }

  function onFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    void submitMessage();
  }

  return (
    <div className="relative min-h-[calc(100vh-7rem)] max-w-5xl mx-auto">
      {!hasApiKey && (
        <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
            Configure a variável <code className="text-foreground">OPENAI_API_KEY</code> no ambiente
            (local: <code className="text-foreground">.env.local</code>; produção: painel da Vercel →
            Environment Variables) para habilitar respostas da IA.
        </div>
      )}

      <div className="absolute inset-0 flex flex-col">
        <div className={cn("flex-1 overflow-y-auto px-4", messages.length === 0 ? "hidden" : "pt-6 pb-48 space-y-4")}>
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
                    "rounded-2xl px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap shadow-sm",
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
              <div className="rounded-2xl px-4 py-3 max-w-[90%] bg-muted text-sm text-muted-foreground space-y-1">
                <p className="font-medium text-foreground animate-pulse">Gerando resposta…</p>
                <p>Analisando contexto e preparando resposta.</p>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-3xl space-y-6">
              <h1 className="text-3xl sm:text-4xl tracking-tight text-foreground/95 text-center">
                O que quer fazer hoje?
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {EXAMPLE_PROMPTS.slice(0, 4).map((example) => (
                  <button
                    key={example}
                    type="button"
                    className="rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground hover:border-border"
                    onClick={() => {
                      setInput(example);
                      composerInputRef.current?.focus();
                    }}
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-10 px-4">
          <form
            onSubmit={onFormSubmit}
            className="mx-auto max-w-3xl rounded-2xl border border-border/70 bg-background/85 backdrop-blur-md shadow-xl"
          >
            {attachments.length > 0 && (
              <div className="px-3 pt-2.5 pb-2 flex flex-wrap items-center gap-2 border-b border-border/60">
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
                  >
                    <FileUp className="w-3 h-3" />
                    <span className="max-w-[180px] truncate">{a.name}</span>
                    <span className="text-muted-foreground">{formatBytes(a.size)}</span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => removeAttachment(a.id)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                  onClick={clearAttachments}
                >
                  limpar
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 p-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={onFilesSelected}
                accept={ALLOWED_EXTENSIONS.join(",")}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <Paperclip className="w-3.5 h-3.5" />
              </Button>

              <textarea
                ref={composerInputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submitMessage();
                  }
                }}
                placeholder={
                  hasApiKey
                    ? (shouldAnimatePrompt
                        ? `${animatedPrompt}${isDeletingPrompt ? "" : "\u258c"}`
                        : "Pergunte qualquer coisa")
                    : "IA desativada até configurar a chave"
                }
                disabled={!hasApiKey || busy}
                rows={1}
                className="flex-1 resize-none bg-transparent px-1 py-1.5 text-sm leading-5 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />

              {busy ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full h-8 w-8"
                  onClick={() => void stop()}
                >
                  <Square className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-full h-8 w-8"
                  disabled={!hasApiKey || !input.trim()}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

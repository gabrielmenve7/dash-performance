"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileUp, Mic, Paperclip, Send, Square, X } from "lucide-react";
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

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
  }
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
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
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

  useEffect(() => {
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    setVoiceSupported(Boolean(SpeechRecognitionClass));
  }, []);

  const busy = status === "streaming" || status === "submitted";

  const last = messages[messages.length - 1];
  const lastAssistantText =
    last?.role === "assistant" ? textFromParts(last.parts as { type: string; text?: string }[]) : "";
  const showThinking =
    busy &&
    (messages.length === 0 ||
      last?.role === "user" ||
      (last?.role === "assistant" && !lastAssistantText));

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

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      toast.error("Reconhecimento de voz não suportado neste navegador.");
      return;
    }
    const recognition = new SpeechRecognitionClass();
    recognition.lang = "pt-BR";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    };
    recognition.onerror = () => {
      toast.error("Não foi possível capturar o áudio.");
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
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
            <h1 className="text-3xl sm:text-4xl tracking-tight text-foreground/95 text-center">
              O que quer fazer hoje?
            </h1>
          </div>
        )}

        <div className="absolute inset-x-0 bottom-6 px-4">
          <form
            onSubmit={onFormSubmit}
            className="mx-auto max-w-3xl rounded-3xl border border-border/70 bg-background/85 backdrop-blur-md shadow-xl"
          >
            {attachments.length > 0 && (
              <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-2 border-b border-border/60">
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

            <div className="flex items-end gap-2 p-3">
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
                className="rounded-full"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
              >
                <Paperclip className="w-4 h-4" />
              </Button>

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
                  hasApiKey
                    ? "Pergunte qualquer coisa"
                    : "IA desativada até configurar a chave"
                }
                disabled={!hasApiKey || busy}
                rows={2}
                className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />

              <Button
                type="button"
                variant={listening ? "default" : "ghost"}
                size="icon"
                className="rounded-full"
                onClick={toggleVoice}
                disabled={!voiceSupported || busy}
                title={voiceSupported ? "Gravar voz" : "Voz não suportada"}
              >
                <Mic className="w-4 h-4" />
              </Button>

              {busy ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => void stop()}
                >
                  <Square className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="rounded-full"
                  disabled={!hasApiKey || !input.trim()}
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

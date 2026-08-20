"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CollapseToggle,
  useCollapsed,
} from "@/components/dashboard/collapsible-panel";
import {
  clearCoachMessages,
  loadCoachMessages,
  removeCoachExchange,
  saveCoachMessages,
  type CoachMessage,
} from "@/lib/assistant/coach-storage";
import { cn } from "@/lib/utils";

const SUGGESTED_PROMPTS = [
  {
    label: "Återhämtning",
    message: "Hur ser min återhämtning ut idag?",
  },
  {
    label: "Senaste passet",
    message: "Hur såg mitt senaste pass ut?",
  },
  {
    label: "Träna idag",
    message: "Vad bör jag träna idag?",
  },
];

export function CoachChat({
  initialSummary,
  variant = "page",
}: {
  initialSummary: string;
  variant?: "page" | "panel";
}) {
  const [hydrated, setHydrated] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([
    { id: "welcome", role: "assistant", text: initialSummary },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [collapsed, toggleCollapsed] = useCollapsed("fk:collapse:coach");
  const collapsible = variant === "panel";

  useEffect(() => {
    setMessages(loadCoachMessages(initialSummary));
    setHydrated(true);
  }, [initialSummary]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveCoachMessages(messages);
  }, [hydrated, messages]);

  const canSend = useMemo(
    () => draft.trim().length > 0 && !pending,
    [draft, pending],
  );

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollerRef.current?.scrollTo({
        top: scrollerRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  function resetConversation() {
    clearCoachMessages();
    const welcome = { id: "welcome", role: "assistant" as const, text: initialSummary };
    setMessages([welcome]);
    setError(null);
    setDraft("");
  }

  function deleteExchange(userMessageId: string) {
    setMessages((current) => removeCoachExchange(current, userMessageId));
  }

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) {
      return;
    }

    const userMessage: CoachMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setPending(true);
    setError(null);
    setDraft("");
    setMessages((current) => [...current, userMessage]);
    scrollToBottom();

    try {
      const response = await fetch("/api/coach/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });
      const payload = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      if (!response.ok || !payload.reply) {
        setError(payload.error ?? "Coachen kunde inte svara just nu.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: payload.reply!,
        },
      ]);
    } catch {
      setError("Nätverksfel. Försök igen om en liten stund.");
    } finally {
      setPending(false);
      scrollToBottom();
    }
  }

  return (
    <section
      className={cn(
        "surface flex flex-col overflow-hidden",
        collapsed && collapsible
          ? ""
          : variant === "panel"
            ? "h-[28rem]"
            : "h-[min(36rem,calc(100dvh-var(--app-tabbar)-6.5rem))]",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3",
          !(collapsed && collapsible) && "border-b border-white/40",
        )}
      >
        <h2 className="panel-title">Coach</h2>
        <div className="flex items-center gap-1">
          {collapsed && collapsible ? null : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 min-h-9 rounded-full px-3 text-[0.78rem] text-muted-foreground shadow-none hover:text-foreground md:h-7 md:min-h-7 md:px-2.5 md:text-[0.75rem]"
              onClick={resetConversation}
              disabled={pending}
            >
              <Trash2 className="size-3.5" />
              Rensa
            </Button>
          )}
          {collapsible ? (
            <CollapseToggle
              collapsed={collapsed}
              onToggle={toggleCollapsed}
              label="Coach"
            />
          ) : null}
        </div>
      </div>

      {collapsed && collapsible ? null : (
        <>
      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain px-4 py-3 [-webkit-overflow-scrolling:touch]"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-2",
              message.role === "user" ? "flex-row-reverse" : "flex-row",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                message.role === "user"
                  ? "bg-primary/12 text-primary"
                  : "bg-white/75 text-foreground",
              )}
            >
              {message.role === "user" ? (
                <UserRound className="size-3.5" />
              ) : (
                <Bot className="size-3.5" />
              )}
            </span>
            <div
              className={cn(
                "group relative min-w-0 max-w-[78%]",
                message.role === "user" ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "px-3.5 py-2.5 text-[0.88rem] leading-6",
                  message.role === "user"
                    ? "rounded-[1.1rem] rounded-br-md bg-primary text-primary-foreground"
                    : "rounded-[1.1rem] rounded-bl-md bg-white/70",
                )}
              >
                {message.text}
              </div>
              {message.role === "user" ? (
                <button
                  type="button"
                  aria-label="Ta bort fråga"
                  className="absolute -top-2 -left-2 flex size-8 items-center justify-center rounded-full border border-white/60 bg-white/90 text-muted-foreground shadow-sm transition-opacity hover:text-foreground md:size-5 md:opacity-0 md:group-hover:opacity-100"
                  onClick={() => deleteExchange(message.id)}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="flex gap-2">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-white/75 text-foreground">
              <Bot className="size-3.5" />
            </span>
            <div className="max-w-[78%] rounded-[1.1rem] rounded-bl-md bg-white/70 px-3.5 py-2.5 text-[0.88rem] text-muted-foreground">
              Coachen tänker…
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-2 border-t border-white/40 px-3 py-3">
        {error ? <p className="px-1 text-[0.8rem] text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <Button
              key={prompt.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-9 min-h-9 rounded-full border-white/55 bg-white/55 px-3 text-[0.78rem] shadow-none active:translate-y-0 md:h-7 md:min-h-7 md:px-2.5 md:text-[0.72rem]"
              onClick={() => {
                void sendMessage(prompt.message);
              }}
              disabled={pending}
            >
              {prompt.label}
            </Button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Skriv till coachen…"
            aria-label="Fråga coachen"
            disabled={pending}
            className="h-11 rounded-full border-white/55 bg-white/70 text-base md:text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!canSend}
            aria-label="Skicka"
            className="size-11 shrink-0 rounded-full shadow-none active:translate-y-0"
          >
            <ArrowUp className="size-4" />
          </Button>
        </form>
      </div>
        </>
      )}
    </section>
  );
}

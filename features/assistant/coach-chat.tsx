"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const SUGGESTED_PROMPTS = [
  "Hur ser min återhämtning ut idag?",
  "Hur såg mitt senaste pass ut?",
  "Vad bör jag träna idag?",
];

export function CoachChat({
  initialSummary,
}: {
  initialSummary: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      text: `Fråga din coach om återhämtning, senaste passet eller dagens träning. ${initialSummary}`,
    },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const canSend = useMemo(() => draft.trim().length > 0 && !pending, [draft, pending]);

  async function sendMessage(message: string) {
    const trimmed = message.trim();
    if (!trimmed || pending) {
      return;
    }

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    setPending(true);
    setError(null);
    setDraft("");
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/coach/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: trimmed }),
      });
      const payload = (await response.json()) as { reply?: string; error?: string };

      if (!response.ok || !payload.reply) {
        setError(payload.error ?? "Coachen kunde inte svara just nu.");
        return;
      }
      const reply = payload.reply;

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: reply,
        },
      ]);
    } catch {
      setError("Nätverksfel. Försök igen om en liten stund.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            type="button"
            variant="outline"
            className="h-auto whitespace-normal rounded-full px-4 py-2 text-left"
            onClick={() => {
              void sendMessage(prompt);
            }}
            disabled={pending}
          >
            {prompt}
          </Button>
        ))}
      </div>

      <Card className="min-h-[28rem]">
        <CardHeader>
          <CardTitle>Coach</CardTitle>
          <CardDescription>
            Ett första in-app coachläge baserat på din Garmin-data i Formkurvan.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-full flex-col gap-4">
          <div className="flex max-h-[28rem] flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[85%] rounded-2xl bg-primary px-4 py-3 text-sm text-primary-foreground"
                    : "max-w-[90%] rounded-2xl bg-muted px-4 py-3 text-sm"
                }
              >
                {message.text}
              </div>
            ))}
            {pending ? (
              <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                Coachen tänker...
              </div>
            ) : null}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <form
            className="flex flex-col gap-3 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage(draft);
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ställ en fråga om din träning"
              aria-label="Fråga coachen"
              disabled={pending}
            />
            <Button type="submit" disabled={!canSend} className="sm:self-end">
              Skicka
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

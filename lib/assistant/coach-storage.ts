export type CoachMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const STORAGE_KEY = "fk:coach-chat";

function welcomeMessage(text: string): CoachMessage {
  return { id: "welcome", role: "assistant", text };
}

export function loadCoachMessages(fallbackWelcome: string): CoachMessage[] {
  if (typeof window === "undefined") {
    return [welcomeMessage(fallbackWelcome)];
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [welcomeMessage(fallbackWelcome)];
    }

    const parsed = JSON.parse(raw) as { messages?: CoachMessage[] };
    if (!Array.isArray(parsed.messages) || parsed.messages.length === 0) {
      return [welcomeMessage(fallbackWelcome)];
    }

    return parsed.messages.filter(
      (message) =>
        message &&
        typeof message.id === "string" &&
        (message.role === "assistant" || message.role === "user") &&
        typeof message.text === "string",
    );
  } catch {
    return [welcomeMessage(fallbackWelcome)];
  }
}

export function saveCoachMessages(messages: CoachMessage[]) {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages }));
}

export function clearCoachMessages() {
  if (typeof window === "undefined") {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

export function removeCoachExchange(
  messages: CoachMessage[],
  userMessageId: string,
): CoachMessage[] {
  const index = messages.findIndex((message) => message.id === userMessageId);
  if (index === -1 || messages[index]?.role !== "user") {
    return messages;
  }

  const next = [...messages];
  next.splice(index, 1);
  if (next[index]?.role === "assistant") {
    next.splice(index, 1);
  }
  return next.length > 0 ? next : messages;
}

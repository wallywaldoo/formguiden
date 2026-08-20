import { describe, expect, it } from "vitest";

import {
  removeCoachExchange,
  type CoachMessage,
} from "@/lib/assistant/coach-storage";

describe("coach storage", () => {
  it("removes a user message and its following assistant reply", () => {
    const messages: CoachMessage[] = [
      { id: "welcome", role: "assistant", text: "Hej" },
      { id: "user-1", role: "user", text: "Fråga" },
      { id: "assistant-1", role: "assistant", text: "Svar" },
    ];

    const next = removeCoachExchange(messages, "user-1");
    expect(next).toEqual([{ id: "welcome", role: "assistant", text: "Hej" }]);
  });
});

import { NextResponse } from "next/server";

import { withAssistantAuth, withCors } from "@/lib/api/assistant-auth";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://chatgpt.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function GET(request: Request) {
  return withAssistantAuth(request, async () => {
    const { searchParams } = new URL(request.url);
    const days = Math.min(parseInt(searchParams.get("days") ?? "7", 10), 30);

    // TODO: replace with DB query
    const today = new Date("2026-08-19");
    const mockDays = Array.from({ length: days }, (_, i) => {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      return {
        date: date.toISOString().split("T")[0],
        restingHeartRateBpm: 50 + Math.round(Math.random() * 8),
        hrvRmssdMs: 60 + Math.round(Math.random() * 20),
        sleepDurationS: 23400 + Math.round(Math.random() * 7200),
        sleepScore: 78 + Math.round(Math.random() * 15),
        stressAvg: 28 + Math.round(Math.random() * 15),
        bodyBatteryHigh: 85 + Math.round(Math.random() * 12),
        steps: 7000 + Math.round(Math.random() * 5000),
      };
    });

    return withCors(NextResponse.json({ days: mockDays }));
  });
}

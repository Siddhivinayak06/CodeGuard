import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const executeUrl = process.env.EXECUTE_URL;
    let baseUrl = "http://localhost:5002";
    if (executeUrl) {
      baseUrl = executeUrl.replace(/\/execute\/?$/, "");
    }

    const response = await fetch(`${baseUrl}/ai/generate-fuzz-testcases`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {}),
      },
      body: req.body,
      // @ts-expect-error - Required for streaming bodies in Node 18+ fetch
      duplex: "half",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          error:
            payload?.error ||
            `AI backend error ${response.status}: ${response.statusText}`,
          details: payload?.details,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(payload || {});
  } catch (error: unknown) {
    console.error("AI Fuzzer Proxy Error:", error);
    return NextResponse.json(
      {
        error: "Failed to connect to AI background service",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

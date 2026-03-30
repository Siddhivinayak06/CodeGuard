import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    // Fall back to same protocol and host if EXECUTE_URL not provided, 
    // or use EXECUTE_URL to determine backend origin.
    const executeUrl = process.env.EXECUTE_URL;
    let baseUrl = "http://localhost:5002";
    if (executeUrl) {
      baseUrl = executeUrl.replace(/\/execute\/?$/, "");
    }

    const contentType = req.headers.get("Content-Type");

    const response = await fetch(`${baseUrl}/ai/chat`, {
      method: "POST",
      headers: {
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body: req.body,
      // @ts-expect-error - Required for streaming bodies in Node 18+ fetch
      duplex: "half",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `AI backend error: ${response.statusText}`, details: await response.text() },
        { status: response.status }
      );
    }

    // Stream the AI response back to the client
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });
  } catch (error: unknown) {
    console.error("AI Chat Proxy Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to AI background service", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

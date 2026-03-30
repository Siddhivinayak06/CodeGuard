import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 120; // 2 minutes, as PDF extraction can be lengthy
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    const executeUrl = process.env.EXECUTE_URL;
    let baseUrl = "http://localhost:5002";
    if (executeUrl) {
      baseUrl = executeUrl.replace(/\/execute\/?$/, "");
    }

    const contentType = req.headers.get("Content-Type");

    const response = await fetch(`${baseUrl}/ai/generate-bulk-practicals-from-pdf`, {
      method: "POST",
      headers: {
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body: req.body,
      // @ts-ignore - Required for streaming bodies in Node 18+ fetch
      duplex: "half",
    });

    if (!response.ok) {
      let errorMsg = `AI backend error ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        return NextResponse.json({ error: errorData.error || errorMsg }, { status: response.status });
      } catch (e) {
        return NextResponse.json({ error: errorMsg }, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("AI Generate Bulk Proxy Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to AI background service", details: error.message },
      { status: 500 }
    );
  }
}

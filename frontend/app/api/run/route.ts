// /app/api/run/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service"; // server-side supabase service key

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, lang, practicalId, submissionId, userTestCases = [], mode = "run" } = body;

    if (!code || !lang || !practicalId || !submissionId) {
      return NextResponse.json({ error: "Missing code, lang, practicalId, or submissionId" }, { status: 400 });
    }

    const pid = Number(practicalId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json({ error: "Invalid practicalId" }, { status: 400 });
    }

    // 1) fetch test cases
    const { data: tcs, error: tcErr } = await supabaseAdmin
      .from("test_cases")
      .select("*")
      .eq("practical_id", pid)
      .order("id", { ascending: true });

    if (tcErr) {
      console.error("Failed to fetch test cases:", tcErr);
      return NextResponse.json({ error: "Failed to load test cases" }, { status: 500 });
    }

    // 2) fetch reference code from DB
    const { data: refs, error: refErr } = await supabaseAdmin
      .from("reference_codes")
      .select("id, language, code, is_primary, created_at")
      .eq("practical_id", pid)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    if (refErr) {
      console.error("Failed to fetch reference code:", refErr);
      return NextResponse.json({ error: "Failed to load reference code" }, { status: 500 });
    }

    if (!refs || refs.length === 0) {
      console.error("Reference code missing for practical:", pid);
      return NextResponse.json({ error: `Reference code not found for practical ${pid}` }, { status: 404 });
    }

    const ref = refs[0] as any;
    const referenceCode = ref.code ?? "";
    const referenceLang = (ref.language ?? "").toLowerCase();

    if (!referenceCode) {
      console.error("Reference code is empty for practical:", pid);
      return NextResponse.json({ error: `Reference code is empty for practical ${pid}` }, { status: 404 });
    }

    const normalizeLang = (l: string) => {
      if (!l) return "";
      const ll = l.toLowerCase();
      if (ll === "py") return "python";
      if (ll === "c++" || ll === "cpp") return "cpp";
      return ll;
    };

    const refLangNorm = normalizeLang(referenceLang);
    const reqLangNorm = normalizeLang(String(lang));

    if (refLangNorm && reqLangNorm && refLangNorm !== reqLangNorm) {
      console.warn(`Runner language (${reqLangNorm}) does not match reference language (${refLangNorm})`);
      // optional: return error here if you want to strictly enforce match
    }

    // 3) prepare batch
    let batch: any[] = [];
    if (mode === "run") {
      batch = userTestCases.map((utc: any, idx: number) => ({
        id: `user-${idx + 1}`,
        stdinInput: utc.input,
        expectedOutput: null,
        is_hidden: false,
        time_limit_ms: 2000,
        memory_limit_kb: 65536,
      }));
    } else if (mode === "submit") {
      batch = (tcs || []).map((tc: any) => ({
        id: tc.id,
        stdinInput: tc.input,
        expectedOutput: tc.expected_output,
        is_hidden: true,
        time_limit_ms: tc.time_limit_ms ?? 2000,
        memory_limit_kb: tc.memory_limit_kb ?? 65536,
      }));
    }

    if (batch.length === 0) {
      return NextResponse.json({ results: [], verdict: "pending" });
    }

    // 4) call runner
    const EXECUTE_URL = process.env.EXECUTE_URL || "http://localhost:5002/execute";
    const runnerRes = await fetch(EXECUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, reference_code: referenceCode, lang, batch }),
    });

    if (!runnerRes.ok) {
      const text = await runnerRes.text();
      console.error("Runner error:", runnerRes.status, text);
      return NextResponse.json({ error: `Runner error ${runnerRes.status}: ${text}` }, { status: 500 });
    }

    const runnerResults = await runnerRes.json();
    const details = runnerResults.details ?? [];

    // 5) process user test case results
    const userResults = details
      .filter((d: any) => String(d.test_case_id).startsWith("user-"))
      .map((d: any) => ({
        test_case_id: d.test_case_id,
        status: (d.stdout?.trim() ?? "") === (d.reference_stdout?.trim() ?? "") ? "passed" : "failed",
        input: d.stdinInput ?? "",
        expected: d.reference_stdout,
        stdout: d.stdout,
        error: d.stderr || null,
        is_hidden: false,
        time_ms: d.time_ms ?? 0,
        memory_kb: d.memory_kb ?? 0,
      }));

    // 6) save predefined results
    const predefinedResults = details
      .filter((d: any) => !String(d.test_case_id).startsWith("user-"))
      .map((d: any) => {
        const stdout = d.stdout ?? "";
        const tc = (tcs || []).find((t: any) => t.id === d.test_case_id);

        const normalize = (s: string) =>
          String(s ?? "")
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
            .join("\n");

        return {
          submission_id: submissionId,
          test_case_id: d.test_case_id,
          status: normalize(stdout) === normalize(tc?.expected_output ?? "") ? "passed" : "failed",
          stdout,
          stderr: d.stderr || "",
          execution_time_ms: d.time_ms ?? 0,
          memory_used_kb: d.memory_kb ?? 0,
        };
      });

    for (const tcr of predefinedResults) {
      await supabaseAdmin.from("test_case_results").upsert(tcr, { onConflict: "submission_id,test_case_id" });
    }

    // 7) compute marks and update submission
    const passed = predefinedResults.filter((pr: any) => pr.status === "passed").length;
    const total = predefinedResults.length;
    const marksObtained = total > 0 ? Math.round((passed / total) * 10) : 0;

    await supabaseAdmin.from("submissions").update({ status: "evaluated", marks_obtained: marksObtained }).eq("id", submissionId);

    // 8) respond
    return NextResponse.json({
      results: userResults,
      verdict: "evaluated",
      marksObtained,
      passedTestCases: passed,
      totalTestCases: total,
    });
  } catch (err) {
    console.error("Run API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

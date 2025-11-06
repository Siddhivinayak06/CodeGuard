// /app/api/run/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, lang, practicalId, submissionId, userTestCases = [], mode = "run", useCustomTestCases = false } = body;

    if (!code || !lang || !practicalId) {
      return NextResponse.json({ error: "Missing code, lang, or practicalId" }, { status: 400 });
    }

    const pid = Number(practicalId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json({ error: "Invalid practicalId" }, { status: 400 });
    }

    // Fetch DB test cases
    const { data: dbTestCases = [], error: tcErr } = await supabaseAdmin
      .from("test_cases")
      .select("*")
      .eq("practical_id", pid)
      .order("id", { ascending: true });

    if (tcErr) console.error("Failed to fetch test cases:", tcErr);

    // Fetch reference code
    const { data: refs = [] } = await supabaseAdmin
      .from("reference_codes")
      .select("id, language, code, is_primary, created_at")
      .eq("practical_id", pid)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1);

    const ref = refs[0] || null;
    const referenceCode = ref?.code ?? "";
    const referenceLang = (ref?.language ?? "").toLowerCase();

    const normalizeLang = (l: string) => {
      const ll = l.toLowerCase();
      if (ll === "py") return "python";
      if (ll === "c++" || ll === "cpp") return "cpp";
      if (ll === "js") return "javascript";
      return ll;
    };

    const reqLangNorm = normalizeLang(String(lang));
    const refLangNorm = normalizeLang(referenceLang);
    if (refLangNorm && reqLangNorm && refLangNorm !== reqLangNorm) {
      console.warn(`Runner language (${reqLangNorm}) does not match reference language (${refLangNorm})`);
    }

    // Prepare batch based on toggle and mode
    let batch: any[] = [];
    let usedTestCaseSource: "user" | "db" | "none" = "none";

    if (mode === "run") {
      if (useCustomTestCases && userTestCases.length > 0) {
        batch = userTestCases.map((utc: any, idx: number) => ({
          id: `user-${idx + 1}`,
          stdinInput: utc.input ?? "",
          expectedOutput: utc.expectedOutput ?? "", // user expected
          is_hidden: false,
          time_limit_ms: utc.time_limit_ms ?? 2000,
          memory_limit_kb: utc.memory_limit_kb ?? 65536,
        }));
        usedTestCaseSource = "user";
      } else if (dbTestCases.length > 0) {
        batch = dbTestCases.map((tc: any) => ({
          id: tc.id,
          stdinInput: tc.input ?? "",
          expectedOutput: tc.expected_output ?? "",
          is_hidden: tc.is_hidden ?? true,
          time_limit_ms: tc.time_limit_ms ?? 2000,
          memory_limit_kb: tc.memory_limit_kb ?? 65536,
        }));
        usedTestCaseSource = "db";
      }
    } else if (mode === "submit") {
      if (dbTestCases.length === 0) {
        return NextResponse.json({ error: "No test cases configured for this practical" }, { status: 400 });
      }
      if (!submissionId) {
        return NextResponse.json({ error: "submissionId required for mode 'submit'" }, { status: 400 });
      }

      // Use reference output for submission
      batch = dbTestCases.map((tc: any, idx: number) => ({
        id: tc.id,
        stdinInput: tc.input ?? "",
        expectedOutput: tc.expected_output ?? "", // from DB or reference code
        is_hidden: tc.is_hidden ?? true,
        time_limit_ms: tc.time_limit_ms ?? 2000,
        memory_limit_kb: tc.memory_limit_kb ?? 65536,
      }));

      usedTestCaseSource = "db";
    } else {
      return NextResponse.json({ error: "Invalid mode. Use 'run' or 'submit'." }, { status: 400 });
    }

    if (batch.length === 0) {
      return NextResponse.json({ results: [], verdict: "no_testcases" });
    }

    // Call runner service
    const EXECUTE_URL = process.env.EXECUTE_URL || "http://localhost:5002/execute";
    const runnerRes = await fetch(EXECUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        reference_code: referenceCode,
        lang: reqLangNorm || lang,
        batch,
      }),
    });

    if (!runnerRes.ok) {
      const text = await runnerRes.text();
      console.error("Runner error:", runnerRes.status, text);
      return NextResponse.json({ error: `Runner error ${runnerRes.status}: ${text}` }, { status: 500 });
    }

    const runnerResults = await runnerRes.json();
    const details = runnerResults.details ?? [];

    const normalizeOutputText = (s: any) =>
      String(s ?? "").split("\n").map(line => line.trim()).filter(Boolean).join("\n");

    const batchMap = new Map(batch.map(b => [b.id, b]));

    const allResults = details.map((d: any) => {
      const isUser = String(d.test_case_id).startsWith("user-");
      const tc = isUser ? null : dbTestCases.find(t => Number(t.id) === Number(d.test_case_id));
      const batchItem = batchMap.get(d.test_case_id);

      const stdout = d.stdout ?? "";
      const expected = isUser ? batchItem?.expectedOutput ?? "" : tc?.expected_output ?? "";
      const input = isUser ? batchItem?.stdinInput ?? "" : tc?.input ?? "";

      return {
        test_case_id: d.test_case_id,
        status: normalizeOutputText(stdout) === normalizeOutputText(expected) ? "passed" : "failed",
        input,
        expected,
        stdout,
        error: d.stderr || null,
        is_hidden: isUser ? false : tc?.is_hidden ?? true,
        time_ms: d.time_ms ?? 0,
        memory_kb: d.memory_kb ?? 0,
      };
    });

    // Submission result handling
    let passed = 0;
    let total = 0;
    let marksObtained = 0;
    const predefinedResults = allResults.filter(r => !String(r.test_case_id).startsWith("user-"));

    if (mode === "submit" && submissionId) {
      for (const tcr of predefinedResults) {
        try {
          await supabaseAdmin.from("test_case_results").upsert(
            {
              submission_id: submissionId,
              test_case_id: tcr.test_case_id,
              status: tcr.status,
              stdout: tcr.stdout,
              stderr: tcr.error ?? "",
              execution_time_ms: tcr.time_ms,
              memory_used_kb: tcr.memory_kb,
            },
            { onConflict: "submission_id,test_case_id" }
          );
        } catch (e) {
          console.error("Failed to upsert test_case_result:", e);
        }
      }

      passed = predefinedResults.filter(r => r.status === "passed").length;
      total = predefinedResults.length;
      marksObtained = total > 0 ? Math.round((passed / total) * 10) : 0;

      try {
        await supabaseAdmin
          .from("submissions")
          .update({ status: "evaluated", marks_obtained: marksObtained })
          .eq("id", submissionId);
      } catch (e) {
        console.error("Failed to update submission:", e);
      }
    } else {
      passed = predefinedResults.filter(r => r.status === "passed").length;
      total = predefinedResults.length;
      marksObtained = total > 0 ? Math.round((passed / total) * 10) : 0;
    }

    return NextResponse.json({
      results: allResults,
      verdict: "evaluated",
      marksObtained,
      passedTestCases: passed,
      totalTestCases: total,
      usedTestCaseSource,
      raw_details: details,
    });

  } catch (err) {
    console.error("Run API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
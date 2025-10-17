import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

type TCRow = {
  id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean | null;
  time_limit_ms: number | null;
  memory_limit_kb: number | null;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, lang, practicalId, submissionId } = body;

    if (!code || !lang || !practicalId || !submissionId) {
      return NextResponse.json({ error: "Missing code, lang, practicalId, or submissionId" }, { status: 400 });
    }

    // 1️⃣ Fetch test cases
    const { data: tcs, error: tcErr } = await supabaseAdmin
      .from<TCRow>("test_cases")
      .select("*")
      .eq("practical_id", practicalId)
      .order("id", { ascending: true });

    if (tcErr) {
      console.error("Failed to fetch test cases:", tcErr);
      return NextResponse.json({ error: "Failed to load test cases" }, { status: 500 });
    }

    if (!tcs || tcs.length === 0) {
      return NextResponse.json({ results: [], verdict: "pending" });
    }

    // 2️⃣ Call your runner service with retry
    const EXECUTE_URL = process.env.EXECUTE_URL || "http://localhost:5002/execute";
    let runnerRes: Response;
    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        runnerRes = await fetch(EXECUTE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code,
            lang,
            batch: tcs.map(tc => ({
              id: tc.id,
              stdinInput: tc.input,
              time_limit_ms: tc.time_limit_ms ?? 2000,
              memory_limit_kb: tc.memory_limit_kb ?? 65536,
            })),
          }),
        });
        if (runnerRes.ok) break;
      } catch (fetchErr) {
        attempts++;
        if (attempts >= maxAttempts) throw fetchErr;
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
      }
    }

    if (!runnerRes!.ok) {
      const text = await runnerRes!.text();
      return NextResponse.json({ error: `Runner error ${runnerRes!.status}: ${text}` }, { status: 500 });
    }

    const runnerResults = await runnerRes.json() as {
      verdict: string;
      details: Array<{
        test_case_id: number;
        status: string;
        stdout: string;
        stderr: string;
        time_ms: number | null;
        memory_kb: number | null;
      }>;
    };

// 3️⃣ Process results: compute correct status by comparing output with expected
const processedResults = runnerResults.details.map(d => {
  const tc = tcs.find(tc => tc.id === d.test_case_id);
  if (!tc) throw new Error(`Test case ${d.test_case_id} not found`);

  let status = "failed";
  if (d.stderr && d.stderr.toLowerCase().includes("compile")) status = "compile_error";
  else if (d.stderr && d.stderr.toLowerCase().includes("timeout")) status = "timeout";
  else if (d.stderr && d.stderr !== "") status = "runtime_error";
  // ✅ Ignore trailing whitespace on each line
  else if (
    d.stdout
      .split("\n")
      .map(line => line.trimEnd())
      .join("\n") ===
    tc.expected_output
      .split("\n")
      .map(line => line.trimEnd())
      .join("\n")
  )
    status = "passed";
  else status = "failed";

  return {
    test_case_id: d.test_case_id,
    status,
    input: tc.input,
    expected: tc.expected_output,
    stdout: d.stdout,
    error: d.stderr || null,
    time_ms: d.time_ms,
    memory_kb: d.memory_kb,
    is_hidden: tc.is_hidden,
  };
});

    // 4️⃣ Insert / upsert test case results
    const tcrInserts = processedResults.map(pr => ({
      submission_id: submissionId,
      test_case_id: pr.test_case_id,
      status: pr.status,
      stdout: pr.stdout,
      stderr: pr.error || "",
      execution_time_ms: pr.time_ms,
      memory_used_kb: pr.memory_kb,
    }));

    for (const tcr of tcrInserts) {
      await supabaseAdmin
        .from("test_case_results")
        .upsert(tcr, { onConflict: "submission_id,test_case_id" });
    }

    // 5️⃣ Compute overall status, marks, and combined output
    const submissionStatus = "evaluated";
    const passed = processedResults.filter(pr => pr.status === "passed").length;
    const total = processedResults.length;
    const marksObtained = total > 0 ? Math.round((passed / total) * 10) : 0;
    const combinedOutput = processedResults
      .map(pr => pr.error ? `ERROR: ${pr.error}` : `${pr.status.toUpperCase()}: ${pr.stdout}`)
      .join("\n\n");

    // 6️⃣ Update submission
    const { error: subErr } = await supabaseAdmin
      .from("submissions")
      .update({ status: submissionStatus, output: combinedOutput, marks_obtained: marksObtained })
      .eq("id", submissionId);

    if (subErr) console.error("Failed to update submission:", subErr);

    return NextResponse.json({ results: processedResults, verdict: submissionStatus });

  } catch (err) {
    console.error("Run API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

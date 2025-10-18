import { supabaseAdmin } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, lang, practicalId, submissionId, userTestCases = [] } = body;

    if (!code || !lang || !practicalId || !submissionId) {
      return NextResponse.json(
        { error: "Missing code, lang, practicalId, or submissionId" },
        { status: 400 }
      );
    }

    // 1️⃣ Fetch predefined test cases
    const { data: tcs, error: tcErr } = await supabaseAdmin
      .from("test_cases")
      .select("*")
      .eq("practical_id", practicalId)
      .order("id", { ascending: true });

    if (tcErr) {
      console.error("Failed to fetch test cases:", tcErr);
      return NextResponse.json({ error: "Failed to load test cases" }, { status: 500 });
    }

    // 2️⃣ Read reference code
    const refPath = path.join(process.cwd(), "app", "api", "run", "reference", `${practicalId}.c`);
    let referenceCode = "";
    try {
      referenceCode = await fs.readFile(refPath, "utf-8");
    } catch (err) {
      console.error("Reference code missing:", refPath);
      return NextResponse.json(
        { error: `Reference code not found for ${practicalId}` },
        { status: 404 }
      );
    }

    // 3️⃣ Build execution batch
    const batch = [
      ...(tcs || []).map((tc) => ({
        id: tc.id,
        stdinInput: tc.input,
        expectedOutput: tc.expected_output,
        is_hidden: true, // predefined always hidden
        time_limit_ms: tc.time_limit_ms ?? 2000,
        memory_limit_kb: tc.memory_limit_kb ?? 65536,
      })),
      ...userTestCases.map((utc, idx) => ({
        id: `user-${idx + 1}`,
        stdinInput: utc.input,
        expectedOutput: null, // will compare against reference code
        is_hidden: false,
        time_limit_ms: 2000,
        memory_limit_kb: 65536,
      })),
    ];

    if (batch.length === 0) {
      return NextResponse.json({ results: [], verdict: "pending" });
    }

    // 4️⃣ Run code in Docker
    const EXECUTE_URL = process.env.EXECUTE_URL || "http://localhost:5002/execute";
    const runnerRes = await fetch(EXECUTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code, // user code
        reference_code: referenceCode, // reference code
        lang,
        batch,
      }),
    });

    if (!runnerRes.ok) {
      const text = await runnerRes.text();
      return NextResponse.json({ error: `Runner error ${runnerRes.status}: ${text}` }, { status: 500 });
    }

    const runnerResults = await runnerRes.json();
    const details = runnerResults.details ?? []; // fallback if undefined

    // 5️⃣ Process user test case results only
const userResults = details
  .filter((d: any) => String(d.test_case_id).startsWith("user-"))
  .map((d: any) => ({
    test_case_id: d.test_case_id,
    status: (d.stdout?.trim() ?? "") === (d.reference_stdout?.trim() ?? "") ? "passed" : "failed",
    input: d.stdinInput ?? "",   // <-- fix here
    expected: d.reference_stdout,
    stdout: d.stdout,
    error: d.stderr || null,
    is_hidden: false,
    time_ms: d.time_ms ?? 0,
    memory_kb: d.memory_kb ?? 0,
  }));

console.log("User results ready:", userResults);


    // 6️⃣ Save predefined test case results for scoring
    const predefinedResults = details
      .filter((d: any) => !String(d.test_case_id).startsWith("user-"))
      .map((d: any) => {
        const stdout = d.stdout ?? "";
        const tc = tcs?.find((tc) => tc.id === d.test_case_id);
        return {
          submission_id: submissionId,
          test_case_id: d.test_case_id,
          status: stdout.trimEnd() === tc?.expected_output?.trimEnd() ? "passed" : "failed",
          stdout,
          stderr: d.stderr || "",
          execution_time_ms: d.time_ms ?? 0,
          memory_used_kb: d.memory_kb ?? 0,
        };
      });

    for (const tcr of predefinedResults) {
      await supabaseAdmin
        .from("test_case_results")
        .upsert(tcr, { onConflict: "submission_id,test_case_id" });
    }

    // 7️⃣ Compute marks
    const passed = predefinedResults.filter((pr) => pr.status === "passed").length;
    const total = predefinedResults.length;
    const marksObtained = total > 0 ? Math.round((passed / total) * 10) : 0;

    await supabaseAdmin
      .from("submissions")
      .update({ status: "evaluated", marks_obtained: marksObtained })
      .eq("id", submissionId);

    // 8️⃣ Return only user test case results
    return NextResponse.json({ results: userResults, verdict: "evaluated" });

  } catch (err) {
    console.error("Run API error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

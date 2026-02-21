// /app/api/run/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const body = await req.json();
    const {
      code,
      lang,
      practicalId,
      submissionId,
      userTestCases = [],
      mode = "run",
      level,
      useCustomTestCases = false,
    } = body;

    if (!code || !lang || !practicalId) {
      return NextResponse.json(
        { error: "Missing code, lang, or practicalId" },
        { status: 400 },
      );
    }

    const pid = Number(practicalId);
    if (!Number.isFinite(pid) || pid <= 0) {
      return NextResponse.json(
        { error: "Invalid practicalId" },
        { status: 400 },
      );
    }

    // Determine max marks and level filter
    let maxMarks = 10; // Default
    let levelId: string | null = null;

    if (level) {
      const { data: levelData } = (await supabase
        .from("practical_levels")
        .select("id, max_marks")
        .eq("practical_id", pid)
        .eq("level", level)
        .single()) as any;

      if (levelData) {
        levelId = String(levelData.id);
        maxMarks = levelData.max_marks || 10;
      }
    }

    // Fetch DB test cases (filtered by level if applicable)
    let query = supabase
      .from("test_cases")
      .select("*")
      .eq("practical_id", pid)
      .order("id", { ascending: true });

    // Key filtering logic:
    // If levelId exists, only get test cases for that level.
    // If no levelId (single level mode), only get test cases where level_id IS NULL.
    if (levelId) {
      query = query.eq("level_id", Number(levelId));
    } else {
      query = query.is("level_id", null);
    }

    const { data: dbTestCasesData, error: tcErr } = await query;
    const dbTestCases = dbTestCasesData || [];

    if (tcErr) console.error("Failed to fetch test cases:", tcErr);

    // Fetch reference code - Use Admin client to bypass RLS if student is running
    const { supabaseAdmin } = await import("@/lib/supabase/service");

    let { data: refsData } = (await supabaseAdmin
      .from("reference_codes")
      .select("id, language, code, is_primary, created_at")
      .eq("practical_id", pid)
      .eq("language", lang)
      .limit(1)) as any as { data: any[] };

    // If no language-specific match, fallback to primary/latest
    if (!refsData || refsData.length === 0) {
      const { data: fallbackData } = (await supabaseAdmin
        .from("reference_codes")
        .select("id, language, code, is_primary, created_at")
        .eq("practical_id", pid)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)) as any as { data: any[] };
      refsData = fallbackData;
    }

    const refs = refsData || [];
    const ref = refs[0] || null;
    const referenceCode = ref?.code ?? "";
    const referenceLang = (ref?.language ?? "").toLowerCase();

    console.log(`[Debug] PracticalID: ${pid}, Lang: ${lang}`);
    console.log(`[Debug] Reference Code Found: ${!!referenceCode}, RefLang: ${referenceLang}`);

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
      console.log(
        `Using fallback reference language (${refLangNorm}) for runner language (${reqLangNorm})`,
      );
    }

    // helper to call runner service
    const EXECUTE_URL =
      process.env.EXECUTE_URL || "http://localhost:5002/execute";

    // Get the Supabase session token to forward to backend
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? "";

    const callRunner = async (payload: any) => {
      const runnerRes = await fetch(EXECUTE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!runnerRes.ok) {
        const text = await runnerRes.text();
        throw new Error(`Runner error ${runnerRes.status}: ${text}`);
      }
      return await runnerRes.json();
    };

    // Prepare batch based on toggle and mode
    let batch: any[] = [];
    let usedTestCaseSource: "user" | "db" | "none" = "none";

    if (mode === "run") {
      if (useCustomTestCases && userTestCases.length > 0) {
        // Build user batch (ids prefixed with user-)
        const userBatch = userTestCases.map((utc: any, idx: number) => ({
          id: `user-${idx + 1}`,
          stdinInput: utc.input ?? "",
          expectedOutput: utc.expectedOutput ?? "",
          is_hidden: false,
          time_limit_ms: utc.time_limit_ms ?? 2000,
          memory_limit_kb:
            utc.memory_limit_kb ?? (reqLangNorm === "java" ? 262144 : 65536),
        }));

        usedTestCaseSource = "user";

        // If we have a reference code, run it first to generate expected outputs
        if (referenceCode) {
          try {
            const refPayload = {
              code: referenceCode,
              lang: refLangNorm || reqLangNorm || String(lang),
              batch: userBatch.map((u: any) => ({
                id: u.id,
                stdinInput: u.stdinInput,
                time_limit_ms: u.time_limit_ms,
                memory_limit_kb: u.memory_limit_kb,
              })),
            };
            const refRes = await callRunner(refPayload);
            const refDetails = refRes.details ?? [];

            // Map reference outputs by id
            const refMap = new Map<string, string>();
            for (const d of refDetails) {
              const out = String(d.stdout ?? "");
              refMap.set(String(d.test_case_id), out);
            }

            // Fill expectedOutput in userBatch
            batch = userBatch.map((u: any) => ({
              ...u,
              expectedOutput: refMap.get(u.id) ?? "",
            }));
            console.log(`[Debug] Generated expected outputs for ${batch.length} user test cases.`);
          } catch (e: any) {
            console.error(
              "Failed to run reference code for user test cases:",
              e,
            );
            batch = userBatch;
          }
        } else {
          batch = userBatch;
        }
      } else if (dbTestCases.length > 0) {
        batch = dbTestCases.map((tc: any) => ({
          id: tc.id,
          stdinInput: tc.input ?? "",
          expectedOutput: tc.expected_output ?? "",
          is_hidden: tc.is_hidden ?? true,
          time_limit_ms: tc.time_limit_ms ?? 2000,
          memory_limit_kb:
            tc.memory_limit_kb ?? (reqLangNorm === "java" ? 262144 : 65536),
        }));
        usedTestCaseSource = "db";
      }
    } else if (mode === "submit") {
      if (dbTestCases.length === 0) {
        return NextResponse.json(
          { error: "No test cases configured for this practical" },
          { status: 400 },
        );
      }
      if (!submissionId) {
        return NextResponse.json(
          { error: "submissionId required for mode 'submit'" },
          { status: 400 },
        );
      }

      // Use reference output for submission
      batch = dbTestCases.map((tc: any, idx: number) => ({
        id: tc.id,
        stdinInput: tc.input ?? "",
        expectedOutput: tc.expected_output ?? "",
        is_hidden: tc.is_hidden ?? true,
        time_limit_ms: tc.time_limit_ms ?? 2000,
        memory_limit_kb:
          tc.memory_limit_kb ?? (reqLangNorm === "java" ? 262144 : 65536),
      }));

      usedTestCaseSource = "db";
    } else {
      return NextResponse.json(
        { error: "Invalid mode. Use 'run' or 'submit'." },
        { status: 400 },
      );
    }

    if (batch.length === 0) {
      return NextResponse.json({ results: [], verdict: "no_testcases" });
    }

    // Now run student's code
    let runnerResults;
    try {
      runnerResults = await callRunner({
        code,
        reference_code: referenceCode || undefined,
        reference_lang: refLangNorm || referenceLang || undefined,
        lang: reqLangNorm || lang,
        batch,
      });
    } catch (e: any) {
      console.error("Runner error:", e);
      return NextResponse.json(
        { error: e.message || "Runner failed" },
        { status: 500 },
      );
    }

    const details = runnerResults.details ?? [];

    const normalizeOutputText = (s: any) =>
      String(s ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .join("\n");

    const batchMap = new Map(batch.map((b) => [String(b.id), b]));

    // Build results
    const allResults = details.map((d: any) => {
      const idStr = String(d.test_case_id);
      const isUser = idStr.startsWith("user-");
      const batchItem = batchMap.get(idStr);

      const stdout = d.stdout ?? "";
      const expected = batchItem?.expectedOutput ?? "";
      const input = batchItem?.stdinInput ?? "";

      let status: string;
      if (isUser) {
        if (expected && expected !== "") {
          const normStdout = normalizeOutputText(stdout);
          const normExpected = normalizeOutputText(expected);
          status = normStdout === normExpected ? "passed" : "failed";
        } else {
          status = "ran";
        }
      } else {
        const normStdout = normalizeOutputText(stdout);
        const normExpected = normalizeOutputText(expected);
        status = normStdout === normExpected ? "passed" : "failed";
      }

      return {
        test_case_id: d.test_case_id,
        status,
        input,
        expected,
        stdout,
        error: d.stderr || null,
        is_hidden: isUser ? false : (batchItem?.is_hidden ?? true),
        time_ms: d.time_ms ?? 0,
        memory_kb: d.memory_kb ?? 0,
      };
    });

    // Submission result handling
    let passed = 0;
    let total = 0;
    let marksObtained = 0;
    const predefinedResults = allResults.filter(
      (r: any) => !String(r.test_case_id).startsWith("user-"),
    );

    if (mode === "submit" && submissionId) {
      // Calculate marks first
      passed = predefinedResults.filter(
        (r: any) => r.status === "passed",
      ).length;
      total = predefinedResults.length;
      const baseMarks = total > 0 ? Math.round((passed / total) * maxMarks) : 0;
      let penalty = 0;
      let daysLate = 0;

      // Late Submission Penalty Logic
      try {
        const { data: practicalData } = await (supabase
          .from("practicals") as any)
          .select("schedule_date, schedule_time")
          .eq("id", pid)
          .single();

        if (practicalData?.schedule_date) {
          const now = new Date();
          const scheduleDate = new Date(practicalData.schedule_date);
          let endHour = 23;
          let endMinute = 59;

          if (practicalData.schedule_time) {
            const parts = practicalData.schedule_time.split("-");
            const endTimePart = parts[1]?.trim();
            if (endTimePart) {
              const [h, m] = endTimePart.split(":").map(Number);
              if (!isNaN(h)) endHour = h;
              if (!isNaN(m)) endMinute = m;
            }
          }

          const deadline = new Date(scheduleDate);
          deadline.setHours(endHour, endMinute, 0, 0);

          if (now > deadline) {
            const diffTime = now.getTime() - deadline.getTime();
            daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (daysLate >= 14) {
              penalty = 2;
            } else if (daysLate >= 7) {
              penalty = 1;
            }
            console.log(`[Late Submission] Days Late: ${daysLate}, Penalty: ${penalty}`);
          }
        }
      } catch (e) {
        console.error("Error calculating late penalty:", e);
      }

      marksObtained = Math.max(0, baseMarks - penalty);

      // Check existing marks and fetch student_id
      let shouldUpdate = true;
      let studentId = null;
      try {
        const { data: currentSub } = (await supabase
          .from("submissions")
          .select("marks_obtained, student_id")
          .eq("id", submissionId)
          .single()) as any;

        studentId = currentSub?.student_id;
      } catch (e) {
        console.error("Error checking existing marks:", e);
      }

      const newStatus = marksObtained >= 4 ? "passed" : "failed";

      // Re-check shouldUpdate with FINAL marks
      try {
        const { data: currentSub } = (await supabase
          .from("submissions")
          .select("marks_obtained")
          .eq("id", submissionId)
          .single()) as any;

        if (currentSub && (currentSub.marks_obtained || 0) > marksObtained) {
          shouldUpdate = false;
        }
      } catch (e) {
        console.warn("Failed to update submission with final marks:", e);
      }

      if (shouldUpdate) {
        try {
          await (supabase
            .from("submissions") as any)
            .update({
              status: newStatus,
              marks_obtained: marksObtained,
              code,
              language: reqLangNorm || lang,
              test_cases_passed: String(passed),
              output:
                predefinedResults.length > 0 ? predefinedResults[0].stdout : "",
              execution_details: {
                verdict: newStatus,
                results: predefinedResults,
                judged_at: new Date().toISOString(),
              },
            })
            .eq("id", submissionId);
        } catch (e) {
          console.error("Failed to update submission:", e);
        }
      } else {
        passed = predefinedResults.filter(
          (r: any) => r.status === "passed",
        ).length;
        total = predefinedResults.length;
        marksObtained = total > 0 ? Math.round((passed / total) * maxMarks) : 0;
      }

      // Always increment attempt_count on submission (outside shouldUpdate)
      // Use admin client to bypass RLS policies on student_practicals
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        const sid = studentId || authUser?.id;
        if (sid) {
          const { data: spData } = (await supabaseAdmin
            .from("student_practicals")
            .select("id, attempt_count")
            .eq("student_id", sid)
            .eq("practical_id", pid)
            .single()) as any;

          if (spData) {
            await (supabaseAdmin
              .from("student_practicals") as any)
              .update({ attempt_count: (spData.attempt_count || 0) + 1 })
              .eq("id", spData.id);
          }
        }
      } catch (e) {
        console.error("Failed to increment attempt count:", e);
      }
    } else {
      passed = predefinedResults.filter(
        (r: any) => r.status === "passed",
      ).length;
      total = predefinedResults.length;
      marksObtained = total > 0 ? Math.round((passed / total) * maxMarks) : 0;
    }

    return NextResponse.json({
      results: allResults,
      verdict: marksObtained >= 4 ? "passed" : "failed",
      marksObtained,
      passedTestCases: passed,
      totalTestCases: total,
      usedTestCaseSource,
      raw_details: details,
    });
  } catch (err) {
    console.error("Run API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

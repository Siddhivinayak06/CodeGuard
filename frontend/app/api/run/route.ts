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

    // --- Required Checks (Attempts, Locks, Deadlines) ---
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: spRecord } = (await supabase
      .from("student_practicals")
      .select("attempt_count, max_attempts, is_locked, lock_reason, assigned_deadline")
      .eq("student_id", user.id)
      .eq("practical_id", pid)
      .single()) as any;

    if (!spRecord) {
      return NextResponse.json({ error: "Allocation not found" }, { status: 404 });
    }

    if (spRecord.is_locked) {
      // For multi-level practicals, skip the lock check when running a specific level.
      // The lock may have been set by a sibling task passing in the same submission batch.
      let skipLock = false;
      if (level) {
        const { count } = await supabase
          .from("practical_levels")
          .select("*", { count: "exact", head: true })
          .eq("practical_id", pid);
        if (count && count > 0) {
          skipLock = true;
        }
      }

      if (!skipLock) {
        return NextResponse.json({ error: spRecord.lock_reason || "Session locked" }, { status: 403 });
      }
    }

    if (mode === "submit") {
      const attempts = spRecord.attempt_count || 0;
      const maxAttempts = spRecord.max_attempts || 1;
      if (attempts > maxAttempts) {
        return NextResponse.json({ error: "Attempt limit exceeded" }, { status: 403 });
      }
    }

    // Deadline check for exams
    const { data: examData } = (await supabase
      .from("exams")
      .select("end_time")
      .eq("practical_id", pid)
      .maybeSingle()) as any;

    if (examData?.end_time) {
      const now = new Date();
      const endTime = new Date(examData.end_time);
      // 5-min grace
      if (now.getTime() > endTime.getTime() + 300000) {
        return NextResponse.json({ error: "Exam has ended" }, { status: 403 });
      }
    }
    // --- End Required Checks ---

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

    // Fetch reference code. Prefer admin client, but gracefully fall back to standard client.
    let refsData: any[] | null = null;
    try {
      const { supabaseAdmin } = await import("@/lib/supabase/service");

      const { data: primaryData } = (await supabaseAdmin
        .from("reference_codes")
        .select("id, language, code, is_primary, created_at")
        .eq("practical_id", pid)
        .eq("language", lang)
        .limit(1)) as any as { data: any[] };

      refsData = primaryData || [];

      // If no language-specific match, fallback to primary/latest
      if (!refsData || refsData.length === 0) {
        const { data: fallbackData } = (await supabaseAdmin
          .from("reference_codes")
          .select("id, language, code, is_primary, created_at")
          .eq("practical_id", pid)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)) as any as { data: any[] };
        refsData = fallbackData || [];
      }
    } catch (refErr) {
      console.warn("[Run API] Admin reference fetch failed, using regular client:", refErr);

      const { data: primaryData } = (await supabase
        .from("reference_codes")
        .select("id, language, code, is_primary, created_at")
        .eq("practical_id", pid)
        .eq("language", lang)
        .limit(1)) as any as { data: any[] };

      refsData = primaryData || [];

      if (!refsData || refsData.length === 0) {
        const { data: fallbackData } = (await supabase
          .from("reference_codes")
          .select("id, language, code, is_primary, created_at")
          .eq("practical_id", pid)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(1)) as any as { data: any[] };
        refsData = fallbackData || [];
      }
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

    const buildRunnerFailure = (
      message: string,
      currentBatch: any[],
      currentMode: "run" | "submit",
      source: "user" | "db" | "none",
    ) => {
      const results = (currentBatch || []).map((b: any) => ({
        test_case_id: b?.id ?? 0,
        status: "runtime_error",
        input: b?.stdinInput ?? "",
        expected: b?.expectedOutput ?? "",
        stdout: "",
        error: message,
        is_hidden: b?.is_hidden ?? false,
        time_ms: 0,
        memory_kb: 0,
      }));

      const predefinedResults = results.filter(
        (r: any) => !String(r.test_case_id).startsWith("user-"),
      );

      return NextResponse.json({
        results,
        verdict: "failed",
        marksObtained: 0,
        passedTestCases: 0,
        totalTestCases: predefinedResults.length,
        usedTestCaseSource: source,
        raw_details: [],
        executionError: message,
        mode: currentMode,
      });
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
              mode: "run",
              executionModel: "stdin_legacy",
              failFast: false,
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

    // Run student's code (no change needed here — reference execution already happened above for user test cases)
    let runnerResults;
    try {
      runnerResults = await callRunner({
        code,
        reference_code: referenceCode || undefined,
        reference_lang: refLangNorm || referenceLang || undefined,
        mode,
        executionModel: "wrapper_harness",
        failFast: true,
        lang: reqLangNorm || lang,
        batch,
      });
    } catch (e: any) {
      console.error("Runner error:", e);
      const runnerMessage = String(e?.message || "Runner failed").slice(0, 1200);
      return buildRunnerFailure(runnerMessage, batch, mode, usedTestCaseSource);
    }

    const details = runnerResults.details ?? [];

    const sanitizeOutputText = (s: any) =>
      String(s ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u00A0/g, " ")
        .replace(/\0/g, "")
        .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .normalize("NFKC");

    const normalizeOutputText = (s: any) =>
      sanitizeOutputText(s)
        .split("\n")
        .map((line) => line.trimEnd())
        .join("\n")
        .trim();

    const outputsLooselyEqual = (a: any, b: any) => {
      const normA = normalizeOutputText(a);
      const normB = normalizeOutputText(b);
      if (normA === normB) return true;

      const compactA = normA.replace(/\s+/g, " ").trim();
      const compactB = normB.replace(/\s+/g, " ").trim();
      return compactA === compactB;
    };

    const batchMap = new Map(batch.map((b) => [String(b.id), b]));

    // Grade helper — maps percentage to college grades
    const getGrade = (obtained: number, maxTotal: number): string => {
      if (maxTotal <= 0) return 'poor';
      const pct = (obtained / maxTotal) * 100;
      if (pct >= 90) return 'excellent';
      if (pct >= 75) return 'very_good';
      if (pct >= 60) return 'good';
      if (pct >= 40) return 'needs_improvement';
      return 'poor';
    };

    const gradeLabel = (grade: string): string => {
      const labels: Record<string, string> = {
        excellent: 'Excellent',
        very_good: 'Very Good',
        good: 'Good',
        needs_improvement: 'Needs Improvement',
        poor: 'Poor',
      };
      return labels[grade] || grade;
    };

    const gradeToSubmissionStatus = (grade: string): "passed" | "failed" => {
      return ["excellent", "very_good", "good"].includes(grade)
        ? "passed"
        : "failed";
    };

    // Build results — preserve the backend's granular verdicts
    const allResults = details.map((d: any) => {
      const idStr = String(d.test_case_id);
      const isUser = idStr.startsWith("user-");
      const batchItem = batchMap.get(idStr);

      const stdout = d.stdout ?? "";
      const expected = batchItem?.expectedOutput ?? "";
      const input = batchItem?.stdinInput ?? "";
      const runnerStatus = String(d.status ?? "").toLowerCase();

      // Preserve granular verdicts from backend
      let status: string;
      if (
        runnerStatus === "accepted" ||
        runnerStatus === "wrong_answer" ||
        runnerStatus === "compile_error" ||
        runnerStatus === "runtime_error" ||
        runnerStatus === "time_limit_exceeded" ||
        runnerStatus === "memory_limit_exceeded" ||
        runnerStatus === "output_limit_exceeded" ||
        runnerStatus === "skipped_fail_fast"
      ) {
        status = runnerStatus;

        // Guardrail: if backend says wrong_answer but normalized output matches
        // expected text, classify as accepted to avoid false negatives.
        if (
          runnerStatus === "wrong_answer" &&
          expected !== "" &&
          outputsLooselyEqual(stdout, expected)
        ) {
          status = "accepted";
        }
      } else if (runnerStatus === "passed") {
        status = "accepted";
      } else if (isUser) {
        if (expected && expected !== "") {
          status = outputsLooselyEqual(stdout, expected)
            ? "accepted"
            : "wrong_answer";
        } else {
          status = "accepted"; // ran successfully, no expected to compare
        }
      } else {
        status = outputsLooselyEqual(stdout, expected)
          ? "accepted"
          : "wrong_answer";
      }

      return {
        test_case_id: d.test_case_id,
        status,
        input,
        expected,
        stdout,
        stderr: d.stderr || null,
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
        (r: any) => r.status === "accepted" || r.status === "passed",
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
        // Single query instead of two separate ones
        const { data: currentSub } = (await supabase
          .from("submissions")
          .select("marks_obtained, student_id")
          .eq("id", submissionId)
          .single()) as any;

        studentId = currentSub?.student_id;
        if (currentSub && (currentSub.marks_obtained || 0) > marksObtained) {
          shouldUpdate = false;
        }
      } catch (e) {
        console.error("Error checking existing marks:", e);
      }

      const grade = getGrade(marksObtained, maxMarks);
      const newStatus = gradeToSubmissionStatus(grade);

      if (shouldUpdate) {
        try {
          const { error: updateError } = await (supabase
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
                verdict: grade,
                db_status: newStatus,
                results: predefinedResults,
                judged_at: new Date().toISOString(),
              },
            })
            .eq("id", submissionId);

          if (updateError) {
            throw updateError;
          }
        } catch (e) {
          console.error("Failed to update submission:", e);
          throw e;
        }
      } else {
        passed = predefinedResults.filter(
        (r: any) => r.status === "accepted" || r.status === "passed",
      ).length;
        total = predefinedResults.length;
        marksObtained = total > 0 ? Math.round((passed / total) * maxMarks) : 0;
      }

      // attempt_count is consumed at start time (/api/practical/start or /api/exam/start).
    } else {
      passed = predefinedResults.filter(
        (r: any) => r.status === "accepted" || r.status === "passed",
      ).length;
      total = predefinedResults.length;
      marksObtained = total > 0 ? Math.round((passed / total) * maxMarks) : 0;
    }

    const overallGrade = getGrade(marksObtained, maxMarks);

    return NextResponse.json({
      results: allResults,
      verdict: overallGrade,
      verdictLabel: gradeLabel(overallGrade),
      grade: overallGrade,
      marksObtained,
      passedTestCases: passed,
      totalTestCases: total,
      usedTestCaseSource,
      raw_details: details,
    });
  } catch (err) {
    console.error("Run API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

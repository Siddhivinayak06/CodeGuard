// /app/api/run/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type StudentErrorFormatInput = {
  status?: string | null;
  language?: string | null;
  stderr?: string | null;
};

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_ESCAPE_REGEX = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const OSC_ESCAPE_REGEX = new RegExp(`${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)`, "g");

const normalizeRunnerErrorText = (raw?: string | null): string => {
  const text = String(raw ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(ANSI_ESCAPE_REGEX, "")
    .replace(OSC_ESCAPE_REGEX, "");

  const noiseLinePatterns: RegExp[] = [
    /^__SERVER_LOG__/,
    /^---\s*Execution Finished\s*---$/,
    /^✅\s*Compilation successful$/,
    /^\.\.\.Program finished with exit code\s+\d+$/,
  ];

  return text
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .filter((line) => !noiseLinePatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();
};

const getErrorTitle = (status?: string | null, language?: string | null) => {
  const normalizedStatus = String(status || "runtime_error").toLowerCase();
  const langLabel = String(language || "code").toUpperCase();

  if (normalizedStatus === "compile_error") {
    return `Compilation Error (${langLabel})`;
  }
  if (normalizedStatus === "time_limit_exceeded") {
    return "Time Limit Exceeded";
  }
  if (normalizedStatus === "memory_limit_exceeded") {
    return "Memory Limit Exceeded";
  }
  if (normalizedStatus === "output_limit_exceeded") {
    return "Output Limit Exceeded";
  }
  return `Runtime Error (${langLabel})`;
};

const extractPrimaryErrorLine = (cleaned: string) => {
  if (!cleaned) return "Unknown error.";

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const priorityPatterns: RegExp[] = [
    /\berror:/i,
    /\bexception\b/i,
    /\btraceback\b/i,
    /\bsyntaxerror\b/i,
    /\bindentationerror\b/i,
    /\bnameerror\b/i,
    /\bsegmentation fault\b/i,
    /\bcannot find symbol\b/i,
    /\bcould not find or load main class\b/i,
    /\btime limit exceeded\b/i,
    /\bmemory limit exceeded\b/i,
  ];

  for (const pattern of priorityPatterns) {
    const match = lines.find((line) => pattern.test(line));
    if (match) return match;
  }

  return lines[0] || "Unknown error.";
};

const extractLocationLine = (cleaned: string) => {
  if (!cleaned) return null;

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const locationPatterns: RegExp[] = [
    /File\s+"[^"]+",\s+line\s+\d+/i,
    /[A-Za-z0-9_./-]+\.(?:c|cc|cpp|cxx|h|hpp|java|py|js|ts|tsx|jsx):\d+(?::\d+)?/i,
    /\bline\s+\d+\b/i,
  ];

  for (const pattern of locationPatterns) {
    const match = lines.find((line) => pattern.test(line));
    if (match) return match;
  }

  return null;
};

const inferFixHint = (
  cleaned: string,
  status?: string | null,
  language?: string | null,
) => {
  const text = String(cleaned || "").toLowerCase();
  const normalizedStatus = String(status || "runtime_error").toLowerCase();
  const normalizedLanguage = String(language || "").toLowerCase();

  if (text.includes("cannot find symbol")) {
    return "Check spelling of class, method, and variable names, and ensure required imports are present.";
  }
  if (text.includes("expected ';'")) {
    return "Add the missing semicolon near the reported line.";
  }
  if (text.includes("syntaxerror")) {
    return "Fix the syntax near the shown line (missing bracket, quote, or punctuation).";
  }
  if (text.includes("indentationerror")) {
    return "Fix indentation to use a consistent block structure in Python.";
  }
  if (text.includes("nameerror")) {
    return "A variable or function name is undefined. Define it first or correct its spelling.";
  }
  if (
    text.includes("indexerror") ||
    text.includes("index out of range") ||
    text.includes("arrayindexoutofboundsexception") ||
    text.includes("stringindexoutofboundsexception")
  ) {
    return "An index is outside valid bounds. Check loop limits and array/string lengths before access.";
  }
  if (text.includes("nullpointerexception")) {
    return "A value is null before use. Initialize it or add null checks before accessing methods/fields.";
  }
  if (text.includes("zerodivisionerror") || text.includes("/ by zero")) {
    return "Guard against division by zero before performing division.";
  }
  if (text.includes("segmentation fault")) {
    return "Check pointer usage, array bounds, and memory access in C/C++.";
  }
  if (normalizedStatus === "time_limit_exceeded") {
    return "Your program took too long. Optimize loops/recursion and avoid unnecessary repeated computation.";
  }
  if (normalizedStatus === "memory_limit_exceeded") {
    return "Your program exceeded memory limits. Reduce large allocations and release unused data structures.";
  }

  if (normalizedStatus === "compile_error") {
    if (normalizedLanguage === "python") {
      return "Fix the syntax issue shown above and run again.";
    }
    return "Fix the compile errors listed above, then run again.";
  }

  return "Check the failing line and edge cases, then run again.";
};

const formatStudentError = ({
  status,
  language,
  stderr,
}: StudentErrorFormatInput) => {
  const cleaned = normalizeRunnerErrorText(stderr);
  if (!cleaned) return null;

  const title = getErrorTitle(status, language);
  const summary = extractPrimaryErrorLine(cleaned);
  const location = extractLocationLine(cleaned);
  const hint = inferFixHint(cleaned, status, language);

  const detailLines = cleaned
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .slice(0, 14);

  const blocks: string[] = [title, "", `What failed:\n${summary}`];

  if (location && location !== summary) {
    blocks.push("", `Where:\n${location}`);
  }

  if (hint) {
    blocks.push("", `How to fix:\n${hint}`);
  }

  if (detailLines.length > 1) {
    blocks.push("", `Details:\n${detailLines.join("\n")}`);
  }

  return blocks.join("\n").trim();
};

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

    const requestedLevel =
      typeof level === "string" ? level.trim().toLowerCase() : "";
    const normalizedUserTestCases = Array.isArray(userTestCases)
      ? userTestCases
          .filter((tc: any) => tc && typeof tc === "object")
          .map((tc: any) => ({
            ...tc,
            // Empty stdin is valid for many problems; do not drop it.
            input: String(tc?.input ?? ""),
          }))
      : [];
    const shouldUseCustomTestCases =
      mode === "run" &&
      useCustomTestCases &&
      normalizedUserTestCases.length > 0;

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

    const [examResult, levelsResult] = await Promise.all([
      (supabase
        .from("exams")
        .select("end_time")
        .eq("practical_id", pid)
        .maybeSingle()) as any,
      requestedLevel
        ? (supabase
            .from("practical_levels")
            .select("id, level, max_marks")
            .eq("practical_id", pid))
        : Promise.resolve({ data: [], error: null }),
    ]);

    const examData = examResult?.data;
    const practicalLevels: any[] = (levelsResult?.data as any[]) || [];

    if (levelsResult?.error) {
      console.error("Failed to fetch practical levels:", levelsResult.error);
      return NextResponse.json(
        { error: "Failed to fetch practical levels" },
        { status: 500 },
      );
    }

    if (spRecord.is_locked) {
      // For multi-level practicals, skip the lock check when running a specific level.
      // The lock may have been set by a sibling task passing in the same submission batch.
      let skipLock = false;
      if (requestedLevel && practicalLevels.length > 0) {
        skipLock = true;
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
    let levelId: number | null = null;

    if (requestedLevel) {
      const levelData = practicalLevels.find(
        (lvl: any) =>
          String(lvl?.level || "").trim().toLowerCase() === requestedLevel,
      );

      if (levelData) {
        levelId = Number(levelData.id);
        maxMarks = Number(levelData.max_marks || 10);
      } else if (practicalLevels.length > 0) {
        if (mode === "submit") {
          return NextResponse.json(
            { error: `Invalid level '${level}' for this practical` },
            { status: 400 },
          );
        }

        // In run mode, be forgiving: fallback to first level to prevent transient UI race failures.
        levelId = Number(practicalLevels[0].id);
        maxMarks = Number(practicalLevels[0].max_marks || 10);
      }
    }

    const shouldFetchDbTestCases = mode === "submit" || !shouldUseCustomTestCases;
    let dbTestCases: any[] = [];

    if (shouldFetchDbTestCases) {
      // Fetch only fields used by runner payload/response mapping.
      let query = supabase
        .from("test_cases")
        .select(
          "id, input, expected_output, is_hidden, time_limit_ms, memory_limit_kb, level_id",
        )
        .eq("practical_id", pid)
        .order("id", { ascending: true });

      // If no resolved level exists, fetch non-leveled test cases by default.
      if (levelId !== null) {
        query = query.eq("level_id", levelId);
      } else {
        query = query.is("level_id", null);
      }

      const { data: dbTestCasesData, error: tcErr } = await query;

      if (tcErr) {
        console.error("Failed to fetch test cases:", tcErr);
        return NextResponse.json(
          { error: "Failed to fetch test cases" },
          { status: 500 },
        );
      }

      dbTestCases = dbTestCasesData || [];
    }

    // Fetch reference code only when it is required to derive expected outputs
    // for custom user-provided test cases.
    let referenceCode = "";
    let referenceLang = "";

    if (shouldUseCustomTestCases) {
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
        console.warn(
          "[Run API] Admin reference fetch failed, using regular client:",
          refErr,
        );

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
      referenceCode = ref?.code ?? "";
      referenceLang = (ref?.language ?? "").toLowerCase();

      console.log(`[Debug] PracticalID: ${pid}, Lang: ${lang}`);
      console.log(
        `[Debug] Reference Code Found: ${!!referenceCode}, RefLang: ${referenceLang}`,
      );
    }

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
      const normalizedError = normalizeRunnerErrorText(message);
      const formattedError =
        formatStudentError({
          status: "runtime_error",
          language: reqLangNorm,
          stderr: normalizedError,
        }) || normalizedError || message;

      const results = (currentBatch || []).map((b: any) => ({
        test_case_id: b?.id ?? 0,
        status: "runtime_error",
        input: b?.stdinInput ?? "",
        expected: b?.expectedOutput ?? "",
        stdout: "",
        stderr: normalizedError || null,
        error: formattedError,
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
        executionError: formattedError,
        mode: currentMode,
      });
    };

    // Prepare batch based on toggle and mode
    let batch: any[] = [];
    let usedTestCaseSource: "user" | "db" | "none" = "none";

    if (mode === "run") {
      if (shouldUseCustomTestCases) {
        // Build user batch (ids prefixed with user-)
        const userBatch = normalizedUserTestCases.map((utc: any, idx: number) => ({
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

    if (batch.length === 0 && mode === "run") {
      // Fallback so users can still run code even when no DB testcases are configured.
      batch = [
        {
          id: "user-1",
          stdinInput: "",
          expectedOutput: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: reqLangNorm === "java" ? 262144 : 65536,
        },
      ];
      usedTestCaseSource = "user";
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
        failFast: false,
        lang: reqLangNorm || lang,
        batch,
      });
    } catch (e: any) {
      console.error("Runner error:", e);
      const runnerMessage = String(e?.message || "Runner failed").slice(0, 1200);
      return buildRunnerFailure(runnerMessage, batch, mode, usedTestCaseSource);
    }

    const details = runnerResults.details ?? [];

    const ANSI_ESCAPE_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "g");

    const sanitizeOutputText = (s: any) =>
      String(s ?? "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\u00A0/g, " ")
        .replace(/\0/g, "")
        .replace(ANSI_ESCAPE_REGEX, "")
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

      const rawStderr = normalizeRunnerErrorText(d.stderr || "");
      const shouldShowErrorBlock =
        status === "compile_error" ||
        status === "runtime_error" ||
        status === "time_limit_exceeded" ||
        status === "memory_limit_exceeded" ||
        status === "output_limit_exceeded";
      const formattedError = shouldShowErrorBlock
        ? formatStudentError({
            status,
            language: reqLangNorm,
            stderr: rawStderr,
          })
        : null;

      return {
        test_case_id: d.test_case_id,
        status,
        input,
        expected,
        stdout,
        stderr: rawStderr || null,
        error: formattedError || rawStderr || null,
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

"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/CodeEditor";
import useProctoring from "@/hooks/useProctoring";
import { ModeToggle } from "@/components/ModeToggle";
import { generatePdfClient } from "@/lib/ClientPdf";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { motion } from "framer-motion";

type TestCaseResult = {
  test_case_id: number;
  input: string;
  expected: string;
  stdout: string;
  error: string | null;
  status: "passed" | "failed" | "timeout" | "runtime_error" | "compile_error";
  time_ms?: number | null;
  memory_kb?: number | null;
  is_hidden?: boolean;
};

type UserTestCase = {
  id: number;
  input: string;
  time_limit_ms: number;
  memory_limit_kb: number;
  expectedOutput: string;
};

// ---------------------------
// Parse freeform description into contest-like sections
// (unchanged)
function parseDescriptionToSections(raw: string | undefined) {
  if (!raw) {
    return { sections: [{ title: "Problem Statement", body: "No description available." }] };
  }

  const text = raw.replace(/\r\n/g, "\n").trim();

  const headings = [
    "Problem Statement",
    "Description",
    "Input",
    "Input Format",
    "Output",
    "Output Format",
    "Constraints",
    "Notes",
    "Sample Input",
    "Sample Output",
    "Example",
    "Explanation",
    "Approach",
  ];

  const lines = text.split("\n");
  const indices: Array<{ idx: number; label: string }> = [];
  const headingRegex = new RegExp(`^\\s*(${headings.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[:\\-]?\\s*$`, "i");

  lines.forEach((ln, i) => {
    const m = ln.match(headingRegex);
    if (m) indices.push({ idx: i, label: m[1] });
  });

  if (indices.length > 0) {
    const sections: Array<{ title: string; body: string }> = [];
    for (let i = 0; i < indices.length; i++) {
      const start = indices[i].idx + 1;
      const end = i + 1 < indices.length ? indices[i + 1].idx : lines.length;
      const body = lines.slice(start, end).join("\n").trim();
      sections.push({ title: indices[i].label, body: body || "—" });
    }
    return { sections };
  }

  const keywordSplit = /(Input(?:\s*Format)?|Output(?:\s*Format)?|Constraints|Sample Input|Sample Output|Explanation)/i;
  if (keywordSplit.test(text)) {
    const parts = text.split(/(Input(?:\s*Format)?|Output(?:\s*Format)?|Constraints|Sample Input|Sample Output|Explanation)/i)
      .map(p => p.trim())
      .filter(Boolean);

    const sections: Array<{ title: string; body: string }> = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (keywordSplit.test(part) && i + 1 < parts.length) {
        sections.push({ title: part.replace(/:$/, ""), body: parts[i + 1] });
        i++;
      } else if (!keywordSplit.test(part)) {
        sections.push({ title: "Problem Statement", body: part });
      }
    }
    return { sections };
  }

  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paras.length === 1) return { sections: [{ title: "Problem Statement", body: paras[0] }] };

  const sections = [{ title: "Problem Statement", body: paras[0] }];
  if (paras.length > 1) sections.push({ title: "Notes / Examples", body: paras.slice(1).join("\n\n") });
  return { sections };
}

// ---------------------------
// Small helper to extract example blocks (Sample Input / Output + Explanation)
// (unchanged)
function extractExamplesFromText(text?: string) {
  if (!text) return [];
  const parts = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const examples: Array<{ title: string; input?: string; output?: string; explanation?: string; raw?: string }> = [];

  for (const p of parts) {
    const inputMatch = p.match(/Input\s*[:\-]?\s*(?:s\s*=\s*)?["']?([^"\n]+?)["']?(?:\n|$)/i);
    const outputMatch = p.match(/Output\s*[:\-]?\s*["']?([^"\n]+?)["']?(?:\n|$)/i);
    const explMatch = p.match(/Explanation\s*[:\-]?\s*([\s\S]+)/i);

    if (inputMatch || outputMatch || /^(Example|Example \d+)/i.test(p)) {
      examples.push({
        title: "Example",
        input: inputMatch ? inputMatch[1].trim() : undefined,
        output: outputMatch ? outputMatch[1].trim() : undefined,
        explanation: explMatch ? explMatch[1].trim() : undefined,
        raw: p,
      });
      continue;
    }

    const lines = p.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines.some(l => /Input|Output|Sample/i.test(l))) {
      const inL = lines.find(l => /Input/i);
      const outL = lines.find(l => /Output/i);
      examples.push({
        title: "Example",
        input: inL ? inL.replace(/Input\s*[:\-]?\s*/i, "") : undefined,
        output: outL ? outL.replace(/Output\s*[:\-]?\s*/i, "") : undefined,
        explanation: undefined,
        raw: p,
      });
      continue;
    }
  }

  return examples;
}

export default function EditorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);

  const practicalId = searchParams?.get("practicalId");
  const languageFromUrl = searchParams?.get("language")?.toLowerCase() || "java";
  const hasLevelsParam = searchParams?.get("hasLevels") === "true";

  // Starter templates for each language
  const starterTemplates: Record<string, string> = {
    java: `public class Main {
    public static void main(String[] args) {
        java.util.Scanner sc = new java.util.Scanner(System.in);
        // Read input and process
        while (sc.hasNext()) {
            System.out.println(sc.next());
        }
        sc.close();
    }
}`,
    python: `# Read input and process
import sys

for line in sys.stdin:
    print(line.strip())
`,
    c: `#include <stdio.h>

int main() {
    char buffer[1024];
    // Read input and process
    while (fgets(buffer, sizeof(buffer), stdin) != NULL) {
        printf("%s", buffer);
    }
    return 0;
}
`,
    cpp: `#include <iostream>
#include <string>
using namespace std;

int main() {
    string line;
    // Read input and process
    while (getline(cin, line)) {
        cout << line << endl;
    }
    return 0;
}
`,
    javascript: `// Read input and process
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.on('line', (line) => {
    console.log(line);
});
`,
  };

  // Get starter code for the selected language
  const getStarterCode = (language: string) => {
    return starterTemplates[language.toLowerCase()] || starterTemplates.java;
  };

  // Use language from URL if provided, otherwise default to java
  const [lang, setLang] = useState(languageFromUrl);
  const [code, setCode] = useState(getStarterCode(languageFromUrl));
  const [loading, setLoading] = useState(false);
  const { violations, locked } = useProctoring(3);
  const [practical, setPractical] = useState<any>(null);
  const [showUserTestCases, setShowUserTestCases] = useState(false);

  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  // Roll Number State
  const [rollNo, setRollNo] = useState<string | null>(null);

  const [testCaseResults, setTestCaseResults] = useState<TestCaseResult[]>([]);
  const [scoreSummary, setScoreSummary] = useState<{ passed: number; total: number }>({ passed: 0, total: 0 });
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "pending" | "evaluated" | "submitted">("idle");
  // userTestCases now include expectedOutput field by default (keeps parity with server)
  const [userTestCases, setUserTestCases] = useState<UserTestCase[]>([{ id: 1, input: "", time_limit_ms: 2000, memory_limit_kb: 65536, expectedOutput: "" }]);

  // NEW: examples from test_cases table
  const [examplesFromDB, setExamplesFromDB] = useState<Array<{ input: string; output: string }>>([]);

  // Multi-level practical support
  const [practicalLevels, setPracticalLevels] = useState<Array<{ id: number; level: string; title: string; description: string; max_marks: number }>>([]);
  const [activeLevel, setActiveLevel] = useState<string>("easy");

  // expanded state for LeetCode-style test case cards
  const [expandedCases, setExpandedCases] = useState<Record<number, boolean>>({});

  // ========================
  // Auth
  // ========================
  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        router.push("/auth/login");
        return;
      }
      if (mountedRef.current) {
        setUser(data.user);
        // Fetch roll number if student
        const { data: studentData } = await supabase
          .from("student_details")
          .select("roll_no")
          .eq("student_id", data.user.id)
          .single();
        if (studentData?.roll_no) {
          setRollNo(studentData.roll_no);
        }
      }
    };
    fetchUser();
    return () => { mountedRef.current = false; };
  }, [router, supabase]);

  // ========================
  // Fetch practical
  // ========================
  useEffect(() => {
    if (!practicalId) return;
    const fetchPractical = async () => {
      const { data, error } = await supabase
        .from("practicals")
        .select("*, subjects(subject_name)")
        .eq("id", practicalId)
        .single();

      if (!error && mountedRef.current) {
        setPractical({
          ...data,
          subject_name: data.subjects?.subject_name || "Unknown",
        });
      }

      // Fetch levels if this is a multi-level practical
      if (hasLevelsParam) {
        const { data: levelsData, error: levelsError } = await supabase
          .from("practical_levels")
          .select("*")
          .eq("practical_id", Number(practicalId))
          .order("id", { ascending: true });

        if (!levelsError && levelsData && mountedRef.current) {
          const sorted = levelsData.sort((a, b) => {
            const order: Record<string, number> = { easy: 0, medium: 1, hard: 2 };
            return (order[a.level] || 0) - (order[b.level] || 0);
          });
          setPracticalLevels(sorted);
          if (sorted.length > 0) {
            setActiveLevel(sorted[0].level);
          }
        }
      }
    };
    fetchPractical();
  }, [practicalId, supabase, hasLevelsParam]);

  // ========================
  // Fetch examples (test_cases) from DB for this practical
  // ========================
  useEffect(() => {
    if (!practicalId) {
      setExamplesFromDB([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("test_cases")
          .select("input, expected_output")
          .eq("practical_id", Number(practicalId))
          .order("id", { ascending: true })
          .limit(10);

        if (error) {
          console.error("Failed to fetch test_cases:", error);
          setExamplesFromDB([]);
          return;
        }
        if (!cancelled) {
          const mapped = (data || []).map((r: any) => ({
            input: r.input ?? "",
            output: r.expected_output ?? "",
          }));
          setExamplesFromDB(mapped);
        }
      } catch (e) {
        console.error("Error fetching test cases:", e);
        if (!cancelled) setExamplesFromDB([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [practicalId, supabase]);

  // ========================
  // Sign out
  // ========================
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const runCode = async () => {
    if (!code || !practicalId) return;

    setLoading(true);
    setTestCaseResults([]);
    try {
      const customCases = userTestCases.filter(tc => tc.input.trim() !== "");

      const payload: any = {
        code,
        lang,
        practicalId,
        mode: "run",
        level: activeLevel,
        // Tell server explicitly whether we want to run custom cases
        useCustomTestCases: customCases.length > 0,
        userTestCases: customCases.map((tc, idx) => ({
          // server expects `input` / `stdinInput` on batch creation
          input: tc.input,
          // optional: allow per-case limits; keep defaults if not provided
          time_limit_ms: tc.time_limit_ms ?? 2000,
          memory_limit_kb: tc.memory_limit_kb ?? 65536,
          // we don't have an expected output UI field for user cases — leave expectedOutput blank
          expectedOutput: tc.expectedOutput ?? "",
        })),
      };

      const res = await axios.post("/api/run", payload);
      const normalizeStr = (s: any) => (s === null || s === undefined ? "" : String(s));

      const results: TestCaseResult[] = (res.data.results || []).map((r: any) => ({
        test_case_id: r.test_case_id ?? 0,
        input: r.input ?? r.stdinInput ?? r.expected ?? "",
        expected: normalizeStr(r.expected ?? r.expected_output),
        stdout: normalizeStr(r.stdout),
        error: r.error ?? null,
        status: r.status ?? "failed",
        time_ms: r.time_ms ?? null,
        memory_kb: r.memory_kb ?? null,
        is_hidden: r.is_hidden ?? false,
      }));

      setTestCaseResults(results);
      setShowUserTestCases(false); // ← Add this line to switch to results tab
      console.log("Run results:", results);
    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error running code.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!code || !practicalId || !user) return;

    setLoading(true);
    try {
      const submissionRes = await axios.post("/api/submission/create", {
        student_id: user.id,
        practical_id: Number(practicalId),
        code,
        language: lang,
        status: "pending",
        marks_obtained: 0,
        test_cases_passed: "0/0"
      });

      const submission = submissionRes.data.submission;
      if (!submission?.id) throw new Error("Failed to create submission");

      const runRes = await axios.post("/api/run", {
        code,
        lang,
        practicalId,
        submissionId: submission.id,
        mode: "submit",
        level: activeLevel,
      });

      const verdict = runRes.data.verdict || "pending";
      const marksObtained = runRes.data.marksObtained ?? 0;
      const passedTestCases = runRes.data.passedTestCases ?? 0;
      const totalTestCases = runRes.data.totalTestCases ?? 0;

      // Map verdict to UI state
      let uiStatus: "idle" | "pending" | "evaluated" | "submitted" = "evaluated";
      if (verdict === "passed" || verdict === "failed") {
        uiStatus = "evaluated"; // Or maybe "graded"? Keeping "evaluated" for now or switch to match DB
      } else if (verdict === "pending") {
        uiStatus = "pending";
      }

      setSubmissionStatus(uiStatus);
      const statusText = verdict === "passed" ? "Passed" : verdict === "failed" ? "Failed" : "Pending";
      alert(`Practical submitted successfully! Status: ${statusText}. Marks: ${marksObtained} / 10 (${passedTestCases}/${totalTestCases} test cases passed)`);
      router.push('/student/submissions');

    } catch (err: any) {
      console.error(err);
      alert(err?.response?.data?.error || "Error submitting practical. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      await generatePdfClient({
        studentName: user?.email || "Anonymous",
        rollNumber: rollNo || "N/A",
        practicalTitle: practical?.title || "Practical Submission",
        code,
        language: lang,
        submissionDate: new Date().toLocaleString(),
        status: "N/A", // This is just a download of current code, not a submission result
        output: testCaseResults.map((r) => `${r.status.toUpperCase()}: ${r.stdout}`).join("\n\n"),
        filename: practical?.title?.replace(/\s+/g, "_") || "code_output.pdf",
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (!user) return <div className="flex items-center justify-center h-screen text-gray-500">Loading...</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "text-green-500";
      case "failed": return "text-red-500";
      case "timeout": return "text-orange-400";
      case "runtime_error": return "text-yellow-400";
      case "compile_error": return "text-gray-400";
      default: return "text-gray-400";
    }
  };

  // Structured sections from practical.description
  const { sections } = parseDescriptionToSections(practical?.description);
  const extractedExamples = extractExamplesFromText(practical?.description || sections.map(s => s.body).join("\n\n"));
  // Attempt to gather constraints
  const constraintSection = sections.find(s => /constraint/i.test(s.title)) || sections.find(s => /constraint/i.test(s.body));
  const problemStmt = sections.find(s => /problem/i.test(s.title))?.body || sections[0]?.body || practical?.description || "No description available.";

  // LeetCode-style summary numbers
  const passedCount = testCaseResults.filter(t => t.status === "passed").length;
  const totalCount = testCaseResults.length;
  const passPercent = totalCount ? Math.round((passedCount / totalCount) * 100) : 0;

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-100 via-white/30 to-gray-200 dark:from-gray-900 dark:via-gray-800/40 dark:to-gray-900 backdrop-blur-sm">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-gray-300 dark:border-gray-700 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 shadow-sm">
        <h1
          role="heading"
          aria-level={1}
          className="select-none text-1xl md:text-2xl lg:text-3xl font-extrabold tracking-tight
             bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
             animate-gradient-x drop-shadow-sm"
          style={{ WebkitFontSmoothing: 'antialiased' }}
        >
          CodeGuard
        </h1>

        <div className="flex items-center gap-4">
          {locked && (
            <div className="px-3 py-1 text-sm bg-red-200/30 text-red-600 rounded-full backdrop-blur-sm">
              Session Locked
            </div>
          )}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Violations: {" "}
            <span className="font-semibold text-red-600 dark:text-red-400">
              {violations}/3
            </span>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
          <ModeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full gap-4">
          {/* LEFT: LeetCode-style Problem Panel */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full p-6 overflow-auto bg-white dark:bg-gray-900 rounded-2xl shadow-inner border border-gray-200 dark:border-gray-700">
              {/* Title large */}
              <h1 className="text-2xl font-extrabold text-gray-900 dark:text-gray-50 mb-3">
                {practical?.title || "Problem Title"}
              </h1>

              {/* Level Selector Tabs (for multi-level practicals) */}
              {hasLevelsParam && practicalLevels.length > 0 && (
                <div className="flex gap-2 mb-4">
                  {practicalLevels.map((level) => {
                    const colors: Record<string, { active: string; inactive: string }> = {
                      easy: { active: 'bg-emerald-500 text-white', inactive: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' },
                      medium: { active: 'bg-amber-500 text-white', inactive: 'bg-amber-100 text-amber-700 hover:bg-amber-200' },
                      hard: { active: 'bg-red-500 text-white', inactive: 'bg-red-100 text-red-700 hover:bg-red-200' },
                    };
                    const color = colors[level.level] || colors.easy;
                    const isActive = activeLevel === level.level;
                    return (
                      <button
                        key={level.id}
                        onClick={() => setActiveLevel(level.level)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isActive ? color.active : color.inactive}`}
                      >
                        {level.level.charAt(0).toUpperCase() + level.level.slice(1)}
                        <span className="ml-1 opacity-75">({level.max_marks}pts)</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Badges / meta row */}
              <div className="flex items-center gap-2 mb-4">
                <div className="text-xs font-semibold px-2 py-1 rounded-md bg-yellow-100 text-yellow-800">
                  {hasLevelsParam ? activeLevel.charAt(0).toUpperCase() + activeLevel.slice(1) : 'Medium'}
                </div>
                <div className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700">{lang || 'Java'}</div>
              </div>

              {/* Problem statement paragraph */}
              <div className="text-gray-700 dark:text-gray-300 leading-relaxed mb-6 whitespace-pre-wrap">
                {hasLevelsParam && practicalLevels.length > 0
                  ? practicalLevels.find(l => l.level === activeLevel)?.description || problemStmt
                  : problemStmt}
              </div>

              {/* Examples */}
              <div className="space-y-6">
                {examplesFromDB && examplesFromDB.length > 0 ? (
                  examplesFromDB.map((ex, idx) => (
                    <div key={idx}>
                      <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Example {idx + 1}</div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Input:</div>
                          <pre className="bg-gray-100 dark:bg-gray-800 text-sm font-mono p-3 rounded whitespace-pre-wrap">{ex.input}</pre>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Output:</div>
                          <pre className="bg-gray-100 dark:bg-gray-800 text-sm font-mono p-3 rounded whitespace-pre-wrap">{ex.output}</pre>
                        </div>
                      </div>
                    </div>
                  ))
                ) : extractedExamples && extractedExamples.length > 0 ? (
                  extractedExamples.map((ex, idx) => (
                    <div key={idx}>
                      <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Example {idx + 1}</div>
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Input:</div>
                          <pre className="bg-gray-100 dark:bg-gray-800 text-sm font-mono p-3 rounded whitespace-pre-wrap">{ex.input ?? ex.raw ?? "—"}</pre>
                        </div>
                        <div className="flex-1">
                          <div className="text-xs text-gray-500 mb-1">Output:</div>
                          <pre className="bg-gray-100 dark:bg-gray-800 text-sm font-mono p-3 rounded whitespace-pre-wrap">{ex.output ?? "—"}</pre>
                        </div>
                      </div>
                      {ex.explanation && (
                        <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                          <strong>Explanation:</strong> {ex.explanation}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No examples available.</div>
                )}
              </div>

              {/* Constraints */}
              <div className="mt-6">
                <div className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Constraints:</div>
                {constraintSection ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{constraintSection.body}</div>
                ) : (
                  <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400">
                    <li>Input length and ranges will be reasonable for Java programs.</li>
                    <li>Use efficient algorithms for large inputs (if required).</li>
                    <li>Mind stack/heap usage — large recursion may cause StackOverflowError in Java.</li>
                  </ul>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

          {/* RIGHT: Code Editor + Bottom Section */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full gap-3 rounded-2xl overflow-hidden">
              {/* Code Editor */}
              <ResizablePanel defaultSize={65} minSize={30}>
                <div className="h-full">
                  <CodeEditor
                    code={code}
                    setCode={setCode}
                    disabled={locked}
                    onSubmit={handleSubmit}
                    onRun={runCode}
                    onDownload={downloadPdf}
                    loading={loading}
                    locked={locked}
                    lang={lang}
                    onLangChange={setLang}
                    showInputToggle={false}
                    showInput={false}
                    setShowInput={() => { }}
                    terminalRef={null}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

              {/* Bottom Section - Tabs like LeetCode */}
              <ResizablePanel defaultSize={35} minSize={20}>
                <div className="h-full flex flex-col bg-white/10 dark:bg-gray-900/30 backdrop-blur-md rounded-xl border border-gray-300 dark:border-gray-700">

                  {/* Tab Headers */}
                  <div className="flex-shrink-0 flex border-b border-gray-300 dark:border-gray-700">
                    <button
                      onClick={() => setShowUserTestCases(false)}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${!showUserTestCases
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                      Testcase Result
                    </button>
                    <button
                      onClick={() => setShowUserTestCases(true)}
                      className={`px-4 py-3 text-sm font-medium transition-colors ${showUserTestCases
                        ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                      Test Cases
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-auto">

                    {/* Test Case Results Tab */}
                    {!showUserTestCases && (
                      <div className="h-full p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{passedCount} passed • {totalCount} total</div>
                          </div>

                          {/* Progress bar */}
                          <div className="w-56">
                            <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                              <div className="h-2 rounded-full transition-all" style={{ width: `${passPercent}%`, backgroundColor: passPercent === 100 ? '#16a34a' : '#6366f1' }} />
                            </div>
                            <div className="text-xs text-right text-gray-500 mt-1">{passPercent}%</div>
                          </div>
                        </div>

                        {testCaseResults.length === 0 && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">Run your code to see results here.</div>
                        )}

                        {testCaseResults.map((r, idx) => {
                          const isExpanded = !!expandedCases[idx];
                          const leftBorderClass = r.status === 'passed' ? 'border-l-4 border-green-500' : r.status === 'failed' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-400';

                          return (
                            <div key={idx} className={`mb-4 rounded-lg p-0 overflow-hidden shadow-sm ${leftBorderClass} bg-white/30 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700`}>
                              <div className="flex items-center justify-between p-3 cursor-pointer" onClick={() => setExpandedCases(prev => ({ ...prev, [idx]: !prev[idx] }))}>
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 flex items-center justify-center rounded-full bg-white/60 dark:bg-black/40 ${r.status === 'passed' ? 'text-green-600' : r.status === 'failed' ? 'text-red-600' : 'text-yellow-600'} font-semibold`}>{idx + 1}</div>
                                  <div>
                                    <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Case {idx + 1} {r.is_hidden ? <span className="text-xs text-gray-500">(hidden)</span> : null}</div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <div className={`text-sm font-semibold ${r.status === 'passed' ? 'text-green-600' : r.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}`}>{r.status.toUpperCase()}</div>
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">Input</div>
                                      <pre className="bg-white dark:bg-gray-800 p-3 rounded text-sm font-mono whitespace-pre-wrap">{r.input}</pre>
                                    </div>
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">Expected</div>
                                      <pre className="bg-white dark:bg-gray-800 p-3 rounded text-sm font-mono whitespace-pre-wrap">{r.expected || '—'}</pre>
                                    </div>
                                  </div>

                                  <div className="mt-3">
                                    <div className="text-xs text-gray-500 mb-1">Output</div>
                                    <pre className="bg-white dark:bg-gray-800 p-3 rounded text-sm font-mono whitespace-pre-wrap">{r.stdout}</pre>

                                    {r.error && (
                                      <div className="mt-2 text-sm text-red-500">
                                        <strong>Error:</strong> {r.error}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Custom Test Cases Tab */}
                    {showUserTestCases && (
                      <div className="h-full flex flex-col bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-900/50 dark:to-gray-800/50">
                        {/* Fixed Header */}
                        <div className="flex-shrink-0 p-4 border-b border-blue-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">Add your own test inputs</p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setUserTestCases([...userTestCases, { id: userTestCases.length + 1, input: "", time_limit_ms: 2000, memory_limit_kb: 65536, expectedOutput: "" }])
                              }
                              className="bg-blue-500 hover:bg-blue-600 text-white border-0 shadow-md hover:shadow-lg transition-all"
                            >
                              <span className="text-lg mr-1">+</span> Add Case
                            </Button>
                          </div>
                        </div>

                        {/* Scrollable Test Cases */}
                        <div className="flex-1 overflow-auto p-4">
                          <div className="space-y-3">
                            {userTestCases.map((tc, idx) => (
                              <div
                                key={idx}
                                className="group relative p-4 bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                              >
                                <div className="flex justify-between items-center mb-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-sm">
                                      {idx + 1}
                                    </div>
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">Case {idx + 1}</span>
                                  </div>
                                  {userTestCases.length > 1 && (
                                    <button
                                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-3 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                                      onClick={() =>
                                        setUserTestCases(userTestCases.filter((_, i) => i !== idx))
                                      }
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>

                                <label className="block text-xs font-bold mb-2 text-gray-600 dark:text-gray-400 uppercase tracking-wide">Input</label>
                                <textarea
                                  className="w-full p-3 rounded-md border-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-800 dark:text-gray-200 font-mono focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-900/50 outline-none transition-all resize-none"
                                  rows={3}
                                  placeholder="Enter test input..."
                                  value={tc.input}
                                  onChange={(e) => {
                                    const newCases = [...userTestCases];
                                    newCases[idx].input = e.target.value;
                                    setUserTestCases(newCases);
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </ResizablePanel>

            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
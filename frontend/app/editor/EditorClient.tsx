"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/editor/CodeEditor";
import useProctoring from "@/hooks/useProctoring";
import { useSessionValidator } from "@/hooks/useSessionValidator";
import { ModeToggle } from "@/components/layout/ModeToggle";
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
    const inputMatch = p.match(/Input\s*[:-]?\s*(?:s\s*=\s*)?["']?([^"\n]+?)["']?(?:\n|$)/i);
    const outputMatch = p.match(/Output\s*[:-]?\s*["']?([^"\n]+?)["']?(?:\n|$)/i);
    const explMatch = p.match(/Explanation\s*[:-]?\s*([\s\S]+)/i);

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
        input: inL ? inL.replace(/Input\s*[:-]?\s*/i, "") : undefined,
        output: outL ? outL.replace(/Output\s*[:-]?\s*/i, "") : undefined,
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
    System.out.println("Hello World");
  }
}`,

    python: `print("Hello World")`,

    c: `#include <stdio.h>
int main() {
  printf("Hello World");
  return 0;
}`,

    cpp: `#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    cout << "Hello World";
    return 0;
}`,

    javascript: `console.log("Hello World")`
  };

  // Get starter code for the selected language
  const getStarterCode = (language: string) => {
    return starterTemplates[language.toLowerCase()] || starterTemplates.java;
  };

  // Use language from URL if provided, otherwise default to java
  const [lang, setLang] = useState(languageFromUrl);
  const [code, setCode] = useState(getStarterCode(languageFromUrl));
  const [loading, setLoading] = useState(false);

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
  // Session Validation (Single Active Session)
  // ========================
  const autoSubmitOnInvalidation = async () => {
    // Auto-submit current code when session is invalidated
    if (code && practicalId && user) {
      try {
        await axios.post("/api/submission/create", {
          student_id: user.id,
          practical_id: Number(practicalId),
          code,
          language: lang,
          status: "pending",
          marks_obtained: 0,
          test_cases_passed: "0/0"
        });
        console.log("Code auto-submitted due to session invalidation");
      } catch (err) {
        console.error("Auto-submit failed:", err);
      }
    }
  };

  const { showInvalidModal, registerSession, dismissModal } = useSessionValidator({
    onSessionInvalidated: autoSubmitOnInvalidation,
    enabled: !!user,
    userId: user?.id || null,
  });

  // ========================
  // Session Lock & One-Time Entry Logic
  // ========================
  const [isSessionLocked, setIsSessionLocked] = useState(false);
  const [lockReason, setLockReason] = useState<string | null>(null);

  // Restored State & Proctoring Logic
  const [isFullscreenMode, setIsFullscreenMode] = useState(false);
  const [hasExamStarted, setHasExamStarted] = useState(false);

  // Proctoring Hook (Only active after exam starts)
  const { violations, locked } = useProctoring({ active: hasExamStarted, maxViolations: 3 });

  // Auto-submit on Proctoring Lock
  const hasLockSubmittedRef = useRef(false);
  useEffect(() => {
    if (locked && !hasLockSubmittedRef.current && hasExamStarted) {
      console.warn("Proctoring Limit Reached: Auto-submitting code...");
      hasLockSubmittedRef.current = true;
      // Auto-submit and then redirect to dashboard
      autoSubmitOnInvalidation().finally(() => {
        router.push("/student/submissions");
      });
    }
  }, [locked, hasExamStarted, autoSubmitOnInvalidation, router]);

  // Check lock status on mount (Prevents Refresh/Re-entry)
  useEffect(() => {
    const checkLockStatus = async () => {
      if (!user || !practicalId) return;

      const { data, error } = await supabase
        .from('student_practicals')
        .select('attempt_count, max_attempts, is_locked, lock_reason')
        .eq('student_id', user.id)
        .eq('practical_id', Number(practicalId))
        .single();

      if (data) {
        // Check strict lock
        if (data.is_locked) {
          setIsSessionLocked(true);
          setLockReason(data.lock_reason || "Session locked by faculty.");
          return;
        }

        // Check attempt limit (Refresh Protection)
        const attempts = data.attempt_count || 0;
        const max = data.max_attempts || 1;

        if (attempts >= max) {
          setIsSessionLocked(true);
          setLockReason("You have already used your attempt. Refreshing is not allowed.");
        }
      }
    };

    checkLockStatus();
  }, [user, practicalId, supabase]);

  // Handle Start Exam (One-Time Action)
  const handleStartExam = async () => {
    try {
      setLoading(true);
      const res = await axios.post('/api/practical/start', { practicalId });

      if (res.data.success) {
        await enterFullscreen();
      } else {
        setIsSessionLocked(true);
        setLockReason(res.data.error || "Failed to start exam.");
      }
    } catch (err: any) {
      console.error("Start exam error:", err);
      // If error status is 403, it means locked
      if (err.response && err.response.status === 403) {
        setIsSessionLocked(true);
        setLockReason(err.response.data.error);
      }
    } finally {
      setLoading(false);
    }
  };

  // Toggle fullscreen
  const enterFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setHasExamStarted(true);
    }
  };

  // Monitor fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreenMode(!!document.fullscreenElement);
      // If we are getting into fullscreen, mark exam as started
      if (document.fullscreenElement) {
        setHasExamStarted(true);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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
        // Register session for single active session enforcement
        registerSession(data.user.id);
        // Fetch roll number if student
        const { data: userData } = await supabase
          .from("users")
          .select("roll_no")
          .eq("uid", data.user.id)
          .single();
        if (userData?.roll_no) {
          setRollNo(userData.roll_no);
        }
      }
    };
    fetchUser();
    return () => { mountedRef.current = false; };
  }, [router, supabase, registerSession]);

  // ========================
  // Fetch practical
  // ========================
  useEffect(() => {
    if (!practicalId) return;
    const fetchPractical = async () => {
      const { data, error } = await supabase
        .from("practicals")
        .select("*, subjects(subject_name)")
        .eq("id", Number(practicalId))
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

          const safeLevels = sorted.map(level => ({
            ...level,
            title: level.title || "",
            description: level.description || ""
          }));
          setPracticalLevels(safeLevels);

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
          .eq("is_hidden", false)
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
        output: testCaseResults.map((r) => `${r.status.toUpperCase()}: ${r.is_hidden ? "Hidden Test Case" : r.stdout}`).join("\n\n"),
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Session Locked Overlay */}
      {isSessionLocked && (
        <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-red-500/30">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Access Denied</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-lg">
              {lockReason || "Your session is locked."}
            </p>
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg">
              <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                Please contact the faculty to request a re-attempt.
              </p>
            </div>
            <Button
              onClick={() => router.push("/dashboard/student")}
              className="mt-6 w-full"
              variant="outline"
            >
              Return to Dashboard
            </Button>
          </div>
        </div>
      )}
      {/* Session Invalidation Modal */}
      {showInvalidModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-md mx-4 shadow-2xl border border-red-200 dark:border-red-900/50"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Session Invalidated</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Another login detected</p>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your session has been invalidated because you logged in from another device or browser.
              Your current code has been auto-submitted for safety.
            </p>
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/30 mb-4">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-amber-700 dark:text-amber-300">You will be logged out in a few seconds...</span>
            </div>
            <Button
              onClick={dismissModal}
              className="w-full bg-gray-900 hover:bg-gray-800 dark:bg-gray-100 dark:hover:bg-gray-200 dark:text-gray-900"
            >
              I Understand
            </Button>
          </motion.div>
        </div>
      )}

      {/* Mandatory Fullscreen Overlays */}

      {/* 1. Consent & Start Modal (Replaces previous simplified start) */}
      {/* 1. Consent & Start Modal (Replaces previous simplified start) */}
      {!hasExamStarted && !loading && !isSessionLocked && (
        <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-800 text-center"
          >
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Exam Rules & Consent</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Please review the following rules before starting.
            </p>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Full Screen Required:</span> You must stay in full screen mode required for the entire duration.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Focus Tracking:</span> Tab switching and window blurring are monitored.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Fair Play:</span> By starting, you agree to have your session activity recorded.
                </p>
              </div>
            </div>

            <Button
              onClick={handleStartExam}
              size="lg"
              disabled={loading}
              className="w-full h-12 text-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-xl transition-all hover:scale-[1.02]"
            >
              {loading ? "Starting..." : "I Agree & Start Exam"}
            </Button>

            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
              Legal: Your IP and browser fingerprint ID are logged.
            </p>
          </motion.div>
        </div>
      )}

      {/* 2. Returning to Fullscreen Overlay */}
      {hasExamStarted && !isFullscreenMode && (
        <div className="fixed inset-0 z-[60] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl border border-red-500/30 text-center"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Exam Paused</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You have exited full screen mode. You must return to full screen to continue the exam.
            </p>
            <Button
              onClick={enterFullscreen}
              className="w-full h-12 bg-white text-gray-900 hover:bg-gray-100 border border-gray-200"
            >
              Return to Full Screen
            </Button>
          </motion.div>
        </div>
      )}

      {/* Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-white/20 dark:border-gray-700/50 backdrop-blur-xl bg-white/60 dark:bg-gray-900/60 shadow-lg shadow-black/5 dark:shadow-black/20">
        {/* Left: Logo & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-xl blur-md opacity-60" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>
            <div>
              <h1
                role="heading"
                aria-level={1}
                className="select-none text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400"
              >
                CodeGuard
              </h1>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">Secure Code Editor</p>
            </div>
          </div>

          {/* Practical Title */}
          {practical?.title && (
            <div className="hidden md:flex items-center gap-2 pl-4 border-l border-gray-200/50 dark:border-gray-700/50">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300 max-w-[200px] truncate">
                {practical.title}
              </span>
            </div>
          )}
        </div>

        {/* Right: Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Proctoring Status */}
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-gray-100/60 dark:bg-gray-800/50 border border-gray-200/50 dark:border-gray-700/50">
            {locked ? (
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-semibold">Session Locked</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${violations > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Violations:
                  <span className={`ml-1 font-bold ${violations > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {violations}/3
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* User Info */}
          {user && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100/50 dark:border-indigo-800/30">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 max-w-[120px] truncate">
                {rollNo || user.email?.split('@')[0]}
              </span>
            </div>
          )}

          {/* Sign Out Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            className="h-9 px-4 text-xs font-medium border-gray-200 dark:border-gray-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800/50 transition-all"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </Button>

          {/* Theme Toggle */}
          <ModeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full gap-4">
          {/* LEFT: Problem Panel - Clean & Focused */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full overflow-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">

              {/* Header Section - Sticky */}
              <div className="sticky top-0 z-10 px-6 pt-6 pb-4 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                {/* Title - Dominant */}
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4 leading-tight tracking-tight">
                  {practical?.title || "Problem Title"}
                </h1>

                {/* Meta Row - Compact */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Difficulty Badge */}
                  <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-md ${activeLevel === 'easy' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' :
                    activeLevel === 'hard' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400'
                    }`}>
                    {hasLevelsParam ? activeLevel.charAt(0).toUpperCase() + activeLevel.slice(1) : 'Medium'}
                  </span>

                  {/* Language Badge */}
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                    {lang?.toUpperCase() || 'JAVA'}
                  </span>

                  {/* Subject */}
                  {practical?.subject_name && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {practical.subject_name}
                    </span>
                  )}
                </div>

                {/* Level Selector - Segmented Control */}
                {hasLevelsParam && practicalLevels.length > 0 && (
                  <div className="mt-4 inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    {practicalLevels.map((level) => {
                      const isActive = activeLevel === level.level;
                      return (
                        <button
                          key={level.id}
                          onClick={() => setActiveLevel(level.level)}
                          className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${isActive
                            ? level.level === 'easy' ? 'bg-emerald-500 text-white shadow-sm' :
                              level.level === 'hard' ? 'bg-red-500 text-white shadow-sm' :
                                'bg-amber-500 text-white shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                            }`}
                          title={`${level.level.charAt(0).toUpperCase() + level.level.slice(1)} – ${level.max_marks} points`}
                        >
                          {level.level.charAt(0).toUpperCase() + level.level.slice(1)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="px-6 py-5 space-y-6">

                {/* Problem Statement */}
                <div>
                  <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Description
                  </h2>
                  <div className="text-gray-700 dark:text-gray-300 leading-relaxed text-[15px] whitespace-pre-wrap">
                    {hasLevelsParam && practicalLevels.length > 0
                      ? practicalLevels.find(l => l.level === activeLevel)?.description || problemStmt
                      : problemStmt}
                  </div>
                </div>

                {/* Examples Section */}
                <div>
                  <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Examples
                  </h2>
                  <div className="space-y-3">
                    {examplesFromDB && examplesFromDB.length > 0 ? (
                      examplesFromDB.map((ex, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500 text-white text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Example {idx + 1}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Input</div>
                              <pre className="bg-white dark:bg-gray-900 text-sm font-mono p-3 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{ex.input}</pre>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Output</div>
                              <pre className="bg-white dark:bg-gray-900 text-sm font-mono p-3 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap text-gray-800 dark:text-gray-200">{ex.output}</pre>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : extractedExamples && extractedExamples.length > 0 ? (
                      extractedExamples.map((ex, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-emerald-500 text-white text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Example {idx + 1}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Input</div>
                              <pre className="bg-white dark:bg-gray-900 text-sm font-mono p-3 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">{ex.input ?? ex.raw ?? "—"}</pre>
                            </div>
                            <div>
                              <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Output</div>
                              <pre className="bg-white dark:bg-gray-900 text-sm font-mono p-3 rounded border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">{ex.output ?? "—"}</pre>
                            </div>
                          </div>
                          {ex.explanation && (
                            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">💡 Explanation</div>
                              <div className="text-sm text-gray-700 dark:text-gray-300">{ex.explanation}</div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-400 italic p-4 text-center bg-gray-50 dark:bg-gray-800/30 rounded-lg">
                        No examples available
                      </div>
                    )}
                  </div>
                </div>

                {/* Constraints */}
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-4 border border-amber-200 dark:border-amber-800/30">
                  <h2 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    Constraints
                  </h2>
                  {constraintSection ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{constraintSection.body}</div>
                  ) : (
                    <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      <li className="flex items-center gap-2">
                        <span className="text-amber-500">⏱</span>
                        <span>Time limit: <code className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs font-mono">2000ms</code></span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="text-amber-500">💾</span>
                        <span>Memory limit: <code className="px-1.5 py-0.5 bg-white dark:bg-gray-800 rounded text-xs font-mono">64MB</code></span>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-indigo-500 dark:hover:bg-indigo-500 transition-colors duration-200 rounded" />

          {/* RIGHT: Code Editor + Bottom Section */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full gap-3 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
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
                    onLangChange={() => { }}
                    showInputToggle={false}
                    showInput={false}
                    setShowInput={() => { }}
                    terminalRef={undefined}
                  />
                </div>
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

              {/* Bottom Section - Tabs like LeetCode */}
              <ResizablePanel defaultSize={35} minSize={20}>
                <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">

                  {/* Tab Headers */}
                  <div className="flex-shrink-0 flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                    <button
                      onClick={() => setShowUserTestCases(false)}
                      className={`px-4 py-2.5 text-sm font-medium transition-all relative ${!showUserTestCases
                        ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border-b-2 border-indigo-500'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                      Results
                    </button>
                    <button
                      onClick={() => setShowUserTestCases(true)}
                      className={`px-4 py-2.5 text-sm font-medium transition-all relative ${showUserTestCases
                        ? 'text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 border-b-2 border-indigo-500'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                    >
                      Custom Tests
                    </button>
                    {/* Keyboard Hint */}
                    <div className="ml-auto flex items-center pr-4">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden sm:block">
                        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] border border-gray-200 dark:border-gray-700">Ctrl</kbd>
                        <span className="mx-0.5">+</span>
                        <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] border border-gray-200 dark:border-gray-700">Enter</kbd>
                        <span className="ml-1">Run</span>
                      </span>
                    </div>
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-auto">

                    {/* Test Case Results Tab */}
                    {!showUserTestCases && (
                      <div className="h-full p-4">
                        {testCaseResults.length > 0 && (
                          <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-3">
                              <span className={`text-sm font-semibold ${passedCount === totalCount ? 'text-emerald-600' : 'text-gray-700 dark:text-gray-300'}`}>
                                {passedCount === totalCount ? '✓ All Passed' : `${passedCount}/${totalCount} Passed`}
                              </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-40">
                              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${passPercent}%`, backgroundColor: passPercent === 100 ? '#10b981' : '#6366f1' }} />
                              </div>
                            </div>
                          </div>
                        )}

                        {testCaseResults.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center py-8">
                            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Run your code to evaluate</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Results will appear here after execution</p>
                          </div>
                        )}

                        {testCaseResults.map((r, idx) => {
                          const isExpanded = !!expandedCases[idx];
                          const leftBorderClass = r.status === 'passed' ? 'border-l-4 border-green-500' : r.status === 'failed' ? 'border-l-4 border-red-500' : 'border-l-4 border-yellow-400';

                          return (
                            <div key={idx} className={`mb-4 rounded-lg p-0 overflow-hidden shadow-sm ${leftBorderClass} bg-white/30 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700`}>
                              <div
                                className={`flex items-center justify-between p-3 ${r.is_hidden ? 'cursor-default' : 'cursor-pointer'}`}
                                onClick={() => !r.is_hidden && setExpandedCases(prev => ({ ...prev, [idx]: !prev[idx] }))}
                              >
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

                              {isExpanded && !r.is_hidden && (
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
        </ResizablePanelGroup >
      </div >
    </div >
  );
}
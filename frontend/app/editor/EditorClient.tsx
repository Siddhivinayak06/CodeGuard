"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";

const CodeEditor = dynamic(() => import("@/components/editor/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-muted/20 animate-pulse text-muted-foreground font-mono text-sm">
      Loading Editor...
    </div>
  ),
});
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
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import type { ImperativePanelHandle } from "react-resizable-panels";

type TestCaseResult = {
  test_case_id: number;
  input: string;
  expected: string;
  stdout: string;
  error: string | null;
  status:
    | "accepted"
    | "passed"
    | "wrong_answer"
    | "failed"
    | "time_limit_exceeded"
    | "memory_limit_exceeded"
    | "runtime_error"
    | "compile_error"
    | "output_limit_exceeded"
    | "skipped_fail_fast";
  time_ms?: number | null;
  memory_kb?: number | null;
  is_hidden?: boolean;
  stderr?: string;
};

type UserTestCase = {
  id: number;
  input: string;
  time_limit_ms: number;
  memory_limit_kb: number;
  expectedOutput: string;
};

const ERROR_PANEL_STATUSES = new Set([
  "compile_error",
  "runtime_error",
  "time_limit_exceeded",
  "memory_limit_exceeded",
  "output_limit_exceeded",
]);

const ESC = String.fromCharCode(27);
const BEL = String.fromCharCode(7);
const ANSI_ESCAPE_REGEX = new RegExp(`${ESC}\\[[0-9;?]*[ -/]*[@-~]`, "g");
const OSC_ESCAPE_REGEX = new RegExp(`${ESC}\\][^${BEL}]*(?:${BEL}|${ESC}\\\\)`, "g");

const cleanErrorForDisplay = (message?: string | null) =>
  String(message || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(ANSI_ESCAPE_REGEX, "")
    .replace(OSC_ESCAPE_REGEX, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const getErrorPanelTitle = (status: string) => {
  switch (status) {
    case "compile_error":
      return "Compilation Error";
    case "time_limit_exceeded":
      return "Time Limit Exceeded";
    case "memory_limit_exceeded":
      return "Memory Limit Exceeded";
    case "output_limit_exceeded":
      return "Output Limit Exceeded";
    default:
      return "Runtime Error";
  }
};

const getQuickFixHint = (
  message: string,
  status: string,
  language: string,
) => {
  const text = String(message || "").toLowerCase();
  const lang = String(language || "").toLowerCase();

  if (text.includes("cannot find symbol")) {
    return "Check spelling for class, method, and variable names, and verify imports.";
  }
  if (text.includes("expected ';'")) {
    return "Add the missing semicolon near the line shown in the error.";
  }
  if (text.includes("syntaxerror")) {
    return "Fix the syntax near the reported line (brackets, quotes, or punctuation).";
  }
  if (text.includes("indentationerror")) {
    return "Fix inconsistent indentation in your Python code.";
  }
  if (
    text.includes("indexerror") ||
    text.includes("index out of range") ||
    text.includes("arrayindexoutofboundsexception")
  ) {
    return "Check index bounds before accessing arrays, lists, or strings.";
  }
  if (text.includes("nullpointerexception")) {
    return "A value is null before use. Initialize it or add null checks.";
  }
  if (text.includes("zerodivisionerror") || text.includes("/ by zero")) {
    return "Handle division-by-zero cases before dividing.";
  }
  if (text.includes("segmentation fault")) {
    return "Check pointer usage, memory access, and array bounds in C/C++.";
  }
  if (status === "time_limit_exceeded") {
    return "Optimize your algorithm and avoid unnecessary loops or repeated work.";
  }
  if (status === "memory_limit_exceeded") {
    return "Reduce memory usage by avoiding large temporary structures.";
  }

  if (status === "compile_error") {
    if (lang === "python") {
      return "Fix the syntax issue and run again.";
    }
    return "Fix compile errors shown above, then run again.";
  }

  return null;
};

// ---------------------------
// Parse freeform description into contest-like sections
// (unchanged)
function parseDescriptionToSections(raw: string | undefined) {
  if (!raw) {
    return {
      sections: [
        { title: "Problem Statement", body: "No description available." },
      ],
    };
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
  const headingRegex = new RegExp(
    `^\\s*(${headings.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[:\\-]?\\s*$`,
    "i",
  );

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

  const keywordSplit =
    /(Input(?:\s*Format)?|Output(?:\s*Format)?|Constraints|Sample Input|Sample Output|Explanation)/i;
  if (keywordSplit.test(text)) {
    const parts = text
      .split(
        /(Input(?:\s*Format)?|Output(?:\s*Format)?|Constraints|Sample Input|Sample Output|Explanation)/i,
      )
      .map((p) => p.trim())
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

  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length === 1)
    return { sections: [{ title: "Problem Statement", body: paras[0] }] };

  const sections = [{ title: "Problem Statement", body: paras[0] }];
  if (paras.length > 1)
    sections.push({
      title: "Notes / Examples",
      body: paras.slice(1).join("\n\n"),
    });
  return { sections };
}

// ---------------------------
// Small helper to extract example blocks (Sample Input / Output + Explanation)
// (unchanged)
function extractExamplesFromText(text?: string) {
  if (!text) return [];
  const parts = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const examples: Array<{
    title: string;
    input?: string;
    output?: string;
    explanation?: string;
    raw?: string;
  }> = [];

  for (const p of parts) {
    const inputMatch = p.match(
      /Input\s*[:-]?\s*(?:s\s*=\s*)?["']?([^"\n]+?)["']?(?:\n|$)/i,
    );
    const outputMatch = p.match(
      /Output\s*[:-]?\s*["']?([^"\n]+?)["']?(?:\n|$)/i,
    );
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

    const lines = p
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length > 1 && lines.some((l) => /Input|Output|Sample/i.test(l))) {
      const inL = lines.find((l) => /Input/i);
      const outL = lines.find((l) => /Output/i);
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
  const languageFromUrl =
    searchParams?.get("language")?.toLowerCase() || "java";
  const hasLevelsParam = searchParams?.get("hasLevels") === "true";

  // Exam mode params
  const isExamMode = searchParams?.get("isExam") === "true";
  const examIdParam = searchParams?.get("examId") || null;
  const isUuidLike = (value: string | null) =>
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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

    javascript: `console.log("Hello World")`,
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
  const [scoreSummary, setScoreSummary] = useState<{
    passed: number;
    total: number;
  }>({ passed: 0, total: 0 });
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "pending" | "evaluated" | "submitted"
  >("idle");
  const [showContinueAfterSubmit, setShowContinueAfterSubmit] = useState(false);
  const [showFloatingResultWindow, setShowFloatingResultWindow] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmittingFinal, setIsSubmittingFinal] = useState(false);
  const [isResultPanelCollapsed, setIsResultPanelCollapsed] = useState(true);
  const resultTabContentRef = useRef<HTMLDivElement | null>(null);
  const resultPanelRef = useRef<ImperativePanelHandle | null>(null);
  const hasInitializedResultPanelRef = useRef(false);

  const expandResultPanel = (size = 32) => {
    const panel = resultPanelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      panel.expand();
    }
    panel.resize(size);
    setIsResultPanelCollapsed(false);
  };

  const toggleResultPanel = () => {
    const panel = resultPanelRef.current;
    if (!panel) return;

    if (panel.isCollapsed()) {
      expandResultPanel(30);
      return;
    }

    panel.collapse();
    setIsResultPanelCollapsed(true);
  };

  useLayoutEffect(() => {
    const collapsePanel = () => {
      const panel = resultPanelRef.current;
      if (!panel) {
        return false;
      }

      panel.collapse();
      setIsResultPanelCollapsed(true);
      return true;
    };

    const collapsedImmediately = collapsePanel();

    if (collapsedImmediately) {
      hasInitializedResultPanelRef.current = true;
      return;
    }

    const frame = requestAnimationFrame(() => {
      collapsePanel();
      hasInitializedResultPanelRef.current = true;
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  // Exam mode state
  const [examConfig, setExamConfig] = useState<{
    duration_minutes: number;
    max_violations: number;
    allow_copy_paste: boolean;
    require_fullscreen: boolean;
    show_test_results: boolean;
  } | null>(null);
  const [examSession, setExamSession] = useState<any>(null);
  const [examTimeRemaining, setExamTimeRemaining] = useState<number | null>(null); // ms
  const [assignedSet, setAssignedSet] = useState<{ id: string; set_name: string; level_ids: number[] } | null>(null);
  const examTimerRef = useRef<NodeJS.Timeout | null>(null);
  const examAutoSubmittedRef = useRef(false);
  const handleSubmitRef = useRef<(() => Promise<boolean>) | null>(null);
  const isAutoSubmitInFlightRef = useRef(false);
  // userTestCases now include expectedOutput field by default (keeps parity with server)
  const [userTestCases, setUserTestCases] = useState<UserTestCase[]>([
    {
      id: 1,
      input: "",
      time_limit_ms: 2000,
      memory_limit_kb: 65536,
      expectedOutput: "",
    },
  ]);

  // NEW: examples from test_cases table
  const [examplesFromDB, setExamplesFromDB] = useState<
    Array<{ input: string; output: string; level_id: number | null }>
  >([]);

  // Multi-level practical support
  const [practicalLevels, setPracticalLevels] = useState<
    Array<{
      id: number;
      level: string;
      title: string;
      description: string;
      max_marks: number;
      starter_code?: string;
    }>
  >([]);
  const [activeLevel, setActiveLevel] = useState<string>("Task 1");

  const activeLevelId = useMemo(() => {
    if (!hasLevelsParam) return null;
    return practicalLevels.find((l) => l.level === activeLevel)?.id ?? null;
  }, [hasLevelsParam, practicalLevels, activeLevel]);

  const visibleExamplesFromDB = useMemo(() => {
    if (!examplesFromDB.length) return [];

    if (!hasLevelsParam) {
      return examplesFromDB
        .filter((ex) => ex.level_id === null)
        .map(({ input, output }) => ({ input, output }));
    }

    if (activeLevelId === null) return [];

    const taskScoped = examplesFromDB
      .filter((ex) => ex.level_id === activeLevelId)
      .map(({ input, output }) => ({ input, output }));

    if (taskScoped.length > 0) return taskScoped;

    // Backward compatibility for older rows that were stored without level_id.
    return examplesFromDB
      .filter((ex) => ex.level_id === null)
      .map(({ input, output }) => ({ input, output }));
  }, [examplesFromDB, hasLevelsParam, activeLevelId]);

  // Per-task code buffers: stores typed code for each task level
  const taskCodeMapRef = useRef<Record<string, string>>({});

  // Switch between task levels, saving/restoring code
  const handleSwitchLevel = (targetLevel: string) => {
    if (targetLevel === activeLevel) return;
    // Save current code for the current level
    taskCodeMapRef.current[activeLevel] = code;
    // Restore code for the target level (or use starter code, or default template)
    const savedCode = taskCodeMapRef.current[targetLevel];
    const targetLevelData = practicalLevels.find(l => l.level === targetLevel);
    const starterForTarget = targetLevelData?.starter_code;
    setCode(savedCode || starterForTarget || getStarterCode(lang));
    setActiveLevel(targetLevel);
  };

  // expanded state for LeetCode-style test case cards
  const [expandedCases, setExpandedCases] = useState<Record<number, boolean>>(
    {},
  );

  // ========================
  // Session Validation (Single Active Session)
  // ========================
  const resolveExamIdToSubmit = useCallback(() => {
    if (isUuidLike(examIdParam)) return examIdParam;
    const sessionExamId = String(examSession?.exam_id || "");
    return isUuidLike(sessionExamId) ? sessionExamId : null;
  }, [examIdParam, examSession?.exam_id]);

  const autoSubmitOnInvalidation = async () => {
    // Auto-submit current code when session is invalidated
    if (code && practicalId && user) {
      try {
        // In exam mode, force the same full submit path used by manual submit
        // so tests run and marks are finalized before session logout.
        if (isExamMode && hasExamStarted && handleSubmitRef.current) {
          const ok = await handleSubmitRef.current();
          if (ok) {
            console.log("Code auto-submitted due to session invalidation");
            return;
          }
        }

        // Ensure attempt is consumed for practical mode even on forced auto-submit.
        if (!isExamMode) {
          await axios.post(
            "/api/practical/start",
             { practicalId: Number(practicalId) },
            { validateStatus: () => true },
          );
        }

        // Save the active task's code to the map first
        if (hasLevelsParam && practicalLevels.length > 0) {
          taskCodeMapRef.current[activeLevel] = code;

          // Submit each task level separately
          for (const level of practicalLevels) {
            const levelCode = taskCodeMapRef.current[level.level];
            if (!levelCode) continue;
            await axios.post("/api/submission/create", {
              student_id: user.id,
              practical_id: Number(practicalId),
              code: levelCode,
              language: lang,
              status: "pending",
              marks_obtained: 0,
              level_id: level.id || null,
            });
          }
        } else {
          // Single-level practical — submit as before
          await axios.post("/api/submission/create", {
            student_id: user.id,
            practical_id: Number(practicalId),
            code,
            language: lang,
            status: "pending",
            marks_obtained: 0,
          });
        }

        // Finalize exam session on auto-submit
        if (isExamMode) {
          const examIdToSubmit = resolveExamIdToSubmit();
          if (examIdToSubmit) {
             await axios.post("/api/exam/submit", { 
               examId: examIdToSubmit, 
               practicalId: Number(practicalId)
             });
          }
        }
        console.log("Code auto-submitted due to session invalidation");
      } catch (err) {
        console.error("Auto-submit failed:", err);
      }
    }
  };

  const triggerExamAutoSubmit = useCallback(
    async (reason: "violation" | "timeout"): Promise<boolean> => {
      if (!isExamMode || isSubmitted || isSubmittingFinal) return false;
      if (isAutoSubmitInFlightRef.current) return false;

      isAutoSubmitInFlightRef.current = true;
      examAutoSubmittedRef.current = true;

      if (reason === "timeout") {
        console.warn("Exam time expired! Auto-submitting...");
        toast.error("Time's up! Auto-submitting your exam...");
      } else {
        console.warn("Proctoring limit reached! Auto-submitting...");
        toast.error("Violation limit reached. Auto-submitting your exam...");
      }

      try {
        const ok = handleSubmitRef.current
          ? await handleSubmitRef.current()
          : false;

        // If submission did not complete, allow retry trigger.
        if (!ok) {
          examAutoSubmittedRef.current = false;
        }
        return ok;
      } catch (err) {
        console.error("Forced auto-submit failed:", err);
        examAutoSubmittedRef.current = false;
        return false;
      } finally {
        isAutoSubmitInFlightRef.current = false;
      }
    },
    [isExamMode, isSubmitted, isSubmittingFinal],
  );

  const { showInvalidModal, registerSession, dismissModal } =
    useSessionValidator({
      onSessionInvalidated: autoSubmitOnInvalidation,
      enabled: !!user && !isSubmitted && !isSubmittingFinal,
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
  const [isExporting, setIsExporting] = useState(false);

  const proctoringStorageKey = useMemo(() => {
    if (!isExamMode || !user?.id) return null;
    if (examSession?.id) return `cg:exam:violations:${examSession.id}`;
    if (isUuidLike(examIdParam)) return `cg:exam:violations:${user.id}:${examIdParam}`;
    if (practicalId) return `cg:exam:violations:${user.id}:practical:${practicalId}`;
    return null;
  }, [isExamMode, user?.id, examSession?.id, examIdParam, practicalId]);

  // Proctoring Hook (Only active after exam starts)
  const { violations, locked } = useProctoring({
    active: hasExamStarted && !isSubmitted && !isSubmittingFinal && !isExporting,
    maxViolations: examConfig?.max_violations ?? 3,
    storageKey: proctoringStorageKey ?? undefined,
  });

  // ========================
  // Exam Mode: Start/Resume Session
  // ========================
  useEffect(() => {
    if (!isExamMode || !user || (!examIdParam && !practicalId)) return;

    const startExamSession = async () => {
      let effectiveExamId: string | null = examIdParam;

      try {
        // Backward compatibility: if URL carries non-UUID examId (e.g., practical id),
        // resolve the real exam UUID using practical_id.
        if (!isUuidLike(effectiveExamId) && practicalId) {
          const { data: examRow } = await supabase
            .from("exams")
            .select("id")
            .eq("practical_id", Number(practicalId))
            .maybeSingle();
          effectiveExamId = (examRow as any)?.id || null;
        }

        if (!effectiveExamId) {
          throw new Error("Missing examId");
        }

        // 1) Prefer status endpoint first only for already-started sessions.
        // For pre-created sessions (started_at=null), call /api/exam/start so backend
        // initializes expires_at from exams.duration_minutes.
        const statusRes = await axios.post(
          "/api/exam/status",
          { examId: effectiveExamId },
          { validateStatus: () => true },
        );

        if (
          statusRes.status === 200 &&
          statusRes.data?.session &&
          statusRes.data.session?.started_at
        ) {
          // If session is already expired, don't start the timer — show submitted state
          if (statusRes.data.session.isExpired || statusRes.data.remainingMs <= 0) {
            toast.error("This exam session has expired.");
            setIsSubmitted(true);
            setExamConfig(statusRes.data.examConfig);
            if (statusRes.data.assignedSet) {
              setAssignedSet(statusRes.data.assignedSet);
            }
            return;
          }

          setExamConfig(statusRes.data.examConfig);
          setExamSession(statusRes.data.session);
          setExamTimeRemaining(statusRes.data.remainingMs);
          setHasExamStarted(true);

          if (statusRes.data.assignedSet) {
            setAssignedSet(statusRes.data.assignedSet);
          }

          if (statusRes.data.examConfig?.require_fullscreen) {
            try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
          }
          return;
        }

        // Preserve assigned set from status for UI filtering while start call runs.
        if (statusRes.status === 200 && statusRes.data?.assignedSet) {
          setAssignedSet(statusRes.data.assignedSet);
        }

        // 2) No active session found -> attempt to start/resume exam session.
        const startRes = await axios.post(
          "/api/exam/start",
          { examId: effectiveExamId },
          { validateStatus: () => true },
        );

        if (startRes.status >= 200 && startRes.status < 300) {
          setExamConfig(startRes.data.examConfig);
          setExamSession(startRes.data.session);
          setExamTimeRemaining(startRes.data.remainingMs);
          setHasExamStarted(true);

          if (startRes.data.assignedSet) {
            setAssignedSet(startRes.data.assignedSet);
          }

          if (startRes.data.examConfig?.require_fullscreen) {
            try { await document.documentElement.requestFullscreen(); } catch { /* ignore */ }
          }
          return;
        }

        // 3) Graceful non-throw handling for 4xx to avoid AxiosError in console.
        const msg = startRes.data?.error || statusRes.data?.error || "Failed to start exam";
        toast.error(msg);

        // Keep assigned-set filtering available when status had it.
        if (statusRes.data?.assignedSet) {
          setAssignedSet(statusRes.data.assignedSet);
        }

        if (String(msg).toLowerCase().includes("already submitted")) {
          setIsSubmitted(true);
        }
        return;
      } catch (err: any) {
        console.error("Failed to start exam:", err);
        const msg = err?.response?.data?.error || "Failed to start exam";
        toast.error(msg);

        // Fallback: if start/status call path throws unexpectedly, fetch status once
        // to capture assigned set and keep task filtering correct.
        if (effectiveExamId) {
          try {
            const statusRes = await axios.post("/api/exam/status", { examId: effectiveExamId });
            if (statusRes.data?.assignedSet) {
              setAssignedSet(statusRes.data.assignedSet);
            }
            if (statusRes.data?.examConfig) {
              setExamConfig(statusRes.data.examConfig);
            }
          } catch (statusErr) {
            console.error("Failed to fetch exam status after start failure:", statusErr);
          }
        }

        if (msg.includes("already submitted")) {
          setIsSubmitted(true);
        }
      }
    };

    startExamSession();
  }, [isExamMode, examIdParam, user, practicalId, supabase]);

  // Exam countdown timer
  const examTimerStarted = useRef(false);
  useEffect(() => {
    if (!isExamMode || examTimeRemaining === null || isSubmitted || isSubmittingFinal) return;

    // Prevent starting the timer if the exam was already expired on load
    if (examTimeRemaining <= 0) {
      if (!examAutoSubmittedRef.current && examTimerStarted.current) {
        // Only auto-submit if the timer was actively counting down
        void triggerExamAutoSubmit("timeout");
      }
      return;
    }

    examTimerStarted.current = true;

    const intervalId = setInterval(() => {
      setExamTimeRemaining(prev => {
        if (prev === null) return null;
        const next = prev - 1000;
        if (next <= 0 && !examAutoSubmittedRef.current) {
          clearInterval(intervalId);
          void triggerExamAutoSubmit("timeout");
          return 0;
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isExamMode, examTimeRemaining === null, isSubmitted, isSubmittingFinal, triggerExamAutoSubmit]);

  // Exam anti-cheating: block copy/paste/cut/right-click/DevTools
  useEffect(() => {
    if (!isExamMode || !hasExamStarted || isSubmitted || isSubmittingFinal) return;
    if (examConfig?.allow_copy_paste) return;

    const blockEvent = (e: Event) => {
      e.preventDefault();
      toast.warning("Copy/Paste is disabled during the exam");
    };

    const blockContextMenu = (e: Event) => {
      e.preventDefault();
    };

    const detectDevTools = () => {
      const threshold = 200;
      if (window.outerWidth - window.innerWidth > threshold ||
        window.outerHeight - window.innerHeight > threshold) {
        console.warn("DevTools detected!");
      }
    };

    document.addEventListener("copy", blockEvent);
    document.addEventListener("paste", blockEvent);
    document.addEventListener("cut", blockEvent);
    document.addEventListener("contextmenu", blockContextMenu);
    const devToolsInterval = setInterval(detectDevTools, 3000);

    return () => {
      document.removeEventListener("copy", blockEvent);
      document.removeEventListener("paste", blockEvent);
      document.removeEventListener("cut", blockEvent);
      document.removeEventListener("contextmenu", blockContextMenu);
      clearInterval(devToolsInterval);
    };
  }, [isExamMode, hasExamStarted, isSubmitted, isSubmittingFinal, examConfig?.allow_copy_paste]);

  // Auto-submit on Proctoring Lock
  const hasLockSubmittedRef = useRef(false);
  useEffect(() => {
    if (locked && !hasLockSubmittedRef.current && hasExamStarted && !isSubmitted && !isSubmittingFinal) {
      hasLockSubmittedRef.current = true;
      void (async () => {
        const ok = await triggerExamAutoSubmit("violation");
        if (!ok) {
          hasLockSubmittedRef.current = false;
        }
      })();
    }
  }, [locked, hasExamStarted, isSubmitted, isSubmittingFinal, triggerExamAutoSubmit]);

  // Check lock status on mount (Prevents Refresh/Re-entry)
  useEffect(() => {
    const checkLockStatus = async () => {
      if (!user || !practicalId) return;

      const { data, error } = await supabase
        .from("student_practicals")
        .select(`
          attempt_count, 
          max_attempts, 
          status,
          is_locked, 
          lock_reason,
          practicals (
            subject_id,
            practical_number
          )
        `)
        .eq("student_id", user.id)
        .eq("practical_id", Number(practicalId))
        .single<any>();

      if (data) {
        // 1. Strict Lock (is_locked flag set by faculty or system)
        if (data.is_locked) {
          setIsSessionLocked(true);
          setLockReason(data.lock_reason || "Session locked by faculty.");
          return;
        }

        // 2. Attempt-based lock — skip in exam mode because the exam start
        //    API already validates attempts server-side and increments
        //    attempt_count. Checking here races with that API call and can
        //    falsely lock the student out when the increment completes first.
        if (!isExamMode) {
          const attempts = Number(data.attempt_count || 0);
          const max = Number(data.max_attempts || 1);
          const status = String(data.status || "").toLowerCase();
          const isActiveAttemptStatus =
            status === "in_progress" || status === "overdue";

          // Allow the currently active started attempt.
          if (attempts >= max && !isActiveAttemptStatus) {
            setIsSessionLocked(true);
            setLockReason("You have already used your attempt. Refreshing is not allowed.");
            return;
          }
        }

        // Sequential lock removed — students can access any scheduled practical
        setIsSessionLocked(false);
        setLockReason(null);
      }
    };

    checkLockStatus();
  }, [user, practicalId, supabase]);

  // Handle Start Exam (One-Time Action)
  const handleStartExam = async () => {
    try {
      setLoading(true);
      const res = await axios.post("/api/practical/start", { practicalId });

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
        // Session is already registered server-side during login (actions.ts)
        // Do NOT call registerSession here — it creates a new UUID that
        // overwrites the DB but can't overwrite the httpOnly cookie,
        // causing a DB/cookie mismatch that the middleware detects as
        // session hijacking and triggers logout.

        // Fetch roll number if student
        const { data: userData } = await supabase
          .from("users")
          .select("roll_no")
          .eq("uid", data.user.id)
          .single();
        if ((userData as any)?.roll_no) {
          setRollNo((userData as any).roll_no);
        }
      }
    };
    fetchUser();
    return () => {
      mountedRef.current = false;
    };
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
        .eq("id", Number(practicalId))
        .single();

      if (!error && mountedRef.current && data) {
        setPractical({
          ...(data as any),
          subject_name: (data as any).subjects?.subject_name || "Unknown",
        });

        const dbLang = (data as any).language ? (data as any).language.toLowerCase() : lang.toLowerCase();
        let initialCode = getStarterCode(dbLang);

        // For single-level practicals, fetch starter code with no level_id
        const { data: refCodeData } = await supabase
          .from("reference_codes")
          .select("starter_code")
          .eq("practical_id", Number(practicalId))
          .is("level_id", null)
          .order("id", { ascending: false })
          .limit(1);

        console.log("[EditorDebug] Single-level refCodeData:", JSON.stringify(refCodeData));

        if (refCodeData && (refCodeData as any[]).length > 0 && (refCodeData as any[])[0].starter_code) {
          initialCode = (refCodeData as any[])[0].starter_code;
        }

        if (dbLang !== lang.toLowerCase() || (refCodeData && (refCodeData as any[]).length > 0 && (refCodeData as any[])[0].starter_code)) {
          setLang(dbLang);
          setCode(initialCode);
        }
      }

      // Fetch levels if this is a multi-level practical
      if (hasLevelsParam) {
        const { data: levelsData, error: levelsError } = await supabase
          .from("practical_levels")
          .select("*")
          .eq("practical_id", Number(practicalId))
          .order("id", { ascending: true });

        // Fetch ALL reference codes for this practical (including ones without level_id)
        const { data: allRefCodes } = await supabase
          .from("reference_codes")
          .select("*")
          .eq("practical_id", Number(practicalId));

        console.log("[EditorDebug] ALL reference_codes for practical:", JSON.stringify(allRefCodes));
        console.log("[EditorDebug] Levels data:", JSON.stringify(levelsData?.map((l: any) => ({ id: l.id, level: l.level }))));

        // Find a fallback starter code (from any row, including old ones with level_id=NULL)
        const fallbackRef = (allRefCodes as any[] || []).find((r: any) => r.starter_code);
        console.log("[EditorDebug] Fallback ref:", JSON.stringify(fallbackRef));

        if (!levelsError && levelsData && mountedRef.current) {
          const sorted = (levelsData as any[]).sort((a, b) => {
            const getNum = (s: string) => {
              const m = s.match(/(\d+)/);
              return m ? parseInt(m[1], 10) : 0;
            };
            return getNum(a.level) - getNum(b.level);
          });

          const safeLevels = sorted.map((level: any) => {
            // Try to find a reference code matching this specific level
            const levelRef = (allRefCodes as any[] || []).find((r: any) => r.level_id === level.id);
            return {
              ...level,
              title: level.title || "",
              description: level.description || "",
              starter_code: levelRef?.starter_code || fallbackRef?.starter_code || "",
            };
          });

          // Filter levels by assigned question set (exam mode)
          const filteredLevels = assignedSet?.level_ids?.length
            ? safeLevels.filter((l: any) => assignedSet.level_ids.includes(l.id))
            : safeLevels;

          setPracticalLevels(filteredLevels);

          // Pre-populate taskCodeMap with starter codes for each level
          safeLevels.forEach((level: any) => {
            if (level.starter_code && !taskCodeMapRef.current[level.level]) {
              taskCodeMapRef.current[level.level] = level.starter_code;
            }
          });

          if (filteredLevels.length > 0) {
            setActiveLevel(filteredLevels[0].level);
            // Set initial code from the first visible level's starter code
            const firstLevelRef = (allRefCodes as any[] || []).find((r: any) => r.level_id === filteredLevels[0].id);
            const starterToUse = firstLevelRef?.starter_code || fallbackRef?.starter_code;
            console.log("[EditorDebug] starterToUse:", starterToUse ? starterToUse.substring(0, 50) + "..." : "NONE");
            if (starterToUse) {
              setLang(lang);
              setCode(starterToUse);
            }
          }
        }
      }
    };
    fetchPractical();
  }, [practicalId, supabase, hasLevelsParam]);

  // Re-filter levels when assignedSet arrives (handles race condition
  // where exam/start response comes after levels are already loaded)
  useEffect(() => {
    if (!assignedSet?.level_ids?.length || practicalLevels.length === 0) return;

    // Check if we need to filter — if any visible level is NOT in the set, filter.
    const needsFilter = practicalLevels.some(
      (l) => !assignedSet.level_ids.includes(l.id)
    );
    const currentVisible = needsFilter
      ? practicalLevels.filter((l) => assignedSet.level_ids.includes(l.id))
      : practicalLevels;

    if (currentVisible.length > 0 && !currentVisible.find((l) => l.level === activeLevel)) {
      setActiveLevel(currentVisible[0].level);
      const starterForFirst = currentVisible[0].starter_code;
      if (starterForFirst) {
        setCode(starterForFirst);
      }
    }

    if (needsFilter) {
      const filtered = currentVisible;
      setPracticalLevels(filtered);
    }
  }, [assignedSet, practicalLevels, activeLevel]);

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
          .select("input, expected_output, level_id, is_hidden")
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
            level_id: r.level_id ?? null,
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
    setShowContinueAfterSubmit(false);
    setShowFloatingResultWindow(false);
    setTestCaseResults([]);
    try {
      const customCases = showUserTestCases
        ? (userTestCases.length > 0
            ? userTestCases
            : [
                {
                  id: 1,
                  input: "",
                  time_limit_ms: 2000,
                  memory_limit_kb: 65536,
                  expectedOutput: "",
                },
              ])
        : [];

      const payload: any = {
        code,
        lang,
        practicalId,
        mode: "run",
        level: activeLevel,
        // Tell server explicitly whether we want to run custom cases
        useCustomTestCases: showUserTestCases,
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
      const normalizeStr = (s: any) =>
        s === null || s === undefined ? "" : String(s);

      const results: TestCaseResult[] = (res.data.results || []).map(
        (r: any) => ({
          test_case_id: r.test_case_id ?? 0,
          input: r.input ?? r.stdinInput ?? r.expected ?? "",
          expected: normalizeStr(r.expected ?? r.expected_output),
          stdout: normalizeStr(r.stdout),
          error: r.error ?? null,
          status: r.status ?? "failed",
          time_ms: r.time_ms ?? null,
          memory_kb: r.memory_kb ?? null,
          is_hidden: r.is_hidden ?? false,
        }),
      );

      setTestCaseResults(results);
      setShowUserTestCases(false);
      expandResultPanel();
      requestAnimationFrame(() => {
        resultTabContentRef.current?.scrollTo({ top: 0 });
      });
      console.log("Run results:", results);
    } catch (err: any) {
      const msg =
        err?.response?.data?.executionError ||
        err?.response?.data?.error ||
        err?.message ||
        "Error running code.";
      console.warn("Run request failed:", msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (): Promise<boolean> => {
    if (!practicalId || !user) return false;

    let submittedSuccessfully = false;

    setIsSubmittingFinal(true);
    setLoading(true);
    setSubmissionStatus("pending");
    setShowContinueAfterSubmit(false);
    setShowFloatingResultWindow(false);
    setLastSubmittedAt(null);
    setShowUserTestCases(false);
    setExpandedCases({});
    try {
      // Save current task's code to the map first
      if (hasLevelsParam && practicalLevels.length > 0) {
        taskCodeMapRef.current[activeLevel] = code;
      }

      // Determine which levels to submit.
      // In exam mode with assigned sets, submit and score only assigned set levels.
      const levelsToSubmit = (() => {
        if (hasLevelsParam && practicalLevels.length > 0) {
          if (isExamMode && assignedSet?.level_ids?.length) {
            const levelById = new Map<number, any>();
            practicalLevels.forEach((lvl: any) => levelById.set(Number(lvl.id), lvl));

            const assignedLevels = assignedSet.level_ids
              .map((id) => levelById.get(Number(id)))
              .filter(Boolean);

            if (assignedLevels.length > 0) {
              return assignedLevels;
            }
          }

          return practicalLevels;
        }

        return [{ level: activeLevel, max_marks: 10 }]; // single-level fallback
      })();

      let totalMarks = 0;
      let totalPassed = 0;
      let totalTests = 0;
      const combinedResults: TestCaseResult[] = [];
      const levelErrors: string[] = [];
      const normalizeStr = (s: any) =>
        s === null || s === undefined ? "" : String(s);

      setLoading(true);
      try {
        // Evaluate levels
        for (const levelData of levelsToSubmit) {
          try {
            // Get code for this level
            const levelCode = hasLevelsParam
              ? (taskCodeMapRef.current[levelData.level] || getStarterCode(lang))
              : code;

            if (!levelCode) continue;

            // Create submission for this level
            const submissionRes = await axios.post("/api/submission/create", {
              student_id: user.id,
              practical_id: Number(practicalId),
              code: levelCode,
              language: lang,
              status: "pending",
              marks_obtained: 0,
              level_id: levelData.id || null,
            });

            const submission = submissionRes.data.submission;
            if (!submission?.id) {
              console.error(`Failed to create submission for ${levelData.level}`);
              continue;
            }

            // Run tests for this level
            const runRes = await axios.post("/api/run", {
              code: levelCode,
              lang,
              practicalId,
              submissionId: submission.id,
              mode: "submit",
              level: levelData.level,
            });

            const levelMarks = runRes.data.marksObtained ?? 0;
            const levelPassed = runRes.data.passedTestCases ?? 0;
            const levelTotal = runRes.data.totalTestCases ?? 0;
            const levelVerdict = runRes.data.verdict || "pending";

            totalMarks += levelMarks;
            totalPassed += levelPassed;
            totalTests += levelTotal;

            const levelResults: TestCaseResult[] = (runRes.data.results || []).map(
              (r: any, idx: number) => ({
                test_case_id: Number(r.test_case_id ?? idx + 1),
                input: r.input ?? r.stdinInput ?? "",
                expected: normalizeStr(r.expected ?? r.expected_output),
                stdout: normalizeStr(r.stdout),
                error: r.error ?? r.stderr ?? null,
                status: r.status ?? "failed",
                time_ms: r.time_ms ?? null,
                memory_kb: r.memory_kb ?? null,
                is_hidden: r.is_hidden ?? false,
                stderr: r.stderr ?? undefined,
              }),
            );

            if (levelResults.length === 0) {
              throw new Error(
                runRes.data?.error ||
                `No test results returned for ${levelData.level}`,
              );
            }

            combinedResults.push(...levelResults);

            console.log(`[Submit] ${levelData.level}: ${levelVerdict} (${levelMarks} marks, ${levelPassed}/${levelTotal} tests)`);
          } catch (levelErr) {
            console.error(`Error processing level ${levelData.level}:`, levelErr);
            const msg =
              axios.isAxiosError(levelErr)
                ? (levelErr.response?.data?.error || levelErr.message)
                : (levelErr instanceof Error ? levelErr.message : String(levelErr));
            levelErrors.push(`${levelData.level}: ${msg}`);
            // Continue to next level instead of failing everything
          }
        }
      } catch (loopErr) {
        console.error("Critical error in evaluation loop:", loopErr);
      }

      if (combinedResults.length === 0) {
        throw new Error(levelErrors[0] || "No test results available after submission.");
      }

      setTestCaseResults(combinedResults);
      setScoreSummary({ passed: totalPassed, total: totalTests });
      setSubmissionStatus("evaluated");
      setShowContinueAfterSubmit(true);
      setShowFloatingResultWindow(true);
      setLastSubmittedAt(new Date().toLocaleString());
      setExpandedCases({ 0: true });
      expandResultPanel(36);
      requestAnimationFrame(() => {
        resultTabContentRef.current?.scrollTo({ top: 0 });
      });

      if (levelErrors.length > 0) {
        toast.warning(`Submitted with partial issues: ${levelErrors[0]}`);
      }

      // Stop proctoring once submission is finalized so result view is not blocked
      // and no additional violations are counted while reviewing outcomes.
      setIsSubmitted(true);

      // If exam mode, finalize the exam session using the new API
      if (isExamMode && practicalId) {
        try {
           const examIdToSubmit = resolveExamIdToSubmit();
           if (examIdToSubmit) {
             await axios.post("/api/exam/submit", { 
               examId: examIdToSubmit, 
               practicalId: Number(practicalId)
             });
             console.log("Exam finalized and attempt consumed.");
           }
        } catch (submitErr) {
           console.error("Failed to finalize exam:", submitErr);
        }
      }

      const maxTotal = levelsToSubmit.reduce((sum, l) => sum + (l.max_marks || 10), 0);
      toast.success(
        `All tasks submitted! Marks: ${totalMarks}/${maxTotal} (${totalPassed}/${totalTests} test cases passed)`,
      );
      submittedSuccessfully = true;
    } catch (err: any) {
      console.error(err);
      setSubmissionStatus("idle");
      setShowContinueAfterSubmit(false);
      setShowFloatingResultWindow(false);
      setLastSubmittedAt(null);
      toast.error(
        err?.response?.data?.error ||
        "Error submitting practical. Please try again.",
      );
    } finally {
      setLoading(false);
      setIsSubmittingFinal(false);
    }

    return submittedSuccessfully;
  };

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
    return () => {
      handleSubmitRef.current = null;
    };
  }, [handleSubmit]);

  const downloadPdf = async () => {
    try {
      setIsExporting(true);
      await generatePdfClient({
        studentName: user?.email || "Anonymous",
        rollNumber: rollNo || "N/A",
        practicalTitle: practical?.title || "Practical Submission",
        code,
        language: lang,
        submissionDate: new Date().toLocaleString(),
        status: "N/A", // This is just a download of current code, not a submission result
        output: testCaseResults
          .map(
            (r) =>
              `${r.status.toUpperCase()}: ${r.is_hidden ? "Hidden Test Case" : r.stdout}`,
          )
          .join("\n\n"),
        filename: practical?.title?.replace(/\s+/g, "_") || "code_output.pdf",
      });
      // Add a small delay to allow the browser save dialog to open/close
      // without triggering a window blur violation immediately
      setTimeout(() => setIsExporting(false), 3000);
    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500">
        Loading...
      </div>
    );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed":
        return "text-green-500";
      case "failed":
        return "text-red-500";
      case "timeout":
        return "text-orange-400";
      case "runtime_error":
        return "text-yellow-400";
      case "compile_error":
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  const formatExamTime = (remainingMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Structured sections from practical.description
  const { sections } = parseDescriptionToSections(practical?.description);
  const extractedExamples = extractExamplesFromText(
    practical?.description || sections.map((s) => s.body).join("\n\n"),
  );
  // Attempt to gather constraints
  const constraintSection =
    sections.find((s) => /constraint/i.test(s.title)) ||
    sections.find((s) => /constraint/i.test(s.body));
  const problemStmt =
    sections.find((s) => /problem/i.test(s.title))?.body ||
    sections[0]?.body ||
    practical?.description ||
    "No description available.";

  // LeetCode-style summary numbers
  const passedCount = testCaseResults.filter(
    (t) => t.status === "passed" || t.status === "accepted",
  ).length;
  const totalCount = testCaseResults.length;
  const passPercent = totalCount
    ? Math.round((passedCount / totalCount) * 100)
    : 0;
  const totalRuntime = testCaseResults.reduce((s, r) => s + (r.time_ms || 0), 0);
  const maxMemory = Math.max(...testCaseResults.map((r) => r.memory_kb || 0), 0);

  // Helper: verdict display config
  const getVerdictConfig = (status: string) => {
    switch (status) {
      case "accepted":
      case "passed":
        return { label: "Accepted", color: "emerald", icon: "✓" };
      case "wrong_answer":
        return { label: "Wrong Answer", color: "red", icon: "✗" };
      case "time_limit_exceeded":
        return { label: "TLE", color: "amber", icon: "⏱" };
      case "memory_limit_exceeded":
        return { label: "MLE", color: "purple", icon: "💾" };
      case "runtime_error":
        return { label: "Runtime Error", color: "rose", icon: "⚠" };
      case "compile_error":
        return { label: "Compile Error", color: "orange", icon: "⚙" };
      case "output_limit_exceeded":
        return { label: "Output Limit", color: "yellow", icon: "📤" };
      case "skipped_fail_fast":
        return { label: "Skipped", color: "gray", icon: "⏭" };
      default:
        return { label: status?.replace(/_/g, " ") || "Failed", color: "red", icon: "✗" };
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Session Locked Overlay */}
      {isSessionLocked && (
        <div className="fixed inset-0 z-[100] bg-gray-900 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-red-500/30">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Access Denied
            </h2>
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
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Session Invalidated
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Another login detected
                </p>
              </div>
            </div>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              Your session has been invalidated because you logged in from
              another device or browser. Your current code has been
              auto-submitted for safety.
            </p>
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800/30 mb-4">
              <svg
                className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm text-amber-700 dark:text-amber-300">
                You will be logged out in a few seconds...
              </span>
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

      {/* Floating Result Window */}
      {showFloatingResultWindow && submissionStatus === "evaluated" && testCaseResults.length > 0 && (
        <div className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl rounded-[28px] border border-white/20 dark:border-gray-700/50 bg-white dark:bg-gray-900 shadow-[0_30px_80px_rgba(15,23,42,0.35)] overflow-hidden">
            <div className={`relative px-6 md:px-8 py-6 border-b border-gray-100 dark:border-gray-800 overflow-hidden ${passedCount === totalCount
              ? "bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950/20 dark:via-teal-950/20 dark:to-cyan-950/20"
              : "bg-gradient-to-r from-red-50 via-rose-50 to-orange-50 dark:from-red-950/20 dark:via-rose-950/20 dark:to-orange-950/20"
              }`}>
              <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/40 dark:bg-white/5 blur-2xl pointer-events-none" />
              <div className="relative flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${passedCount === totalCount ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                    {passedCount === totalCount ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                    )}
                  </div>
                  <div>
                    <h3 className={`text-3xl font-black tracking-tight ${passedCount === totalCount ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {passedCount === totalCount
                        ? "Accepted"
                        : (() => {
                            const firstFail = testCaseResults.find(
                              (r) => r.status !== "passed" && r.status !== "accepted" && r.status !== "skipped_fail_fast"
                            );
                            return firstFail ? getVerdictConfig(firstFail.status).label : "Failed";
                          })()}
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mt-0.5">
                      {passedCount} / {totalCount} testcases passed
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {lastSubmittedAt ? `Submitted at ${lastSubmittedAt}` : "Just now"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowFloatingResultWindow(false)}
                  className="w-9 h-9 rounded-lg text-gray-500 hover:bg-white/70 dark:hover:bg-gray-800"
                  aria-label="Close result window"
                >
                  <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-900">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Runtime</div>
                  <div className="mt-2 text-4xl font-black text-gray-900 dark:text-white font-mono leading-none">{totalRuntime} <span className="text-3xl">ms</span></div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Total runtime across visible testcases</p>
                </div>

                <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">Memory</div>
                  <div className="mt-2 text-4xl font-black text-gray-900 dark:text-white font-mono leading-none">
                    {maxMemory > 1024 ? `${(maxMemory / 1024).toFixed(1)} MB` : `${maxMemory} KB`}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Peak memory used in judged testcases</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-3">
                  Runtime Distribution
                </div>

                {(() => {
                  const samples = testCaseResults
                    .map((r) => Number(r.time_ms || 0))
                    .filter((v) => Number.isFinite(v) && v >= 0)
                    .slice(0, 80);
                  const maxSample = samples.length > 0 ? Math.max(...samples, 1) : 1;

                  if (samples.length === 0) {
                    return (
                      <div className="h-24 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                        No runtime samples available
                      </div>
                    );
                  }

                  return (
                    <div className="h-36 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700 p-3 overflow-x-auto">
                      <div className="h-full flex items-end gap-1" style={{ minWidth: `${samples.length * 7}px` }}>
                        {samples.map((value, idx) => {
                          const pct = Math.max(6, Math.round((value / maxSample) * 100));
                          return (
                            <div
                              key={`runtime-bar-${idx}`}
                              className="w-1.5 rounded-t bg-gradient-to-t from-indigo-500 to-violet-400"
                              title={`TC ${idx + 1}: ${value} ms`}
                              style={{ height: `${pct}%` }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center justify-end gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-10 px-4 font-semibold"
                  onClick={() => setShowFloatingResultWindow(false)}
                >
                  Close
                </Button>
                <Button
                  size="sm"
                  className="h-10 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                  onClick={() => router.push("/student/submissions")}
                >
                  Continue
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Fullscreen Overlays */}

      {/* 1. Consent & Start Modal (Replaces previous simplified start) */}
      {/* 1. Consent & Start Modal (Replaces previous simplified start) */}
      {!hasExamStarted && !loading && !isSessionLocked && !isSubmitted && (
        <div className="fixed inset-0 z-[60] bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl border border-gray-200 dark:border-gray-800 text-center"
          >
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Exam Rules & Consent
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">
              Please review the following rules before starting.
            </p>

            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6 text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Full Screen Required:</span>{" "}
                  You must stay in full screen mode required for the entire
                  duration.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Focus Tracking:</span> Tab
                  switching and window blurring are monitored.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-semibold">Fair Play:</span> By starting,
                  you agree to have your session activity recorded.
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
      {hasExamStarted && !isFullscreenMode && !isSubmitted && (
        <div className="fixed inset-0 z-[60] bg-gray-900/95 backdrop-blur-md flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-2xl border border-red-500/30 text-center"
          >
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-600 dark:text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Exam Paused
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              You have exited full screen mode. You must return to full screen
              to continue the exam.
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
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
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
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium tracking-wide">
                Secure Code Editor
              </p>
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
                <div
                  className={`w-2 h-2 rounded-full ${violations > 0 ? "bg-amber-500" : "bg-emerald-500"}`}
                />
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Violations:
                  <span
                    className={`ml-1 font-bold ${violations > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}
                  >
                    {violations}/{examConfig?.max_violations ?? 3}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Exam Timer */}
          {isExamMode && examTimeRemaining !== null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-mono text-sm font-bold ${examTimeRemaining < 60000
              ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 animate-pulse"
              : examTimeRemaining < 300000
                ? "bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400"
                : "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400"
              }`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatExamTime(examTimeRemaining)}
            </div>
          )}

          {/* Assigned Set Badge */}
          {isExamMode && assignedSet && (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-400 text-sm font-bold">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              {assignedSet.set_name}
            </div>
          )}

          {/* User Info */}
          {user && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100/50 dark:border-indigo-800/30">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">
                {user.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 max-w-[120px] truncate">
                {rollNo || user.email?.split("@")[0]}
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
            <svg
              className="w-4 h-4 mr-1.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </Button>

          {/* Theme Toggle */}
          <ModeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 overflow-hidden min-h-0">
        <ResizablePanelGroup direction="horizontal" className="h-full gap-1.5">
          {/* LEFT: Problem Panel - Clean & Focused */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full overflow-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
              {/* Header Section - Sticky */}
              <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
                {/* Accent gradient bar */}
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                <div className="px-6 pt-5 pb-4">
                  {/* Title */}
                  <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-3 leading-snug tracking-tight">
                    {practical?.title || "Problem Title"}
                  </h1>

                  {/* Meta Row - Glassmorphic Badges */}
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Active Level Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border backdrop-blur-sm ${activeLevel === "Task 1"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50"
                        : activeLevel === "Task 2"
                          ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/50"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50"
                        }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${activeLevel === "Task 1"
                        ? "bg-emerald-500"
                        : activeLevel === "Task 2"
                          ? "bg-rose-500"
                          : "bg-amber-500"
                        }`} />
                      {hasLevelsParam ? activeLevel : "Standard"}
                    </span>

                    {/* Language Badge */}
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800/50 backdrop-blur-sm">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      {lang?.toUpperCase() || "JAVA"}
                    </span>

                    {/* Separator dot */}
                    {practical?.subject_name && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {practical.subject_name}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Level Selector - Premium Pill Tabs */}
                  {hasLevelsParam && practicalLevels.length > 0 && (
                    <div className="mt-4 relative flex gap-1 p-1 rounded-xl bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-700/60 shadow-inner">
                      {practicalLevels.map((level) => {
                        const isActive = activeLevel === level.level;

                        return (
                          <button
                            key={level.id}
                            onClick={() => handleSwitchLevel(level.level)}
                            className={`relative flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all duration-300 ease-out text-center ${isActive
                              ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10"
                              : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-white/40 dark:hover:bg-gray-700/40"
                              }`}
                          >
                            <span className="relative z-10 flex items-center justify-center gap-2">
                              {isActive && (
                                <span className={`w-2 h-2 rounded-full ${level.level === "Task 1"
                                  ? "bg-emerald-500"
                                  : level.level === "Task 2"
                                    ? "bg-rose-500"
                                    : "bg-amber-500"
                                  } shadow-sm`} />
                              )}
                              <span>{level.level}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${isActive
                                ? "bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                                : "bg-gray-200/60 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500"
                                }`}>
                                {level.max_marks}pts
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="px-6 py-6 space-y-8">
                {/* Problem Statement */}
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </span>
                    Description
                  </h2>
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900/50 prose-pre:border prose-pre:border-gray-100 dark:prose-pre:border-gray-800">
                    <ReactMarkdown>
                      {hasLevelsParam && practicalLevels.length > 0
                        ? practicalLevels.find((l) => l.level === activeLevel)
                          ?.description || problemStmt
                        : problemStmt}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Examples Section */}
                <div>
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </span>
                    Examples
                  </h2>
                  <div className="space-y-4">
                    {visibleExamplesFromDB && visibleExamplesFromDB.length > 0 ? (
                      visibleExamplesFromDB.map((ex, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08 }}
                          className="bg-white dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-500/20">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              Example {idx + 1}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Input
                              </div>
                              <pre className="bg-gray-50 dark:bg-gray-900/50 text-sm font-mono p-3 rounded-lg border border-gray-100 dark:border-gray-800 whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                                {ex.input}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Output
                              </div>
                              <pre className="bg-gray-50 dark:bg-gray-900/50 text-sm font-mono p-3 rounded-lg border border-gray-100 dark:border-gray-800 whitespace-pre-wrap text-gray-800 dark:text-gray-200">
                                {ex.output}
                              </pre>
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
                          className="bg-white dark:bg-gray-800/50 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-4">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-500 text-white text-xs font-bold shadow-sm shadow-emerald-500/20">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                              Example {idx + 1}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Input
                              </div>
                              <pre className="bg-gray-50 dark:bg-gray-900/50 text-sm font-mono p-3 rounded-lg border border-gray-100 dark:border-gray-800 whitespace-pre-wrap">
                                {ex.input ?? ex.raw ?? "—"}
                              </pre>
                            </div>
                            <div className="space-y-2">
                              <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                Output
                              </div>
                              <pre className="bg-gray-50 dark:bg-gray-900/50 text-sm font-mono p-3 rounded-lg border border-gray-100 dark:border-gray-800 whitespace-pre-wrap">
                                {ex.output ?? "—"}
                              </pre>
                            </div>
                          </div>
                          {ex.explanation && (
                            <div className="mt-4 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/30">
                              <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1.5">
                                <span className="text-base">💡</span> Explanation
                              </div>
                              <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                {ex.explanation}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-sm text-gray-400 italic p-8 text-center bg-gray-50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                        No examples available
                      </div>
                    )}
                  </div>
                </div>

                {/* Constraints */}
                <div className="bg-white dark:bg-gray-800/50 rounded-xl p-5 border border-amber-200 dark:border-amber-900/30 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-amber-500/5 rounded-bl-full pointer-events-none" />
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                    <span className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </span>
                    Constraints
                  </h2>
                  {constraintSection ? (
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed relative z-10">
                      {constraintSection.body}
                    </div>
                  ) : (
                    <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300 relative z-10">
                      <li className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                          ⏱
                        </span>
                        <div>
                          <div className="text-xs font-bold text-gray-500 uppercase">Time limit</div>
                          <code className="text-sm font-mono font-semibold">2000ms</code>
                        </div>
                      </li>
                      <li className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                          💾
                        </span>
                        <div>
                          <div className="text-xs font-bold text-gray-500 uppercase">Memory limit</div>
                          <code className="text-sm font-mono font-semibold">64MB</code>
                        </div>
                      </li>
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-px bg-gray-300/70 dark:bg-gray-600/70 hover:bg-indigo-500 dark:hover:bg-indigo-500 transition-colors duration-200 rounded" />

          {/* RIGHT: Code Editor + Bottom Section */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ResizablePanelGroup
              direction="vertical"
              className="relative h-full min-h-0 gap-3 rounded-2xl overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
            >
              {/* Code Editor */}
              <ResizablePanel defaultSize={100} minSize={30} className="min-h-0 overflow-hidden">
                <div className="h-full min-h-0 overflow-hidden">
                  <CodeEditor
                    code={code}
                    setCode={setCode}
                    disabled={locked}
                    disableClipboardActions={true}
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

              {!isResultPanelCollapsed && (
                <ResizableHandle className="h-px bg-gray-300/70 dark:bg-gray-600/70 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />
              )}

              {/* Bottom Section - Tabs like LeetCode */}
              <ResizablePanel
                ref={resultPanelRef}
                defaultSize={0}
                minSize={0}
                className="min-h-0 overflow-hidden"
                collapsible
                collapsedSize={0}
                onCollapse={() => setIsResultPanelCollapsed(true)}
                onExpand={() => {
                  if (!hasInitializedResultPanelRef.current) {
                    return;
                  }
                  setIsResultPanelCollapsed(false);
                }}
              >
                <div className="h-full flex flex-col bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                  {/* Tab Headers */}
                  <div
                    className={`flex-shrink-0 flex items-center justify-between px-4 bg-white dark:bg-gray-900 gap-3 ${
                      isResultPanelCollapsed
                        ? "h-11 border-b-0"
                        : "py-2 border-b border-gray-100 dark:border-gray-800"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        if (isResultPanelCollapsed) {
                          expandResultPanel(30);
                        }
                        setShowUserTestCases(false);
                      }}
                      className={`px-2.5 py-1.5 text-sm font-semibold rounded-lg transition-all ${!showUserTestCases
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                    >
                      Testcase
                    </button>
                    <span className="text-gray-300 dark:text-gray-700">|</span>
                    <button
                      onClick={() => {
                        if (isResultPanelCollapsed) {
                          expandResultPanel(30);
                        }
                        setShowUserTestCases(true);
                      }}
                      className={`px-2.5 py-1.5 text-sm font-semibold rounded-lg transition-all ${showUserTestCases
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        }`}
                    >
                      Test Result
                    </button>
                    </div>

                    <button
                      type="button"
                      onClick={toggleResultPanel}
                      className="h-7 w-7 inline-flex items-center justify-center rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                      title={isResultPanelCollapsed ? "Expand tests panel" : "Collapse tests panel"}
                    >
                      <svg
                        className={`w-4 h-4 transition-transform ${isResultPanelCollapsed ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {/* Tab Content */}
                  {!isResultPanelCollapsed && (
                    <div ref={resultTabContentRef} className="flex-1 overflow-auto bg-gray-50/50 dark:bg-gray-950/50">
                    {/* Test Case Results Tab */}
                    {!showUserTestCases && (
                      <div className="h-full p-4">
                        {testCaseResults.length > 0 && (
                          <div className={`mb-6 rounded-xl border shadow-sm overflow-hidden ${
                            passedCount === totalCount
                              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50"
                              : "bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800"
                          }`}>
                            {/* Verdict Header */}
                            <div className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${passedCount === totalCount ? "bg-emerald-500 text-white" : "bg-red-500 text-white"}`}>
                                    {passedCount === totalCount ? (
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                                    )}
                                  </div>
                                  <div>
                                    <h3 className={`text-base font-bold ${passedCount === totalCount ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
                                      {passedCount === totalCount ? "Accepted" : (
                                        (() => {
                                          const firstFail = testCaseResults.find((r) => r.status !== "passed" && r.status !== "accepted" && r.status !== "skipped_fail_fast");
                                          return firstFail ? getVerdictConfig(firstFail.status).label : "Failed";
                                        })()
                                      )}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {passedCount}/{totalCount} test cases passed
                                    </p>
                                  </div>
                                </div>

                                {/* Runtime & Memory Stats */}
                                <div className="flex items-center gap-4">
                                  {totalRuntime > 0 && (
                                    <div className="text-right">
                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Runtime</div>
                                      <div className="text-sm font-bold font-mono text-gray-900 dark:text-white">{totalRuntime} ms</div>
                                    </div>
                                  )}
                                  {maxMemory > 0 && (
                                    <div className="text-right">
                                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Memory</div>
                                      <div className="text-sm font-bold font-mono text-gray-900 dark:text-white">{maxMemory > 1024 ? `${(maxMemory / 1024).toFixed(1)} MB` : `${maxMemory} KB`}</div>
                                    </div>
                                  )}
                                  {showContinueAfterSubmit && (
                                    <Button
                                      size="sm"
                                      onClick={() => router.push("/student/submissions")}
                                      className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                                    >
                                      Continue
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="h-1 bg-gray-100 dark:bg-gray-800">
                              <div
                                className="h-full transition-all duration-700 ease-out"
                                style={{
                                  width: `${passPercent}%`,
                                  backgroundColor: passPercent === 100 ? "#10b981" : passPercent > 50 ? "#f59e0b" : "#ef4444",
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {testCaseResults.length === 0 && (
                          <div className="h-full flex flex-col items-center justify-center text-center py-8">
                            <div className="w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center mb-4 shadow-sm">
                              <svg
                                className="w-10 h-10 text-gray-300 dark:text-gray-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                />
                              </svg>
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
                              Ready to Run
                            </h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px]">
                              Click the Run button to execute your code against test cases.
                            </p>
                          </div>
                        )}

                        <div className="space-y-3">
                          {testCaseResults.map((r, idx) => {
                            const isExpanded = !!expandedCases[idx];
                            const vc = getVerdictConfig(r.status);
                            const isPassed = r.status === "passed" || r.status === "accepted";
                            const isSkipped = r.status === "skipped_fail_fast";

                            const colorMap: Record<string, { bg: string; text: string; badge: string }> = {
                              emerald: { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" },
                              red: { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-600 dark:text-red-400", badge: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800" },
                              amber: { bg: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800" },
                              purple: { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", badge: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800" },
                              rose: { bg: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-600 dark:text-rose-400", badge: "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800" },
                              orange: { bg: "bg-orange-50 dark:bg-orange-900/20", text: "text-orange-600 dark:text-orange-400", badge: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800" },
                              yellow: { bg: "bg-yellow-50 dark:bg-yellow-900/20", text: "text-yellow-600 dark:text-yellow-400", badge: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800" },
                              gray: { bg: "bg-gray-50 dark:bg-gray-900/20", text: "text-gray-500 dark:text-gray-400", badge: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700" },
                            };
                            const colors = colorMap[vc.color] || colorMap.red;

                            return (
                              <div
                                key={idx}
                                className={`rounded-xl overflow-hidden transition-all duration-200 border ${isExpanded ? "ring-1 ring-indigo-500/20 shadow-md bg-white dark:bg-gray-900 border-indigo-200 dark:border-indigo-800" : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm hover:border-gray-300 dark:hover:border-gray-600"}`}
                              >
                                <div
                                  className={`flex items-center justify-between p-3 ${r.is_hidden || isSkipped ? "cursor-default" : "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}
                                  onClick={() =>
                                    !r.is_hidden && !isSkipped &&
                                    setExpandedCases((prev) => ({
                                      ...prev,
                                      [idx]: !prev[idx],
                                    }))
                                  }
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${colors.bg} ${colors.text}`}>
                                      {isPassed ? "✓" : isSkipped ? "⏭" : idx + 1}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                                          Test Case {idx + 1}
                                        </div>
                                        {r.is_hidden && (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-100 dark:bg-gray-800 text-gray-500 uppercase tracking-wide">
                                            Hidden
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        {r.time_ms != null && r.time_ms > 0 && (
                                          <span className="text-[10px] font-mono font-medium text-gray-400 dark:text-gray-500">
                                            {r.time_ms}ms
                                          </span>
                                        )}
                                        {r.memory_kb != null && r.memory_kb > 0 && (
                                          <span className="text-[10px] font-mono font-medium text-gray-400 dark:text-gray-500">
                                            {r.memory_kb > 1024 ? `${(r.memory_kb / 1024).toFixed(1)}MB` : `${r.memory_kb}KB`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    {/* Verdict badge */}
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${colors.badge}`}>
                                      <span>{vc.icon}</span>
                                      {vc.label}
                                    </span>
                                    {!r.is_hidden && !isSkipped && (
                                      <svg
                                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>

                                {isExpanded && !r.is_hidden && !isSkipped && (
                                  <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                    {/* Stderr banner for errors */}
                                    {(() => {
                                      const rawError = r.error || r.stderr;
                                      if (!rawError || !ERROR_PANEL_STATUSES.has(r.status)) {
                                        return null;
                                      }

                                      const readableError = cleanErrorForDisplay(rawError);
                                      if (!readableError) {
                                        return null;
                                      }

                                      const quickHint = getQuickFixHint(
                                        readableError,
                                        r.status,
                                        lang,
                                      );

                                      return (
                                        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
                                          <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1">
                                            {getErrorPanelTitle(r.status)}
                                          </div>
                                          <pre className="text-xs font-mono text-red-700 dark:text-red-300 whitespace-pre-wrap">
                                            {readableError}
                                          </pre>
                                          {quickHint && (
                                            <div className="mt-2 text-[11px] text-red-700 dark:text-red-300">
                                              <span className="font-semibold">Tip:</span> {quickHint}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })()}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                          Input
                                        </div>
                                        <pre className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                          {r.input}
                                        </pre>
                                      </div>
                                      <div>
                                        <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                          Expected Output
                                        </div>
                                        <pre className="bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-mono whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                                          {r.expected || "—"}
                                        </pre>
                                      </div>
                                    </div>

                                    <div className="mt-4">
                                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                                        Your Output
                                      </div>
                                      <div className="relative">
                                        <pre className={`p-3 rounded-lg border text-xs font-mono whitespace-pre-wrap ${!isPassed ? "bg-red-50/50 dark:bg-red-900/5 border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-300" : "bg-white dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"}`}>
                                          {r.stdout || (
                                            <span className="italic text-gray-400">No output</span>
                                          )}
                                        </pre>
                                        {isPassed && (
                                          <div className="absolute top-2 right-2 text-emerald-500">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Metrics bar */}
                                    {(r.time_ms || r.memory_kb) && (
                                      <div className="mt-3 flex items-center gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                                        {r.time_ms != null && r.time_ms > 0 && (
                                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            <span>⏱</span>
                                            <span className="font-mono font-semibold">{r.time_ms} ms</span>
                                          </div>
                                        )}
                                        {r.memory_kb != null && r.memory_kb > 0 && (
                                          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                            <span>💾</span>
                                            <span className="font-mono font-semibold">{r.memory_kb > 1024 ? `${(r.memory_kb / 1024).toFixed(1)} MB` : `${r.memory_kb} KB`}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Custom Test Cases Tab */}
                    {showUserTestCases && (
                      <div className="h-full flex flex-col bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-gray-900/50 dark:to-gray-800/50">
                        {/* Fixed Header */}
                        <div className="flex-shrink-0 p-4 border-b border-blue-200 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Add your own test inputs
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setUserTestCases([
                                  ...userTestCases,
                                  {
                                    id: userTestCases.length + 1,
                                    input: "",
                                    time_limit_ms: 2000,
                                    memory_limit_kb: 65536,
                                    expectedOutput: "",
                                  },
                                ])
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
                                    <span className="font-semibold text-gray-800 dark:text-gray-200">
                                      Case {idx + 1}
                                    </span>
                                  </div>
                                  {userTestCases.length > 1 && (
                                    <button
                                      className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-3 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 font-medium"
                                      onClick={() =>
                                        setUserTestCases(
                                          userTestCases.filter(
                                            (_, i) => i !== idx,
                                          ),
                                        )
                                      }
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>

                                <label className="block text-xs font-bold mb-2 text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                                  Input
                                </label>
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
                  )}
                </div>
              </ResizablePanel>

              {isResultPanelCollapsed && (
                <button
                  type="button"
                  onClick={() => expandResultPanel(30)}
                  className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white/95 px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50 dark:border-blue-900/60 dark:bg-gray-900/95 dark:text-blue-300 dark:hover:bg-blue-950/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7-7-7" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-7 7-7-7" />
                  </svg>
                  <span>Tests</span>
                </button>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div >
  );
}

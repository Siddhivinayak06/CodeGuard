"use client";

import React, { useCallback, useEffect, useRef, useState, useMemo } from "react";
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

export default function EditorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);

  const practicalId = searchParams?.get("practicalId");

  const [lang, setLang] = useState("python");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { violations, locked } = useProctoring(3);
  const [practical, setPractical] = useState<any>(null);

  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);

  const [testCaseResults, setTestCaseResults] = useState<TestCaseResult[]>([]);
  const [scoreSummary, setScoreSummary] = useState<{ passed: number; total: number }>({ passed: 0, total: 0 });
  const [submissionStatus, setSubmissionStatus] = useState<"idle" | "pending" | "evaluated" | "submitted">("idle");

  // ========================
  // Auth
  // ========================
  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) router.push("/auth/login");
      else if (mountedRef.current) setUser(data.user);
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
    };
    fetchPractical();
  }, [practicalId, supabase]);

  // ========================
  // Sign out
  // ========================
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const runCode = async () => {
    if (!code || !practicalId || !user) return;

    setLoading(true);
    setTestCaseResults([]);
    setScoreSummary({ passed: 0, total: 0 });

    try {
      const submissionRes = await axios.post("/api/submission/create", {
        student_id: user.id,
        practical_id: Number(practicalId),
        code,
        language: lang,
        status: "pending",
      });

      const submission = submissionRes.data.submission;
      if (!submission?.id) throw new Error("Failed to create submission");
      const submissionId = submission.id;

      const runRes = await axios.post("/api/run", {
        code,
        lang,
        practicalId: Number(practicalId),
        submissionId,
      });

      const data = runRes.data;
      if (!data?.results) return;

      const visibleResults = data.results.map((r: any) => ({
        ...r,
        is_hidden: r.is_hidden,
      }));

      setTestCaseResults(visibleResults);
      setScoreSummary({
        passed: visibleResults.filter((r: any) => r.status === "passed").length,
        total: visibleResults.length,
      });

      setSubmissionStatus("evaluated");
    } catch (err) {
      console.error(err);
      alert("Error running code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!code || !practicalId || !user) return;

    setLoading(true);
    try {
      const total = scoreSummary.total || 1;
      const marksOutOf10 = Math.round((scoreSummary.passed / total) * 10);

      const submissionRes = await axios.post("/api/submission/create", {
        student_id: user.id,
        practical_id: Number(practicalId),
        code,
        language: lang,
        status: "submitted",
        marks_obtained: marksOutOf10,
      });

      const submission = submissionRes.data.submission;
      if (!submission?.id) throw new Error("Failed to submit");

      setSubmissionStatus("submitted");
      alert("Practical submitted successfully!");
    } catch (err) {
      console.error(err);
      alert("Error submitting practical. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      await generatePdfClient({
        code,
        output: testCaseResults.map((r) => `${r.status.toUpperCase()}: ${r.stdout}`).join("\n\n"),
        user: user?.email || "Anonymous",
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

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-100 via-white/30 to-gray-200 dark:from-gray-900 dark:via-gray-800/40 dark:to-gray-900 backdrop-blur-sm">
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-6 border-b border-gray-300 dark:border-gray-700 backdrop-blur-md bg-white/30 dark:bg-gray-900/30 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          {practical?.title || "Code Editor"}
        </h1>
        <div className="flex items-center gap-4">
          {locked && <div className="px-3 py-1 text-sm bg-red-200/30 text-red-600 rounded-full backdrop-blur-sm">Session Locked</div>}
          <div className="text-sm text-gray-600 dark:text-gray-400">Violations: <span className="font-semibold text-red-600 dark:text-red-400">{violations}/3</span></div>
          <Button variant="outline" onClick={handleSignOut}>Sign Out</Button>
          <ModeToggle />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full gap-4">
          {/* Left: Practical description */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full p-4 overflow-auto bg-white/10 dark:bg-gray-800/30 backdrop-blur-md rounded-2xl shadow-inner border border-gray-300 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">Practical Question</h2>
              <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{practical?.description || "No description available."}</div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

          {/* Right: Code editor + test case results */}
          <ResizablePanel defaultSize={60} minSize={40}>
            <ResizablePanelGroup direction="vertical" className="h-full gap-3 rounded-2xl overflow-hidden">
              {/* Code editor */}
              <ResizablePanel defaultSize={70} minSize={30}>
                <CodeEditor
                  code={code}
                  setCode={setCode}
                  disabled={locked}
                  onRun={runCode}
                  onDownload={downloadPdf}
                  onSubmit={handleSubmit}
                  loading={loading}
                  locked={locked}
                  lang={lang}
                  onLangChange={setLang}
                  showInputToggle={false}
                  showInput={false}
                  setShowInput={() => {}}
                  terminalRef={null}
                />
              </ResizablePanel>

              <ResizableHandle className="h-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

              {/* Test cases */}
              <ResizablePanel defaultSize={30} minSize={10}>
                {testCaseResults.length > 0 ? (
                  <div className="h-full overflow-auto p-3 bg-white/10 dark:bg-gray-900/30 backdrop-blur-md rounded-xl border border-gray-300 dark:border-gray-700">
                    <div className="mb-4 p-2 bg-gray-100 dark:bg-gray-800 rounded text-center">
                      {(() => {
                        const total = scoreSummary.total || 1;
                        const marksOutOf10 = Math.round((scoreSummary.passed / total) * 10);
                        return <strong>Marks: {marksOutOf10}/10</strong>;
                      })()}
                    </div>
                    {testCaseResults.map((tc, idx) => (
                      <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-xl mb-2 p-3 bg-white/20 dark:bg-gray-800/20 shadow-inner">
                        <div className="flex justify-between items-center mb-1">
                          <div className="font-medium">Test #{idx + 1} {tc.is_hidden && "(hidden)"}</div>
                          <div className={`font-semibold ${getStatusColor(tc.status)}`}>{tc.status.toUpperCase()}</div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                          <div><strong>Input:</strong> <pre className="whitespace-pre-wrap">{tc.input}</pre></div>
                          <div><strong>Expected:</strong> <pre className="whitespace-pre-wrap">{tc.expected}</pre></div>
                          <div><strong>Output:</strong> <pre className="whitespace-pre-wrap">{tc.stdout}</pre></div>
                          {tc.error && <div className="text-red-400"><strong>Error:</strong> {tc.error}</div>}
                          <div>Time: {tc.time_ms ?? "-"} ms • Memory: {tc.memory_kb ?? "-"} KB</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                    Run code to see test case results
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

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
const [userTestCases, setUserTestCases] = useState([{ id: 1, input: "" }]);

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
  if (!userTestCases.length) {
    alert("Please add at least one test case!");
    return;
  }

  setLoading(true);
  setTestCaseResults([]);
  setSubmissionStatus("pending");

  try {
    const payload = {
      code, // user code
      lang,
      practicalId,
      submissionId: practical?.submission_id || 1,
      userTestCases: userTestCases.map(tc => ({ input: tc.input })),
    };

    const res = await axios.post("/api/run", payload);

    // Only user test cases are returned from API now
    const results: TestCaseResult[] = res.data.results || [];

    setTestCaseResults(results);
    setSubmissionStatus(res.data.verdict || "evaluated");

  } catch (err: any) {
    console.error(err);
    alert(err?.response?.data?.error || "Error running code. Try again!");
  } finally {
    setLoading(false);
  }
};
const handleSubmit = async () => {
  if (!code || !practicalId || !user) return;

  setLoading(true);
  try {
    // 1️⃣ CREATE SUBMISSION FIRST (with pending status)
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

    // 2️⃣ NOW RUN WITH THE NEW SUBMISSION ID
    const runRes = await axios.post("/api/run", {
      code,
      lang,
      practicalId,
      submissionId: submission.id,  // ← Use the NEW submission ID
      mode: "submit",
    });

    const verdict = runRes.data.verdict || "evaluated";
    const marksObtained = runRes.data.marksObtained ?? 0;
    const passedTestCases = runRes.data.passedTestCases ?? 0;
    const totalTestCases = runRes.data.totalTestCases ?? 0;

    // 3️⃣ The /api/run already updates the submission with marks in the database
    // Just update the UI state
    setSubmissionStatus(verdict === "evaluated" ? "evaluated" : "submitted");
    alert(`Practical submitted successfully! Marks: ${marksObtained} / 10 (${passedTestCases}/${totalTestCases} test cases passed)`);
    
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
        {locked && (
          <div className="px-3 py-1 text-sm bg-red-200/30 text-red-600 rounded-full backdrop-blur-sm">
            Session Locked
          </div>
        )}
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Violations:{" "}
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
        {/* Left: Practical description */}
        <ResizablePanel defaultSize={40} minSize={20}>
          <div className="h-full p-4 overflow-auto bg-white/10 dark:bg-gray-800/30 backdrop-blur-md rounded-2xl shadow-inner border border-gray-300 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Practical Question
            </h2>
            <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">
              {practical?.description || "No description available."}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

        {/* Right: Code Editor + Test Cases + Results */}
        <ResizablePanel defaultSize={60} minSize={40}>
          <ResizablePanelGroup direction="vertical" className="h-full gap-3 rounded-2xl overflow-hidden">
            
            {/* Code Editor */}
            <ResizablePanel defaultSize={50} minSize={20}>
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
                  setShowInput={() => {}}
                  terminalRef={null}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle className="h-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

{/* User Test Cases */}
<ResizablePanel defaultSize={25} minSize={20}>
  <div className="h-full overflow-auto p-4 bg-white/10 dark:bg-gray-900/30 backdrop-blur-md rounded-xl border border-gray-300 dark:border-gray-700">
    <div className="flex justify-between items-center mb-3">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
        Your Test Cases
      </h3>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setUserTestCases([...userTestCases, { id: userTestCases.length + 1, input: "" }])
        }
      >
        ➕ Add Test Case
      </Button>
    </div>

    {userTestCases.map((tc, idx) => (
      <div
        key={idx}
        className="mb-4 p-3 bg-white/20 dark:bg-gray-800/20 rounded-xl border border-gray-300 dark:border-gray-700"
      >
        <div className="flex justify-between items-center mb-2">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Case #{idx + 1}
          </span>
          {userTestCases.length > 1 && (
            <button
              className="text-sm text-red-500 hover:underline"
              onClick={() =>
                setUserTestCases(userTestCases.filter((_, i) => i !== idx))
              }
            >
              Delete
            </button>
          )}
        </div>

        <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-400">
          Input
        </label>
        <textarea
          className="w-full p-2 rounded border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-800 dark:text-gray-200"
          rows={2}
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
</ResizablePanel>

<ResizableHandle className="h-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-600 transition-colors duration-200 rounded" />

{/* Test Case Results */}
<ResizablePanel defaultSize={25} minSize={15}>
  <div className="h-full overflow-auto p-4 bg-white/10 dark:bg-gray-900/30 backdrop-blur-md rounded-xl border border-gray-300 dark:border-gray-700">
    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
      Test Case Results
    </h3>

    {testCaseResults.length === 0 && (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Run your test cases to see results here.
      </div>
    )}

    {testCaseResults.map((r, idx) => (
      <div
        key={idx}
        className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-4 bg-white/30 dark:bg-gray-800/30 shadow-sm"
      >
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Case #{idx + 1}
          </span>
          <span
            className={`text-sm font-semibold ${
              r.status === "passed"
                ? "text-green-600 dark:text-green-400"
                : r.status === "failed"
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-400"
            }`}
          >
            {r.status.toUpperCase()}
          </span>
        </div>

        <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
          <div>
            <strong>Input:</strong>
            <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded">{userTestCases[idx]?.input ?? "N/A"}</pre>
          </div>
          <div>
            <strong>Expected Output:</strong>
            <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded">{r.expected ?? "N/A"}</pre>
          </div>
          <div>
            <strong>Output:</strong>
            <pre className="bg-gray-100 dark:bg-gray-700 p-2 rounded">{r.stdout}</pre>
          </div>
          {r.error && (
            <div className="text-red-500">
              <strong>Error:</strong> {r.error}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>
</ResizablePanel>



          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  </div>
);}

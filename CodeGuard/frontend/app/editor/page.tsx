"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/CodeEditor";
import OutputPane from "@/components/OutputPane";
import InputPane from "@/components/InputPane";
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

export default function EditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mountedRef = useRef(true);

  // ✅ Extract params from query
  const practicalId = searchParams.get("practicalId");
  const subjectId = searchParams.get("subject");

  const [lang, setLang] = useState("python");
  const [code, setCode] = useState("");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [errorOutput, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { violations, locked } = useProctoring(3);
  const [showInput, setShowInput] = useState(true);
  const [showInputToggle, setShowInputToggle] = useState(true);
  const terminalRef = useRef(null);

  const [practical, setPractical] = useState<any>(null);

  const supabase = useMemo(() => (typeof window !== "undefined" ? createClient() : null), []);
  const [user, setUser] = useState<User | null>(null);

  // ✅ Auth check
  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) router.push("/auth/login");
        else if (mountedRef.current) setUser(data.user);
      } catch (err) {
        console.error("fetchUser error:", err);
        router.push("/auth/login");
      }
    };
    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // ✅ Fetch practical details
  useEffect(() => {
    if (!practicalId) return;
    const fetchPractical = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/student/practical/${practicalId}`
        );
        const data = await res.json();
        setPractical(data);
        setCode(data?.starter_code || "# Start coding here...\n");
        setLang(data?.language || "python");
      } catch (err) {
        console.error("Failed to load practical:", err);
      }
    };
    fetchPractical();
  }, [practicalId]);

  // ✅ Sign out
  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // ✅ Run code
  const runCode = async () => {
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5002"}/execute`,
        { code, lang, stdinInput: input }
      );
      setOutput(res.data.output);
      setError(res.data.error);
    } catch {
      setError("Execution failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Submit code
  const handleSubmit = async () => {
    if (!user || !practicalId) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/student/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: user.id,
          practical_id: practicalId,
          subject_id: subjectId,
          code,
          language: lang,
          output,
          status: errorOutput ? "Failed" : "Success",
        }),
      });

      if (!res.ok) throw new Error("Submission failed");
      alert("✅ Submission successful!");
      router.push("/dashboard/student/submissions");
    } catch (err) {
      console.error(err);
      alert("❌ Submission failed. Please try again.");
    }
  };

  // ✅ Download PDF
  const downloadPdf = async () => {
    try {
      await generatePdfClient({
        code,
        output,
        user: user?.email || "Anonymous",
        filename: practical?.title
          ? `${practical.title.replace(/\s+/g, "_")}.pdf`
          : "code_output.pdf",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError("PDF generation failed.");
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="h-12 bg-white dark:bg-gray-800 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            {practical ? practical.title : "Code Editor"}
          </h1>
          {practical?.deadline && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Deadline: {new Date(practical.deadline).toLocaleDateString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          {locked && (
            <div className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
              Session Locked
            </div>
          )}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Violations:{" "}
            <span className="text-red-600 dark:text-red-400 font-semibold">
              {violations}
            </span>
            /3
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>
          <ModeToggle />
        </div>
      </div>

      {/* Description */}
      {practical?.description && (
        <div className="bg-white/10 dark:bg-gray-800/30 border-b border-gray-700/40 px-6 py-2 text-gray-700 dark:text-gray-300 text-sm">
          {practical.description}
        </div>
      )}

      {/* Code Editor */}
      <div className="flex-1 p-4">
        <div className="h-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize={60} minSize={30}>
              <CodeEditor
                code={code}
                setCode={setCode}
                disabled={locked}
                onRun={runCode}
                onDownload={downloadPdf}
                onSubmit={handleSubmit} // ✅ add submit action
                loading={loading}
                locked={locked}
                lang={lang}
                onLangChange={setLang}
                showInput={showInput}
                setShowInput={setShowInput}
                showInputToggle={showInputToggle}
                terminalRef={terminalRef}
              />
            </ResizablePanel>

            <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

            <ResizablePanel defaultSize={40} minSize={20}>
              {showInput ? (
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={20} minSize={10}>
                    <InputPane onChange={setInput} />
                  </ResizablePanel>

                  <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

                  <ResizablePanel defaultSize={50} minSize={20}>
                    <OutputPane output={output} error={errorOutput} language={lang} />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                <OutputPane output={output} error={errorOutput} language={lang} />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      {/* Footer Submit Button */}
      <div className="p-4 flex justify-end border-t border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm">
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={handleSubmit}
          disabled={locked || loading}
        >
          Submit Practical
        </Button>
      </div>
    </div>
  );
}

"use client";
import { useState } from "react";
import axios from "axios";
import CodeEditor from "../components/CodeEditor";
import OutputPane from "../components/OutputPane";
import useProctoring from "../hooks/useProctoring";
import { ModeToggle } from "../components/ModeToggle";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function Home() {
  const [code, setCode] = useState("# Write Python code here\n");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { violations, locked } = useProctoring(3);

  const runCode = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.post("http://localhost:5000/execute", { code });
      setOutput(res.data.output);
      setError(res.data.error);
    } catch {
      setError("Execution failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await axios.post(
        "http://localhost:5000/export-pdf",
        { code, output },
        { responseType: "blob" }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "code_output.pdf");
      document.body.appendChild(link);
      link.click();
    } catch {
      setError("PDF generation failed.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-100 via-purple-50 to-slate-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 transition-colors duration-300">
      {/* Header */}
      <header className="h-[80px] flex flex-col sm:flex-row sm:items-center sm:justify-between p-6 bg-white/20 dark:bg-black/20 backdrop-blur-sm border-b border-gray-200/20 dark:border-white/10">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
            Python Code Editor
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Violations:{" "}
            <span className="font-semibold text-red-600 dark:text-red-400">
              {violations}
            </span>{" "}
            / 3
          </p>
        </div>

        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          {locked && (
            <div className="px-3 py-1 rounded-full bg-red-500/20 backdrop-blur-sm border border-red-400/30">
              <span className="text-red-700 dark:text-red-300 font-medium text-sm">
                Session Locked
              </span>
            </div>
          )}
          <ModeToggle />
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 p-6 h-[calc(100vh-80px)]">
        <ResizablePanelGroup
          direction="vertical"
          className="h-full rounded-xl overflow-hidden backdrop-blur-sm bg-white/30 dark:bg-white/5 border border-gray-200/30 dark:border-white/10 shadow-2xl"
        >
          {/* Code Editor Panel */}
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full flex flex-col">
              <div className="flex-1 p-6">
                <CodeEditor
                  code={code}
                  setCode={setCode}
                  disabled={locked}
                  onRun={runCode}
                  onDownload={downloadPdf}
                  loading={loading}
                  locked={locked}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle className="bg-gray-200/50 dark:bg-white/10 hover:bg-gray-300/70 dark:hover:bg-white/20 transition-colors duration-200" />

          {/* Output Panel */}
          <ResizablePanel defaultSize={40} minSize={20}>
            <div className="h-full flex flex-col">
              <div className="p-4 bg-gradient-to-r from-gray-100/60 to-gray-50/60 dark:from-gray-900/20 dark:to-gray-800/20 backdrop-blur-md border-b border-gray-200/30 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                    Output
                  </h2>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-auto">
                {error && !loading && (
                  <div className="mb-4 p-4 rounded-lg bg-red-500/10 backdrop-blur-sm border border-red-400/30 text-red-700 dark:text-red-300">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-5 h-5 text-red-500 dark:text-red-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="font-medium">Error</span>
                    </div>
                    <div className="mt-2 font-mono text-sm">{error}</div>
                  </div>
                )}
                <OutputPane output={output} error={error} />
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

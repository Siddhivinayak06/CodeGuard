"use client";
import { useState } from "react";
import api from "@/libs/api"; // ✅ centralized axios
import CodeEditor from "@/components/CodeEditor";
import OutputPane from "@/components/OutputPane";
import InputPane from "@/components/InputPane";
import useProctoring from "@/hooks/useProctoring";
import { ModeToggle } from "@/components/ModeToggle";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

export default function Home() {
  const [lang, setLang] = useState("python"); // ✅ default: Python
  const [code, setCode] = useState(
    "# Welcome to Python Code Editor\n# Write your Python code here\n\nprint('Hello, World!')\n"
  );
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { violations, locked } = useProctoring(3);
  const [showInput, setShowInput] = useState(true); // ✅ toggle state

  const runCode = async () => {
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await api.post("/execute", { code, lang, stdinInput: input });
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
      const res = await api.post(
        "/export-pdf",
        { code, output, lang }, // ✅ removed user info
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
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="h-12 bg-white dark:bg-gray-800 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
            Code Editor
          </h1>
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

          <ModeToggle />
        </div>
      </div>

      {/* Main Layout */}
      <div className="flex-1 p-4">
        <div className="h-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <ResizablePanelGroup direction="vertical" className="h-full">
            {/* Editor Panel */}
            <ResizablePanel defaultSize={60} minSize={30}>
              <CodeEditor
                code={code}
                setCode={setCode}
                disabled={locked}
                onRun={runCode}
                onDownload={downloadPdf}
                loading={loading}
                locked={locked}
                lang={lang}
                setLang={setLang}
                showInput={showInput}       // ✅ pass toggle props
                setShowInput={setShowInput} // ✅ pass toggle props
              />
            </ResizablePanel>

            <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

            {/* Input + Output */}
            <ResizablePanel defaultSize={40} minSize={20}>
              {showInput ? (
                <ResizablePanelGroup direction="horizontal">
                  {/* Input Pane */}
                  <ResizablePanel defaultSize={20} minSize={10}>
                    <InputPane onChange={setInput} />
                  </ResizablePanel>

                  <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

                  {/* Output Pane */}
                  <ResizablePanel defaultSize={50} minSize={20}>
                    <OutputPane output={output} error={error} language={lang} />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                // ✅ Auto-expand Output if Input hidden
                <OutputPane output={output} error={error} language={lang} />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
            <ResizablePanel defaultSize={60} minSize={30}>
              <CodeEditor
                code={code}
                setCode={setCode}
                disabled={locked}
                onRun={runCode}
                onDownload={downloadPdf}
                loading={loading}
                locked={locked}
                lang={lang}
                setLang={setLang}
                showInput={showInput}       // ✅ pass toggle props
                setShowInput={setShowInput} // ✅ pass toggle props
              />
            </ResizablePanel>

            <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

            {/* Input + Output */}
            <ResizablePanel defaultSize={40} minSize={20}>
              {showInput ? (
                <ResizablePanelGroup direction="horizontal">
                  {/* Input Pane */}
                  <ResizablePanel defaultSize={20} minSize={10}>
                    <InputPane onChange={setInput} />
                  </ResizablePanel>

                  <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

                  {/* Output Pane */}
                  <ResizablePanel defaultSize={50} minSize={20}>
                    <OutputPane output={output} error={error} language={lang} />
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                // ✅ Auto-expand Output if Input hidden
                <OutputPane output={output} error={error} language={lang} />
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

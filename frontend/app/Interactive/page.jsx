"use client";
import { useState, useRef } from "react"; // ✅ added useRef
import dynamic from "next/dynamic"; // ✅ import dynamic
import CodeEditor from "@/components/CodeEditor";
import useProctoring from "@/hooks/useProctoring";
import { ModeToggle } from "@/components/ModeToggle";
import axios from "axios";

import { generatePdfClient } from "@/lib/ClientPdf";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

// ✅ dynamically import InteractiveTerminal with SSR disabled
const InteractiveTerminal = dynamic(
  () => import("@/components/InteractiveTerminal"),
  { ssr: false }
);

export default function Home() {
  const [lang, setLang] = useState("python");
  const [code, setCode] = useState(
    "# Welcome to Python Code Editor\n# Write your Python code here\n\nprint('Hello, World!')\n"
  );
  const { violations, locked } = useProctoring(3);

  // ✅ create ref for InteractiveTerminal
  const interactiveTerminalRef = useRef(null);

 const terminalRef = useRef(null); // ✅ should be defined at the top of the parent component
const [interactiveOutput, setInteractiveOutput] = useState("");

// inside Home component
const downloadPdf = async () => {
  if (!interactiveOutput) {
    alert("No output captured yet!");
    return;
  }

  try {
    await generatePdfClient({
      code,
      output: interactiveOutput,
      user: "Anonymous", // replace with user email if needed
      filename: "interactive_code_output.pdf",
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("PDF generation failed!");
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
                onDownload={downloadPdf}
                locked={locked}
                lang={lang}
                onLangChange={setLang}
                showInputToggle={false}
                terminalRef={terminalRef}
                  onRun={() => {
                      console.log("Run button clicked!");  // <- check this
    if (interactiveTerminalRef.current) {
      interactiveTerminalRef.current.startExecution(code, lang);
    } else {
      console.error("Interactive terminal not ready yet");
    }
  }}
              />
            </ResizablePanel>

            <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

            {/* Interactive Terminal Panel */}
            <ResizablePanel defaultSize={40} minSize={20}>
              {/* ✅ Pass ref down */}
              <InteractiveTerminal
                ref={interactiveTerminalRef}
                wsUrl="ws://localhost:5001"
                fontSize={16}
                fontFamily="Fira Code, monospace"
                onOutput={(data) => setInteractiveOutput(prev => prev + data)}
              />

            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
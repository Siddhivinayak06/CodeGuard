"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import axios from "axios";
import { ChevronDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import CodeEditor from "@/components/CodeEditor";
import OutputPane from "@/components/OutputPane";
import InputPane from "@/components/InputPane";
import useProctoring from "@/hooks/useProctoring";
import { ModeToggle } from "@/components/ModeToggle";
import { generatePdfClient } from "@/lib/ClientPdf";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Play, Download, Send, Eye, EyeOff, Sparkles, Loader2 } from "lucide-react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssistantPanel } from "@/components/AssistantPanel";

export default function EditorPage() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const pathname = usePathname();

  const LANGUAGE_TEMPLATES: Record<string, string> = {
    java: `// Java starter template
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
`,
    python: `# Python starter template
print("Hello, World!")
`,
    c: `// C starter template
#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");
    return 0;
}
`,
    cpp: `// C++ starter template
#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}
`,
  };

  const [lang, setLang] = useState<"java" | "python" | "c" | "cpp">("java");
  const [code, setCode] = useState<string>(LANGUAGE_TEMPLATES["java"]);
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [errorOutput, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { violations, locked } = useProctoring(3);
  const [showInput, setShowInput] = useState(true);
  const [showInputToggle, setShowInputToggle] = useState(true);
  const terminalRef = useRef(null);

  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [currentMode, setCurrentMode] = useState("Static");
  const [showAssistant, setShowAssistant] = useState(false);

  useEffect(() => {
    if (pathname === "/Interactive") setCurrentMode("Interactive");
    else setCurrentMode("Static");
  }, [pathname]);

  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          router.push("/auth/login");
        } else if (mountedRef.current) {
          setUser(data.user);
        }
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

  const handleModeChange = (mode: "Static" | "Interactive", path: string) => {
    setCurrentMode(mode);
    router.push(path);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleLangChange = (newLang: "java" | "python" | "c" | "cpp") => {
    setLang(newLang);
    const currentTemplate = LANGUAGE_TEMPLATES[lang];
    const nextTemplate = LANGUAGE_TEMPLATES[newLang];
    if (!code || code.trim() === "" || code === currentTemplate) {
      setCode(nextTemplate);
    }
  };

  const runCode = async () => {
    setLoading(true);
    setError("");
    setOutput("");
    try {
      const res = await axios.post(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5002"}/execute`,
        { code, lang, stdinInput: input }
      );
      setOutput(res.data.output ?? "");
      setError(res.data.error ?? "");
    } catch (err) {
      console.error("runCode error:", err);
      setError("Execution failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      await generatePdfClient({
        studentName: user?.email || user?.user_metadata?.full_name || "Anonymous",
        rollNumber: "N/A",
        practicalTitle: "Code Compilation",
        code,
        language: lang,
        submissionDate: new Date().toLocaleString(),
        status: errorOutput ? "Failed" : "Compiled",
        output: output || errorOutput,
        filename: "code_output.pdf",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      setError("PDF generation failed.");
    }
  };

  const resetCode = () => {
    if (confirm("Are you sure you want to reset the code to the default template? This will erase your current code.")) {
      setCode(LANGUAGE_TEMPLATES[lang]);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="flex-1 mt-16 p-4 h-[calc(100vh-4rem)] w-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="h-full w-full glass-card-premium rounded-3xl shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800/50"
        >
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={showAssistant ? 75 : 100} minSize={50}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={60} minSize={30}>
                  <CodeEditor
                    code={code}
                    setCode={setCode}
                    disabled={locked}
                    onRun={runCode}
                    onDownload={downloadPdf}
                    onSubmit={runCode}
                    loading={loading}
                    locked={locked}
                    lang={lang}
                    onLangChange={(l) => handleLangChange(l as "java" | "python" | "c" | "cpp")}
                    showInput={showInput}
                    setShowInput={setShowInput}
                    showInputToggle={showInputToggle}
                    terminalRef={terminalRef}
                    violations={violations}
                    isFullscreen={true}
                    externalShowAssistant={showAssistant}
                    externalSetShowAssistant={setShowAssistant}
                    renderAssistantExternally={true}
                    onReset={resetCode}
                  />
                </ResizablePanel>

                <ResizableHandle className="h-2 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-indigo-500/50 transition-colors duration-300 flex items-center justify-center group outline-none">
                  <div className="w-16 h-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-white/80 transition-colors" />
                </ResizableHandle>

                <ResizablePanel defaultSize={40} minSize={20} className="bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-md">
                  {showInput ? (
                    <ResizablePanelGroup direction="horizontal">
                      <ResizablePanel defaultSize={20} minSize={10}>
                        <div className="h-full flex flex-col">
                          <div className="px-4 py-2 bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">Input</span>
                          </div>
                          <div className="flex-1">
                            <InputPane onChange={setInput} />
                          </div>
                        </div>
                      </ResizablePanel>

                      <ResizableHandle className="w-2 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-indigo-500/50 transition-colors duration-300 flex items-center justify-center group outline-none">
                        <div className="h-16 w-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-white/80 transition-colors" />
                      </ResizableHandle>

                      <ResizablePanel defaultSize={50} minSize={20}>
                        <div className="h-full flex flex-col">
                          <div className="px-4 py-2 bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-400/80" />
                            <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                            <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                            <span className="ml-2 text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">Console Output</span>
                          </div>
                          <div className="flex-1">
                            <OutputPane output={output} error={errorOutput} language={lang} />
                          </div>
                        </div>
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  ) : (
                    <div className="h-full flex flex-col">
                      <div className="px-4 py-2 bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-400/80" />
                        <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                        <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                        <span className="ml-2 text-xs font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">Console Output</span>
                      </div>
                      <div className="flex-1">
                        <OutputPane output={output} error={errorOutput} language={lang} />
                      </div>
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            {showAssistant && (
              <>
                <ResizableHandle className="w-2 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-indigo-500/50 transition-colors duration-300 flex items-center justify-center group outline-none">
                  <div className="h-16 w-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-white/80 transition-colors" />
                </ResizableHandle>
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-l border-white/20 dark:border-gray-800/50">
                  <AssistantPanel
                    codeContext={{
                      code: code,
                      activeFile: "main." + (lang === "python" ? "py" : lang === "java" ? "java" : "c"),
                      files: [],
                      cursorPosition: { lineNumber: 1, column: 1 }
                    }}
                    onClose={() => setShowAssistant(false)}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </motion.div>
      </div>
    </div>
  );
}

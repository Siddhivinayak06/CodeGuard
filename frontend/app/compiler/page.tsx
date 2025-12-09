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
  };

  const [lang, setLang] = useState<"java" | "python" | "c">("java");
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

  const handleLangChange = (newLang: "java" | "python" | "c") => {
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

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      {/* Glass Navbar */}

      {/* Editor Section: fills remaining space, full width and height minus navbar */}
      <div className="flex-1 pt-16">
        <div className="h-full w-full rounded-2xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-md shadow-lg overflow-hidden border border-gray-200/50 dark:border-gray-700/50">
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
                    onSubmit={runCode} // submit still calls runCode (change if needed)
                    loading={loading}
                    locked={locked}
                    lang={lang}
                    onLangChange={(l) => handleLangChange(l as "java" | "python" | "c")}
                    showInput={showInput}
                    setShowInput={setShowInput}
                    showInputToggle={showInputToggle}
                    terminalRef={terminalRef}
                    violations={violations}     // new prop to show violation count
                    isFullscreen={true}         // optional: set false if you want readOnly behavior
                    externalShowAssistant={showAssistant}
                    externalSetShowAssistant={setShowAssistant}
                    renderAssistantExternally={true}
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
            </ResizablePanel>

            {showAssistant && (
              <>
                <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                  <AssistantPanel
                    codeContext={{
                      code: code,
                      activeFile: "main." + (lang === "python" ? "py" : lang === "java" ? "java" : "c"),
                      files: [], // Static editor doesn't support multi-file yet
                      cursorPosition: { lineNumber: 1, column: 1 }
                    }}
                    onClose={() => setShowAssistant(false)}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

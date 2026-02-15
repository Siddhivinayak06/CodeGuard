"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import CodeEditor from "@/components/editor/CodeEditor";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generatePdfClient } from "@/lib/ClientPdf";
import InteractiveSkeleton from "@/components/skeletons/InteractiveSkeleton";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PlotViewer } from "@/components/editor/PlotViewer";
import { FileData } from "@/components/editor/FileExplorer";
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
import { AssistantPanel } from "@/components/editor/AssistantPanel";
import { motion, AnimatePresence } from "framer-motion";

// Dynamically import InteractiveTerminal
const InteractiveTerminal = dynamic(
  () => import("@/components/editor/InteractiveTerminal"),
  { ssr: false },
);

const LANGUAGE_TEMPLATES: Record<string, string> = {
  python:
    "# Welcome to Python Code Editor\n# Write your Python code here\n\nprint('Hello, World!')\n",
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}',
  c: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}',
  cpp: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}',
  csv: "Name,Age,City,Score\nAlice,22,Mumbai,95\nBob,21,Delhi,88\nCharlie,23,Pune,92",
};

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);
  const [lang, setLang] = useState<"java" | "python" | "c" | "cpp">("python");
  const [files, setFiles] = useState<FileData[]>([
    { name: "main.py", content: LANGUAGE_TEMPLATES.python, language: "python" },
  ]);
  const [activeFileName, setActiveFileName] = useState("main.py");

  const interactiveTerminalRef = useRef<any>(null);
  const [interactiveOutput, setInteractiveOutput] = useState<string>("");
  const [terminalMounted, setTerminalMounted] = useState<boolean>(false);
  const [plotImages, setPlotImages] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const [currentMode, setCurrentMode] = useState("Static");
  const [showAssistant, setShowAssistant] = useState(false);

  const [hasError, setHasError] = useState(false);
  const assistantRef = useRef<{ sendMessage: (msg: string) => void } | null>(
    null,
  );

  useEffect(() => {
    // Simple heuristic to detect errors in output
    if (
      interactiveOutput.includes("Traceback") ||
      interactiveOutput.includes("Error:") ||
      interactiveOutput.includes("Exception") ||
      interactiveOutput.includes("Failed")
    ) {
      setHasError(true);
    }
  }, [interactiveOutput]);

  const handleExplainError = async () => {
    if (!interactiveTerminalRef.current) return;

    // Visual separator
    interactiveTerminalRef.current.write("\r\n\r\n\x1b[1;35m✨ AI Error Explanation:\x1b[0m\r\n");

    const context = interactiveOutput.slice(-3000);
    const prompt = `I encountered an error in my ${lang} interactive session:\n\nOUTPUT:\n${context}\n\nPlease explain the error and how to fix it. Keep it concise.`;

    try {
      const config = JSON.parse(localStorage.getItem("ai_settings") || "{}");
      const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

      if (!supabase) return;
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${apiUrl}/chat2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({
          messages: [{ role: "user", parts: [{ text: prompt }] }],
          codeContext: {
            code: files.find((f) => f.name === activeFileName)?.content || "",
            activeFile: activeFileName,
            files: files.map((f) => ({ name: f.name, language: f.language })),
          },
          config
        }),
      });

      if (!res.ok || !res.body) throw new Error("Failed to fetch explanation");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const ev of events) {
          const line = ev.trim();
          if (!line.startsWith("data:")) continue;
          const payload = line.replace(/^data:\s*/, "");
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed?.text) {
              const text = parsed.text
                .replace(/\*\*(.*?)\*\*/g, "\x1b[1m$1\x1b[0m") // Bold
                .replace(/`(.*?)`/g, "\x1b[36m$1\x1b[0m")       // Inline code (cyan)
                .replace(/\n/g, "\r\n");

              interactiveTerminalRef.current.write(text);
            }
          } catch (e) {
            console.error("Parse error", e);
          }
        }
      }
      interactiveTerminalRef.current.write("\r\n\r\n");

    } catch (err) {
      console.error(err);
      interactiveTerminalRef.current.write("\r\n\x1b[1;31mFailed to get explanation.\x1b[0m\r\n");
    }
  };

  useEffect(() => {
    if (pathname === "/Interactive") setCurrentMode("Interactive");
    else setCurrentMode("Static");
  }, [pathname]);

  const handleImage = (base64: string) => {
    setPlotImages((prev) => [...prev, base64]);
  };

  useEffect(() => {
    if (interactiveTerminalRef.current) {
      interactiveTerminalRef.current.switchLanguage(lang);
    }
  }, [lang]);

  const handleModeChange = (mode: "Static" | "Interactive", path: string) => {
    setCurrentMode(mode);
    router.push(path);
  };

  const supabase = useMemo(
    () => (typeof window === "undefined" ? null : createClient()),
    [],
  );
  const [user, setUser] = useState<User | null>(null);
  const [rollNo, setRollNo] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      if (!supabase) return;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          router.push("/auth/login");
        } else if (mountedRef.current) {
          setUser(data.user);
          // Fetch roll no
          const { data: studentData } = await supabase
            .from("users")
            .select("roll_no")
            .eq("uid", data.user.id)
            .single();
          if (studentData?.roll_no) {
            setRollNo(studentData.roll_no);
          }
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

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleFileSelect = (fileName: string) => {
    setActiveFileName(fileName);
    const file = files.find((f) => f.name === fileName);
    if (file) {
      const language = file.language;
      if (
        language === "java" ||
        language === "python" ||
        language === "c" ||
        language === "cpp"
      ) {
        setLang(language);
      }
    }
  };

  const handleFileCreate = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    let language: string = lang;
    if (extension === "py") language = "python";
    else if (extension === "java") language = "java";
    else if (extension === "c") language = "c";
    else if (extension === "cpp" || extension === "cc" || extension === "hpp")
      language = "cpp";
    else if (extension === "csv" || extension === "xlsx" || extension === "xls") language = "csv";

    setFiles((prev) => [
      ...prev,
      {
        name: fileName,
        content: LANGUAGE_TEMPLATES[language] || "",
        language,
      },
    ]);
    setActiveFileName(fileName);
    // Only switch execution lang for code files
    if (language === "python" || language === "java" || language === "c" || language === "cpp") {
      setLang(language as "java" | "python" | "c" | "cpp");
    }
  };

  const handleFileDelete = (fileName: string) => {
    setFiles((prev) => {
      const newFiles = prev.filter((f) => f.name !== fileName);
      if (activeFileName === fileName && newFiles.length > 0) {
        setActiveFileName(newFiles[0].name);
      }
      return newFiles;
    });
  };

  const handleFileRename = (oldName: string, newName: string) => {
    if (!newName.trim()) return;

    const extension = newName.split(".").pop()?.toLowerCase();
    let newLanguage: string | undefined;

    if (extension === "py") newLanguage = "python";
    else if (extension === "java") newLanguage = "java";
    else if (extension === "c") newLanguage = "c";
    else if (extension === "cpp" || extension === "cc" || extension === "hpp")
      newLanguage = "cpp";
    else if (extension === "csv" || extension === "xlsx" || extension === "xls") newLanguage = "csv";

    setFiles((prev) =>
      prev.map((f) => {
        if (f.name === oldName) {
          return {
            ...f,
            name: newName,
            language: newLanguage || f.language, // Update language if recognized, else keep old
          };
        }
        return f;
      }),
    );

    if (activeFileName === oldName) {
      setActiveFileName(newName);
      if (newLanguage && newLanguage !== "csv") {
        setLang(newLanguage as "java" | "python" | "c" | "cpp");
      }
    }
  };

  const handleFileChange = (fileName: string, newContent: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.name === fileName ? { ...f, content: newContent } : f,
      ),
    );
  };

  const handleFileUpload = (fileName: string, content: string) => {
    if (files.some((f) => f.name === fileName)) {
      alert("File with this name already exists!");
      return;
    }
    const ext = fileName.split(".").pop()?.toLowerCase();
    let language: string = lang;
    if (ext === "py") language = "python";
    else if (ext === "java") language = "java";
    else if (ext === "c") language = "c";
    else if (ext === "cpp" || ext === "cc") language = "cpp";
    else if (ext === "csv" || ext === "xlsx" || ext === "xls") language = "csv";

    setFiles((prev) => [...prev, { name: fileName, content, language }]);
    setActiveFileName(fileName);

    if (
      language === "java" ||
      language === "python" ||
      language === "c" ||
      language === "cpp"
    ) {
      setLang(language as "java" | "python" | "c" | "cpp");
    }
  };

  const handleLangChange = (newLang: string) => {
    if (
      newLang !== "java" &&
      newLang !== "python" &&
      newLang !== "c" &&
      newLang !== "cpp"
    )
      return;

    const defaultFileName =
      newLang === "python"
        ? "main.py"
        : newLang === "java"
          ? "Main.java"
          : newLang === "cpp"
            ? "main.cpp"
            : "main.c";

    const fileExists = files.some((f) => f.name === defaultFileName);

    if (!fileExists) {
      const nextTemplate = (LANGUAGE_TEMPLATES as any)[newLang];
      setFiles((prev) => [
        ...prev,
        { name: defaultFileName, content: nextTemplate, language: newLang as any },
      ]);
    }

    setLang(newLang as "java" | "python" | "c" | "cpp");
    setActiveFileName(defaultFileName);
  };

  const downloadPdf = async () => {
    if (
      !interactiveOutput &&
      !files.find((f) => f.name === activeFileName)?.content
    ) {
      alert("No content to generate PDF!");
      return;
    }
    const activeFile = files.find((f) => f.name === activeFileName);
    try {
      await generatePdfClient({
        studentName:
          user?.user_metadata?.name || user?.email || "Anonymous User",
        rollNumber: rollNo || "Interactive Mode",
        practicalTitle: "Code Playground Session",
        code: activeFile?.content || "",
        language: lang,
        submissionDate: new Date().toLocaleDateString(),
        status: "PRACTICE",
        output: interactiveOutput,
        plotImages: plotImages,
        filename: "playground_session.pdf",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed!");
    }
  };


  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/20 relative">
      {/* Animated Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl animate-float-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-400/10 via-purple-400/10 to-pink-400/10 dark:from-cyan-600/5 dark:via-purple-600/5 dark:to-pink-600/5 rounded-full blur-3xl" />
      </div>

      {/* Main Editor + Terminal */}
      <div className="flex-1 mt-16 p-5 h-[calc(100vh-4rem)] w-full relative z-10">
        <div className="h-full w-full glass-card-premium rounded-3xl overflow-hidden shadow-2xl">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Main Panel: Editor & Terminal */}
            <ResizablePanel
              defaultSize={showAssistant ? 75 : 100}
              minSize={50}
              className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl"
            >
              <ResizablePanelGroup direction="vertical" className="h-full">
                {/* Code Editor */}
                <ResizablePanel
                  defaultSize={60}
                  minSize={30}
                  className="relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/60 to-white/40 dark:from-gray-900/60 dark:to-gray-900/40 backdrop-blur-sm -z-10" />
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={lang}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        boxShadow: isExecuting
                          ? "inset 0 0 60px rgba(99, 102, 241, 0.15), 0 0 30px rgba(139, 92, 246, 0.2)"
                          : "none",
                      }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{
                        opacity: { duration: 0.25 },
                        y: { duration: 0.25, ease: "easeOut" },
                        boxShadow: {
                          duration: 0.4,
                          repeat: isExecuting ? Infinity : 0,
                          repeatType: "reverse",
                        },
                      }}
                      className="h-full w-full rounded-xl overflow-hidden"
                    >
                      <CodeEditor
                        code={
                          files.find((f) => f.name === activeFileName)
                            ?.content || ""
                        }
                        setCode={(newCode) =>
                          handleFileChange(activeFileName, newCode)
                        }
                        disabled={false}
                        onRun={() => {
                          setInteractiveOutput("");
                          setHasError(false); // Reset error state on run
                          setPlotImages([]);
                          setIsExecuting(true);
                          if (
                            terminalMounted &&
                            interactiveTerminalRef.current
                          ) {
                            // Run only the active file's code (single-file mode)
                            const activeFile = files.find(
                              (f) => f.name === activeFileName,
                            );
                            if (activeFile) {
                              interactiveTerminalRef.current.startExecution(
                                files,
                                activeFileName,
                              );
                            }
                          }
                          setTimeout(() => setIsExecuting(false), 2000);
                        }}
                        onDownload={downloadPdf}
                        onSubmit={() => { }}
                        loading={false}
                        locked={false}
                        lang={lang}
                        onLangChange={handleLangChange}
                        showLangSelector={true}
                        showInputToggle={false}
                        showInput={false}
                        setShowInput={() => { }}
                        terminalRef={interactiveTerminalRef}
                        violations={0}
                        isFullscreen={true}
                        files={files}
                        activeFileName={activeFileName}
                        onFileSelect={handleFileSelect}
                        onFileCreate={handleFileCreate}
                        onFileDelete={handleFileDelete}
                        onFileChange={handleFileChange}
                        onFileRename={handleFileRename}
                        onFileUpload={handleFileUpload}
                        externalShowAssistant={showAssistant}
                        externalSetShowAssistant={setShowAssistant}
                        renderAssistantExternally={true}
                      />
                    </motion.div>
                  </AnimatePresence>
                </ResizablePanel>

                <ResizableHandle className="h-3 bg-gradient-to-r from-transparent via-gray-200/60 to-transparent dark:via-gray-700/40 hover:via-indigo-400/60 dark:hover:via-indigo-500/50 flex items-center justify-center group outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <div className="w-12 h-1 rounded-full bg-gray-300/80 dark:bg-gray-600/80 group-hover:bg-indigo-500 group-hover:w-20" />
                </ResizableHandle>

                {/* Terminal */}
                <ResizablePanel
                  defaultSize={40}
                  minSize={20}
                  className="bg-gradient-to-b from-gray-50/60 to-gray-100/40 dark:from-gray-900/60 dark:to-gray-950/80 backdrop-blur-xl relative"
                >
                  <div className="h-full flex flex-col">
                    {/* Terminal Header */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-gray-100/80 via-gray-50/60 to-gray-100/80 dark:from-gray-800/80 dark:via-gray-900/60 dark:to-gray-800/80 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors shadow-sm" />
                          <div className="w-3 h-3 rounded-full bg-amber-400 hover:bg-amber-500 transition-colors shadow-sm" />
                          <div className="w-3 h-3 rounded-full bg-emerald-400 hover:bg-emerald-500 transition-colors shadow-sm" />
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tracking-wide">
                          Terminal
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasError && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleExplainError}
                            className="h-6 px-2 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 border border-red-200/50 dark:border-red-800/50 flex items-center gap-1.5"
                          >
                            <Sparkles className="w-3 h-3" />
                            Explain Error
                          </Button>
                        )}
                        <span className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-700/50">
                          {lang}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      <InteractiveTerminal
                        ref={interactiveTerminalRef}
                        wsUrl="ws://127.0.0.1:5002"
                        fontSize={15}
                        fontFamily="'Fira Code', 'JetBrains Mono', monospace"
                        onOutput={(data: string) =>
                          setInteractiveOutput((prev) => prev + data)
                        }
                        onMount={() => setTerminalMounted(true)}
                        onImage={handleImage}
                      />
                      {plotImages.length > 0 && (
                        <PlotViewer
                          images={plotImages}
                          onClose={() => setPlotImages([])}
                          onClear={() => setPlotImages([])}
                        />
                      )}
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>

            {showAssistant && (
              <>
                <ResizableHandle className="w-3 bg-gradient-to-b from-transparent via-gray-200/60 to-transparent dark:via-gray-700/40 hover:via-indigo-400/60 dark:hover:via-indigo-500/50 flex items-center justify-center group outline-none">
                  <div className="h-12 w-1 rounded-full bg-gray-300/80 dark:bg-gray-600/80 group-hover:bg-indigo-500 group-hover:h-20" />
                </ResizableHandle>
                <ResizablePanel
                  defaultSize={25}
                  minSize={20}
                  maxSize={40}
                  className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border-l border-white/30 dark:border-gray-700/50"
                >
                  <AssistantPanel
                    ref={assistantRef}
                    codeContext={{
                      code:
                        files.find((f) => f.name === activeFileName)?.content ||
                        "",
                      activeFile: activeFileName,
                      files: files.map((f) => ({
                        name: f.name,
                        language: f.language,
                      })),
                      cursorPosition: { lineNumber: 1, column: 1 },
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

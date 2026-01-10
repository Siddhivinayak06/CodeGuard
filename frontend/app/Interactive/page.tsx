"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import CodeEditor from "@/components/editor/CodeEditor";
import { ModeToggle } from "@/components/layout/ModeToggle";
import { ChevronDown, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generatePdfClient } from "@/lib/ClientPdf";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PlotViewer } from "@/components/editor/PlotViewer";
import { FileData } from "@/components/editor/FileExplorer";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AssistantPanel } from "@/components/editor/AssistantPanel";
import { motion, AnimatePresence } from "framer-motion";

// Dynamically import InteractiveTerminal
const InteractiveTerminal = dynamic(
  () => import("@/components/editor/InteractiveTerminal"),
  { ssr: false }
);

const LANGUAGE_TEMPLATES = {
  python: "# Welcome to Python Code Editor\n# Write your Python code here\n\nprint('Hello, World!')\n",
  java: "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}",
  c: "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}",
  cpp: "#include <iostream>\n\nint main() {\n    std::cout << \"Hello, World!\" << std::endl;\n    return 0;\n}"
};

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);
  const [lang, setLang] = useState<"java" | "python" | "c" | "cpp">("python");
  const [files, setFiles] = useState<FileData[]>([
    { name: "main.py", content: LANGUAGE_TEMPLATES.python, language: "python" }
  ]);
  const [activeFileName, setActiveFileName] = useState("main.py");

  const interactiveTerminalRef = useRef<any>(null);
  const [interactiveOutput, setInteractiveOutput] = useState<string>("");
  const [terminalMounted, setTerminalMounted] = useState<boolean>(false);
  const [plotImages, setPlotImages] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  const [currentMode, setCurrentMode] = useState("Static");
  const [showAssistant, setShowAssistant] = useState(false);

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

  const supabase = useMemo(() => (typeof window === "undefined" ? null : createClient()), []);
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
    return () => { mountedRef.current = false; };
  }, [router, supabase]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleFileSelect = (fileName: string) => {
    setActiveFileName(fileName);
    const file = files.find(f => f.name === fileName);
    if (file) {
      const language = file.language;
      if (language === "java" || language === "python" || language === "c" || language === "cpp") {
        setLang(language);
      }
    }
  };

  const handleFileCreate = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    let language: "python" | "java" | "c" | "cpp" = lang;
    if (extension === 'py') language = 'python';
    else if (extension === 'java') language = 'java';
    else if (extension === 'c') language = 'c';
    else if (extension === 'cpp' || extension === 'cc' || extension === 'hpp') language = 'cpp';

    setFiles(prev => [...prev, { name: fileName, content: '', language }]);
    setActiveFileName(fileName);
    setLang(language);
  };

  const handleFileDelete = (fileName: string) => {
    setFiles(prev => {
      const newFiles = prev.filter(f => f.name !== fileName);
      if (activeFileName === fileName && newFiles.length > 0) {
        setActiveFileName(newFiles[0].name);
      }
      return newFiles;
    });
  };

  const handleFileRename = (oldName: string, newName: string) => {
    if (!newName.trim()) return;
    if (files.some(f => f.name === newName)) {
      alert("File with this name already exists!");
      return;
    }

    const extension = newName.split('.').pop()?.toLowerCase();
    let newLanguage: "python" | "java" | "c" | "cpp" | undefined;

    if (extension === 'py') newLanguage = 'python';
    else if (extension === 'java') newLanguage = 'java';
    else if (extension === 'c') newLanguage = 'c';
    else if (extension === 'cpp' || extension === 'cc' || extension === 'hpp') newLanguage = 'cpp';

    setFiles(prev => prev.map(f => {
      if (f.name === oldName) {
        return {
          ...f,
          name: newName,
          language: newLanguage || f.language // Update language if recognized, else keep old
        };
      }
      return f;
    }));

    if (activeFileName === oldName) {
      setActiveFileName(newName);
      if (newLanguage) {
        setLang(newLanguage);
      }
    }
  };

  const handleFileChange = (fileName: string, newContent: string) => {
    setFiles(prev => prev.map(f =>
      f.name === fileName ? { ...f, content: newContent } : f
    ));
  };

  const handleFileUpload = (fileName: string, content: string) => {
    if (files.some(f => f.name === fileName)) {
      alert("File with this name already exists!");
      return;
    }
    const ext = fileName.split('.').pop()?.toLowerCase();
    let language: string = lang;
    if (ext === 'py') language = 'python';
    else if (ext === 'java') language = 'java';
    else if (ext === 'c') language = 'c';
    else if (ext === 'cpp' || ext === 'cc') language = 'cpp';
    else if (ext === 'js') language = 'javascript';

    setFiles(prev => [...prev, { name: fileName, content, language }]);
    setActiveFileName(fileName);

    if (language === "java" || language === "python" || language === "c" || language === "cpp") {
      setLang(language as "java" | "python" | "c" | "cpp");
    }
  };


  const handleLangChange = (newLang: string) => {
    if (newLang !== "java" && newLang !== "python" && newLang !== "c" && newLang !== "cpp") return;
    setLang(newLang as "java" | "python" | "c" | "cpp");

    // Reset files to default template for new language
    const nextTemplate = (LANGUAGE_TEMPLATES as any)[newLang];
    const defaultFileName = newLang === 'python' ? 'main.py' : newLang === 'java' ? 'Main.java' : newLang === 'cpp' ? 'main.cpp' : 'main.c';
    setFiles([{ name: defaultFileName, content: nextTemplate, language: newLang }]);
    setActiveFileName(defaultFileName);
  };

  const downloadPdf = async () => {
    if (!interactiveOutput && !files.find(f => f.name === activeFileName)?.content) {
      alert("No content to generate PDF!");
      return;
    }
    const activeFile = files.find(f => f.name === activeFileName);
    try {
      await generatePdfClient({
        studentName: user?.user_metadata?.name || user?.email || "Anonymous User",
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

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/50 to-purple-50/50 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/20">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-full blur-xl opacity-30 animate-pulse" />
        <div className="relative glass-card-premium p-8 rounded-2xl">
          <Loader2 className="w-10 h-10 text-indigo-600 dark:text-indigo-400 animate-spin" />
        </div>
      </div>
    </div>
  );

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
            <ResizablePanel defaultSize={showAssistant ? 75 : 100} minSize={50} className="bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl">
              <ResizablePanelGroup direction="vertical" className="h-full">

                {/* Code Editor */}
                <ResizablePanel defaultSize={60} minSize={30} className="relative transition-all duration-300">
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
                        boxShadow: { duration: 0.4, repeat: isExecuting ? Infinity : 0, repeatType: "reverse" }
                      }}
                      className="h-full w-full rounded-xl overflow-hidden"
                    >
                      <CodeEditor
                        code={files.find(f => f.name === activeFileName)?.content || ""}
                        setCode={(newCode) => handleFileChange(activeFileName, newCode)}
                        disabled={false}
                        onRun={() => {
                          setInteractiveOutput("");
                          setPlotImages([]);
                          setIsExecuting(true);
                          if (terminalMounted && interactiveTerminalRef.current) {
                            // Run only the active file's code (single-file mode)
                            const activeFile = files.find(f => f.name === activeFileName);
                            if (activeFile) {
                              interactiveTerminalRef.current.startExecution(activeFile.content, lang);
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

                <ResizableHandle className="h-3 bg-gradient-to-r from-transparent via-gray-200/60 to-transparent dark:via-gray-700/40 hover:via-indigo-400/60 dark:hover:via-indigo-500/50 transition-all duration-300 flex items-center justify-center group outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <div className="w-12 h-1 rounded-full bg-gray-300/80 dark:bg-gray-600/80 group-hover:bg-indigo-500 group-hover:w-20 transition-all duration-300" />
                </ResizableHandle>

                {/* Terminal */}
                <ResizablePanel defaultSize={40} minSize={20} className="bg-gradient-to-b from-gray-50/60 to-gray-100/40 dark:from-gray-900/60 dark:to-gray-950/80 backdrop-blur-xl relative">
                  <div className="h-full flex flex-col">
                    {/* Terminal Header */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-gray-100/80 via-gray-50/60 to-gray-100/80 dark:from-gray-800/80 dark:via-gray-900/60 dark:to-gray-800/80 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors shadow-sm" />
                          <div className="w-3 h-3 rounded-full bg-amber-400 hover:bg-amber-500 transition-colors shadow-sm" />
                          <div className="w-3 h-3 rounded-full bg-emerald-400 hover:bg-emerald-500 transition-colors shadow-sm" />
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300 tracking-wide">Terminal</span>
                      </div>
                      <div className="flex items-center gap-2">
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
                        onOutput={(data: string) => setInteractiveOutput((prev) => prev + data)}
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
                <ResizableHandle className="w-3 bg-gradient-to-b from-transparent via-gray-200/60 to-transparent dark:via-gray-700/40 hover:via-indigo-400/60 dark:hover:via-indigo-500/50 transition-all duration-300 flex items-center justify-center group outline-none">
                  <div className="h-12 w-1 rounded-full bg-gray-300/80 dark:bg-gray-600/80 group-hover:bg-indigo-500 group-hover:h-20 transition-all duration-300" />
                </ResizableHandle>
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-white/70 dark:bg-gray-900/70 backdrop-blur-2xl border-l border-white/30 dark:border-gray-700/50">
                  <AssistantPanel
                    codeContext={{
                      code: files.find(f => f.name === activeFileName)?.content || "",
                      activeFile: activeFileName,
                      files: files.map(f => ({ name: f.name, language: f.language })),
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


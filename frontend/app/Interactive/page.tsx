"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import CodeEditor from "@/components/CodeEditor";
import { ModeToggle } from "@/components/ModeToggle";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generatePdfClient } from "@/lib/ClientPdf";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { PlotViewer } from "@/components/PlotViewer";
import { FileData } from "@/components/FileExplorer";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AssistantPanel } from "@/components/AssistantPanel";

// Dynamically import InteractiveTerminal
const InteractiveTerminal = dynamic(
  () => import("@/components/InteractiveTerminal"),
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
            .from("student_details")
            .select("roll_no")
            .eq("student_id", data.user.id)
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
    setFiles(prev => prev.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    ));
    if (activeFileName === oldName) {
      setActiveFileName(newName);
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
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="glass-card p-8 rounded-2xl flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 dark:text-gray-400 font-medium">Loading environment...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">

      {/* Main Editor + Terminal */}
      <div className="flex-1 mt-16 p-4 h-[calc(100vh-4rem)] w-full">
        <div className="h-full w-full glass-card-premium rounded-3xl overflow-hidden shadow-2xl border border-white/20 dark:border-gray-800/50">
          <ResizablePanelGroup direction="horizontal" className="h-full">

            {/* Left Main Panel: Editor & Terminal */}
            <ResizablePanel defaultSize={showAssistant ? 75 : 100} minSize={50} className="bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm">
              <ResizablePanelGroup direction="vertical" className="h-full">

                {/* Code Editor */}
                <ResizablePanel defaultSize={60} minSize={30} className="relative transition-all duration-300">
                  <div className="absolute inset-0 bg-white/40 dark:bg-gray-900/50 backdrop-blur-sm -z-10" />
                  <CodeEditor
                    code={files.find(f => f.name === activeFileName)?.content || ""}
                    setCode={(newCode) => handleFileChange(activeFileName, newCode)}
                    disabled={false}
                    onRun={() => {
                      setInteractiveOutput("");
                      setPlotImages([]);
                      if (terminalMounted && interactiveTerminalRef.current) {
                        interactiveTerminalRef.current.startExecution(files, activeFileName, lang);
                      }
                    }}
                    onDownload={downloadPdf}
                    onSubmit={() => { }}
                    loading={false}
                    locked={false}
                    lang={lang}
                    onLangChange={handleLangChange}
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
                </ResizablePanel>

                <ResizableHandle className="h-2 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-indigo-500/50 dark:hover:bg-indigo-500/50 transition-colors duration-300 flex items-center justify-center group outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                  <div className="w-16 h-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-white/80 transition-colors" />
                </ResizableHandle>

                {/* Terminal */}
                <ResizablePanel defaultSize={40} minSize={20} className="bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-md relative">
                  <div className="h-full flex flex-col">
                    <div className="px-4 py-2 bg-gray-100/50 dark:bg-gray-900/50 border-b border-gray-200/50 dark:border-gray-800/50 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-400/80" />
                      <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                      <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                      <span className="ml-2 text-xs font-mono text-gray-500 dark:text-gray-400">Terminal</span>
                    </div>
                    <div className="flex-1 overflow-hidden relative">
                      <div className="absolute inset-0 bg-black/5 dark:bg-black/20 pointer-events-none" />
                      <InteractiveTerminal
                        ref={interactiveTerminalRef}
                        wsUrl="ws://localhost:5002"
                        fontSize={16}
                        fontFamily="Fira Code, monospace"
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
                <ResizableHandle className="w-2 bg-gray-100/50 dark:bg-gray-800/50 hover:bg-indigo-500/50 dark:hover:bg-indigo-500/50 transition-colors duration-300 flex items-center justify-center group outline-none">
                  <div className="h-16 w-1 rounded-full bg-gray-300 dark:bg-gray-700 group-hover:bg-white/80 transition-colors" />
                </ResizableHandle>
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-l border-white/20 dark:border-gray-800/50">
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

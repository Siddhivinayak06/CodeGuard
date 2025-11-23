"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import CodeEditor from "@/components/CodeEditor";
import useProctoring from "@/hooks/useProctoring";
import { ModeToggle } from "@/components/ModeToggle";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { generatePdfClient } from "@/lib/ClientPdf";
import Navbar from "@/components/Navbar";
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
  c: "#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}"
};

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(true);
  const [lang, setLang] = useState<"java" | "python" | "c">("python");
  const [files, setFiles] = useState<FileData[]>([
    { name: "main.py", content: LANGUAGE_TEMPLATES.python, language: "python" }
  ]);
  const [activeFileName, setActiveFileName] = useState("main.py");
  const { violations, locked } = useProctoring(3);

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
    let language = lang;
    if (extension === 'py') language = 'python';
    else if (extension === 'java') language = 'java';
    else if (extension === 'c') language = 'c';

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

  const handleFileChange = (fileName: string, newContent: string) => {
    setFiles(prev => prev.map(f =>
      f.name === fileName ? { ...f, content: newContent } : f
    ));
  };

  const handleLangChange = (newLang: string) => {
    if (newLang !== "java" && newLang !== "python" && newLang !== "c") return;
    setLang(newLang);

    // Reset files to default template for new language
    const nextTemplate = LANGUAGE_TEMPLATES[newLang];
    const defaultFileName = newLang === 'python' ? 'main.py' : newLang === 'java' ? 'Main.java' : 'main.c';
    setFiles([{ name: defaultFileName, content: nextTemplate, language: newLang }]);
    setActiveFileName(defaultFileName);
  };

  const downloadPdf = async () => {
    if (!interactiveOutput) {
      alert("No output captured yet!");
      return;
    }
    const activeFile = files.find(f => f.name === activeFileName);
    try {
      await generatePdfClient({
        code: activeFile?.content || "",
        output: interactiveOutput,
        user: user?.email || "Anonymous",
        filename: "interactive_code_output.pdf",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF generation failed!");
    }
  };

  if (!user) return <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400">Loading...</div>;

  return (
    <div className="flex flex-col h-screen overflow-auto bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      {/* Glass-effect Navbar */}
      <Navbar />

      {/* Main Editor + Terminal */}
      <div className="flex-1 mt-16 h-[calc(100vh-4rem)] w-full">
        <div className="h-full w-full">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={showAssistant ? 75 : 100} minSize={50}>
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={60} minSize={30}>
                  <CodeEditor
                    code={files.find(f => f.name === activeFileName)?.content || ""}
                    setCode={(newCode) => handleFileChange(activeFileName, newCode)}
                    disabled={locked}
                    onRun={() => {
                      setInteractiveOutput("");
                      setPlotImages([]);
                      if (terminalMounted && interactiveTerminalRef.current) {
                        const activeFile = files.find(f => f.name === activeFileName);
                        interactiveTerminalRef.current.startExecution(files, activeFileName, lang);
                      }
                    }}
                    onDownload={downloadPdf}
                    onSubmit={() => { }}
                    loading={false}
                    locked={locked}
                    lang={lang}
                    onLangChange={handleLangChange}
                    showInputToggle={false}
                    showInput={false}
                    setShowInput={() => { }}
                    terminalRef={interactiveTerminalRef}
                    violations={violations || 0}
                    isFullscreen={true}
                    files={files}
                    activeFileName={activeFileName}
                    onFileSelect={handleFileSelect}
                    onFileCreate={handleFileCreate}
                    onFileDelete={handleFileDelete}
                    onFileChange={handleFileChange}
                    externalShowAssistant={showAssistant}
                    externalSetShowAssistant={setShowAssistant}
                    renderAssistantExternally={true}
                  />

                </ResizablePanel>

                <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />

                <ResizablePanel defaultSize={40} minSize={20}>
                  <InteractiveTerminal
                    ref={interactiveTerminalRef}
                    wsUrl="ws://localhost:5002"
                    fontSize={16}
                    fontFamily="Fira Code, monospace"
                    onOutput={(data: string) => setInteractiveOutput((prev) => prev + data)}
                    onMount={() => setTerminalMounted(true)}
                    onImage={handleImage}
                  />
                </ResizablePanel>

                {plotImages.length > 0 && (
                  <>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={20} minSize={15}>
                      <div className="h-full relative">
                        <PlotViewer
                          images={plotImages}
                          onClose={() => setPlotImages([])}
                          onClear={() => setPlotImages([])}
                        />
                      </div>
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>

            {showAssistant && (
              <>
                <ResizableHandle className="bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-600 transition-colors duration-200" />
                <ResizablePanel defaultSize={25} minSize={20} maxSize={40}>
                  <AssistantPanel
                    codeContext={{
                      code: files.find(f => f.name === activeFileName)?.content || "",
                      activeFile: activeFileName,
                      files: files.map(f => ({ name: f.name, language: f.language })),
                      cursorPosition: { lineNumber: 1, column: 1 } // TODO: Pass real cursor pos if needed
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

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
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  const [code, setCode] = useState(LANGUAGE_TEMPLATES.python);
  const { violations, locked } = useProctoring(3);

  const interactiveTerminalRef = useRef<any>(null);
  const [interactiveOutput, setInteractiveOutput] = useState<string>("");
  const [terminalMounted, setTerminalMounted] = useState<boolean>(false);

  const [currentMode, setCurrentMode] = useState("Static");

  useEffect(() => {
    if (pathname === "/Interactive") setCurrentMode("Interactive");
    else setCurrentMode("Static");
  }, [pathname]);

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

  const handleLangChange = (newLang: "java" | "python" | "c") => {
    setLang(newLang);
    const currentTemplate = LANGUAGE_TEMPLATES[lang];
    const nextTemplate = LANGUAGE_TEMPLATES[newLang];
    if (!code || code.trim() === "" || code === currentTemplate) {
      setCode(nextTemplate);
    }
  };

  const downloadPdf = async () => {
    if (!interactiveOutput) {
      alert("No output captured yet!");
      return;
    }
    try {
      await generatePdfClient({
        code,
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
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      {/* Glass-effect Navbar */}
      <Navbar />


      {/* Main Editor + Terminal */}
      <div className="flex-1 pt-16"> {/* pt-16 for navbar spacing */}
        <div className="h-full w-full">
          <ResizablePanelGroup direction="vertical" className="h-full">
            <ResizablePanel defaultSize={60} minSize={30}>
              <CodeEditor
                code={code}
                setCode={setCode}
                disabled={locked}
                onRun={() => {
                  setInteractiveOutput("");
                  if (terminalMounted && interactiveTerminalRef.current) {
                    interactiveTerminalRef.current.startExecution(code, lang);
                  }
                }}
                onDownload={downloadPdf}
                onSubmit={() => { }}          // submit (visible only on /editor)
                loading={false}
                locked={locked}
                lang={lang}
                onLangChange={handleLangChange}
                showInputToggle={false}
                showInput={false}
                setShowInput={() => { }}
                terminalRef={interactiveTerminalRef}  // ✅ REQUIRED IN UPDATED COMPONENT
                violations={violations || 0}          // ✅ NEW PROP
                isFullscreen={true}                   // ✅ matches updated props
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
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

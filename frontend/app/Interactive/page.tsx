"use client";
import { useState, useRef, useEffect, useMemo } from "react"; // ✅ added missing hooks
import dynamic from "next/dynamic"; // ✅ import dynamic
import CodeEditor from "@/components/CodeEditor";
import useProctoring from "@/hooks/useProctoring";
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
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js"; // ✅ use type-only import
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

// ✅ dynamically import InteractiveTerminal with SSR disabled
const InteractiveTerminal = dynamic(
  () => import("@/components/InteractiveTerminal"),
  { ssr: false }
);

export default function Home() {
  const router = useRouter();
  const mountedRef = useRef<boolean>(true);
  const pathname = usePathname();
  const [lang, setLang] = useState<string>("python");
  const [code, setCode] = useState<string>(
    "# Welcome to Python Code Editor\n# Write your Python code here\n\nprint('Hello, World!')\n"
  );
  const { violations, locked } = useProctoring(3);

  // ✅ create ref for InteractiveTerminal
  const interactiveTerminalRef = useRef<any>(null);
  const terminalRef = useRef<any>(null);
  const [interactiveOutput, setInteractiveOutput] = useState<string>("");
  // Initial mode can be 'Static' or 'Interactive'
  const [currentMode, setCurrentMode] = useState("Static");

  // Initialize mode based on current path
  useEffect(() => {
    if (pathname === "/Interactive") setCurrentMode("Interactive");
    else setCurrentMode("Static");
  }, [pathname]);

  // Add this after your existing useEffects
  useEffect(() => {
    if (interactiveTerminalRef.current) {
      interactiveTerminalRef.current.switchLanguage(lang);
    }
  }, [lang]);
  const handleModeChange = (mode: "Static" | "Interactive", path: string) => {
    setCurrentMode(mode); // update dropdown immediately
    router.push(path);    // navigate to new page
  };


  const supabase = useMemo(() => {
    if (typeof window === "undefined") return null;
    return createClient();
  }, []);

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
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // ✅ Add this function
  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.push("/"); // redirect to home or login page
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-sm">
                {currentMode} {/* Displays the current mode */}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent>
              <DropdownMenuLabel>Select Mode</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleModeChange("Static", "/compiler")}>
                Static
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleModeChange("Interactive", "/Interactive")}>
                Interactive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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

          {/* ✅ Added Sign Out Button */}
          <Button variant="outline" onClick={handleSignOut}>
            Sign Out
          </Button>

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
                  console.log("Run button clicked!"); // <- check this
                  // 🔑 Reset output for fresh run
                  setInteractiveOutput("");

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
                onOutput={(data: string) =>
                  setInteractiveOutput((prev) => prev + data)
                }
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

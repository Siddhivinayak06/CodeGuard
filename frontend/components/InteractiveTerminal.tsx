"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTheme } from "next-themes";
import { FileData } from "./FileExplorer";

interface InteractiveTerminalProps {
  wsUrl?: string;
  fontSize?: number;
  fontFamily?: string;
  onOutput?: (data: string) => void;
  onMount?: () => void;
  onImage?: (base64: string) => void;
}

export interface InteractiveTerminalHandle {
  startExecution: (files: FileData[] | string, activeFileOrLang?: string, lang?: string) => void;
  switchLanguage: (lang: string) => void;
}

const lightTheme = {
  background: "#ffffff",
  foreground: "#000000",
  cursor: "#000000",
  cursorAccent: "#ffffff",
  selectionBackground: "rgba(0, 0, 0, 0.3)",
};

const darkTheme = {
  background: "#1a1b26",
  foreground: "#a9b1d6",
  cursor: "#c0caf5",
  cursorAccent: "#1a1b26",
  selectionBackground: "rgba(113, 131, 184, 0.3)",
};

const InteractiveTerminal = forwardRef<
  InteractiveTerminalHandle,
  InteractiveTerminalProps
>(({ wsUrl, fontSize = 16, fontFamily = "monospace", onOutput, onMount, onImage }, ref) => {
  const { theme, resolvedTheme } = useTheme();
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const inputBuffer = useRef<string>("");

  const currentLang = useRef<string>("python"); // default

  const wsEndpoint = wsUrl || "ws://localhost:5002";



  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    const isDark = theme === "dark" || (theme === "system" && resolvedTheme === "dark");
    const currentTheme = isDark ? darkTheme : lightTheme;

    term.current = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      scrollback: 1000,
      theme: currentTheme,
    });

    fitAddon.current = new FitAddon();
    term.current.loadAddon(fitAddon.current);
    term.current.open(terminalRef.current);

    const observer = new ResizeObserver(() => fitAddon.current?.fit());
    observer.observe(terminalRef.current);

    // Delay initial fit
    const fitTimeout = setTimeout(() => {
      try {
        if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
          fitAddon.current?.fit();
        }
      } catch (error) {
        console.error("Initial terminal fit failed:", error);
      }
    }, 200);

    // WebSocket setup
    const ws = new WebSocket(wsEndpoint);
    socket.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected:", wsEndpoint);
      if (onMount) onMount();
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!term.current) return;

      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        msg = { type: "raw", data: event.data };
      }

      if (msg.type === "lang") {
        term.current.write(`\r\n✅ Language set to ${msg.lang}\r\n`);
        currentLang.current = msg.lang;
      } else {
        const data = msg.data ?? msg;
        const imgStart = "__IMAGE_START__";
        const imgEnd = "__IMAGE_END__";

        if (data.includes(imgStart) && data.includes(imgEnd)) {
          const parts = data.split(imgStart);
          let cleanData = parts[0];

          for (let i = 1; i < parts.length; i++) {
            const [imgContent, rest] = parts[i].split(imgEnd);
            if (imgContent && onImage) {
              onImage(imgContent.trim());
            }
            cleanData += rest || "";
          }

          if (cleanData) {
            term.current.write(cleanData.replace(/\r?\n/g, "\r\n"));
            term.current.scrollToBottom();
            if (onOutput) onOutput(cleanData);
          }
        } else {
          term.current.write(data.replace(/\r?\n/g, "\r\n"));
          term.current.scrollToBottom();
          if (onOutput) onOutput(data);
        }
      }
    };

    ws.onclose = (event: CloseEvent) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };

    term.current.onData((data: string) => {
      if (data === "\r") {
        term.current?.write("\r\n");
        socket.current?.send(JSON.stringify({ type: "stdin", data: inputBuffer.current }));
        inputBuffer.current = "";
      } else if (data === "\u007F") {
        if (inputBuffer.current.length > 0) {
          inputBuffer.current = inputBuffer.current.slice(0, -1);
          term.current?.write("\b \b");
        }
      } else {
        inputBuffer.current += data;
        term.current?.write(data);
      }
    });

    const handleResizeWindow = () => {
      fitAddon.current?.fit();
    };
    window.addEventListener("resize", handleResizeWindow);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResizeWindow);
      term.current?.dispose();
      ws.close();
      clearTimeout(fitTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsEndpoint]); // Re-run only if endpoint changes

  // Update options dynamically
  useEffect(() => {
    if (!term.current) return;

    // Calculate theme inside effect
    const isDark = theme === "dark" || (theme === "system" && resolvedTheme === "dark");
    const currentTheme = isDark ? darkTheme : lightTheme;

    term.current.options.fontSize = fontSize;
    term.current.options.fontFamily = fontFamily;
    term.current.options.theme = currentTheme;

    if (terminalRef.current) {
      terminalRef.current.style.backgroundColor = currentTheme.background || "#ffffff";
    }
    fitAddon.current?.fit();
  }, [fontSize, fontFamily, theme, resolvedTheme]);


  useImperativeHandle(ref, () => ({
    startExecution: (filesOrCode: FileData[] | string, activeFileOrLang?: string) => {
      if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
        term.current?.write("\r\n❌ WebSocket not connected!\r\n");
        return;
      }

      // Determine if this is multi-file or single-file mode
      const isMultiFile = Array.isArray(filesOrCode);

      if (isMultiFile) {
        const files = filesOrCode as FileData[];
        const activeFileName = activeFileOrLang!;
        // const language = lang!;

        // Send all files to the backend
        files.forEach((file, index) => {
          const msg = JSON.stringify({
            type: "code",
            data: file.content,
            filename: file.name,
            isLast: index === files.length - 1,
            activeFile: file.name === activeFileName
          });
          socket.current?.send(msg);
        });

        term.current?.write(`\r\n🚀 Running ${activeFileName}...\r\n`);
      } else {
        // Single-file mode (backward compatibility)
        const code = filesOrCode as string;
        // const language = activeFileOrLang!;
        const msg = JSON.stringify({ type: "code", data: code });
        socket.current?.send(msg);
        term.current?.write(`\r\n🚀 Running code...\r\n`);
      }
    },
    switchLanguage: (newLang: string) => {
      currentLang.current = newLang;
      const msg = JSON.stringify({ type: "lang", lang: newLang });
      socket.current?.send(msg);
      term.current?.clear();
      term.current?.write(`\r\n📝 Switching to ${newLang}...\r\n`);
    },
  }));

  return (
    <div className="h-full flex flex-col rounded border border-gray-200 dark:border-gray-700 overflow-hidden">

      <div
        ref={terminalRef}
        className="flex-1"
        style={{ overflow: "hidden", backgroundColor: getTheme().background }}
      />
    </div>
  );
});

InteractiveTerminal.displayName = "InteractiveTerminal";
export default InteractiveTerminal;

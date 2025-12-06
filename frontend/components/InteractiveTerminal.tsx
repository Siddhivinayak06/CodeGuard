"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { FileData } from "./FileExplorer";

interface InteractiveTerminalProps {
  wsUrl?: string;
  fontSize?: number;
  fontFamily?: string;
  onOutput?: (data: string) => void; // ✅ new prop
  onMount?: () => void; // ✅ new prop
  onImage?: (base64: string) => void;
}

export interface InteractiveTerminalHandle {
  startExecution: (files: FileData[] | string, activeFileOrLang?: string, lang?: string) => void;
  switchLanguage: (lang: string) => void;
}

const InteractiveTerminal = forwardRef<
  InteractiveTerminalHandle,
  InteractiveTerminalProps
>(({ wsUrl, fontSize = 16, fontFamily = "monospace", onOutput, onMount, onImage }, ref) => {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const inputBuffer = useRef<string>("");

  const currentLang = useRef<string>("python"); // default


  const wsEndpoint = wsUrl || "ws://localhost:5002";

  useEffect(() => {
    if (!terminalRef.current) return;

    // Initialize terminal
    term.current = new Terminal({
      cursorBlink: true,
      fontSize,
      fontFamily,
      scrollback: 1000,
      theme: {
        background: "#ffffff",
        foreground: "#000000",
        cursor: "#000000",
        cursorAccent: "#ffffff",
      },
    });

    fitAddon.current = new FitAddon();
    term.current.loadAddon(fitAddon.current);
    term.current.open(terminalRef.current);

    // 🧠 ResizeObserver — auto-fit terminal when container size changes
    const observer = new ResizeObserver(() => fitAddon.current?.fit());
    observer.observe(terminalRef.current);

    // Delay initial fit to ensure terminal is fully initialized
    setTimeout(() => {
      try {
        if (terminalRef.current && terminalRef.current.offsetWidth > 0 && terminalRef.current.offsetHeight > 0) {
          fitAddon.current?.fit();
        }
      } catch (error) {
        console.error("Initial terminal fit failed:", error);
      }
    }, 200);

    // WebSocket connection
    socket.current = new WebSocket(wsEndpoint);

    socket.current.onopen = () => {
      console.log("WebSocket connected:", wsEndpoint);
      if (onMount) onMount();
    };

    socket.current.onmessage = (event: MessageEvent) => {
      if (!term.current) return;

      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        msg = { type: "raw", data: event.data };
      }

      if (msg.type === "lang") {
        // Update language display in terminal
        term.current.write(`\r\n✅ Language set to ${msg.lang}\r\n`);
        currentLang.current = msg.lang; // store current language for execution
      } else {
        const data = msg.data ?? msg;

        // Check for image delimiters
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

    socket.current.onclose = (event: CloseEvent) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };

    // Handle typed input
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

    const handleResize = () => {
      if (fitAddon.current) {
        try {
          fitAddon.current.fit();
        } catch (error) {
          console.error("Error fitting terminal on resize:", error);
        }
      }
    };
    window.addEventListener("resize", handleResize);

    // 🧹 Cleanup
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      term.current?.dispose();
      socket.current?.close();
    };
  }, [wsEndpoint, fontSize, fontFamily]);


  useImperativeHandle(ref, () => ({
    startExecution: (filesOrCode: FileData[] | string, activeFileOrLang?: string, lang?: string) => {
      if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
        term.current?.write("\r\n❌ WebSocket not connected!\r\n");
        return;
      }

      // Determine if this is multi-file or single-file mode
      const isMultiFile = Array.isArray(filesOrCode);

      if (isMultiFile) {
        const files = filesOrCode as FileData[];
        const activeFileName = activeFileOrLang!;
        const language = lang!;

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
        const language = activeFileOrLang!;
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
        style={{ overflow: "hidden", backgroundColor: "#ffffff" }}
      />
    </div>
  );
});

InteractiveTerminal.displayName = "InteractiveTerminal";
export default InteractiveTerminal;
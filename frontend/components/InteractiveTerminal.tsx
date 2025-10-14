"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

interface InteractiveTerminalProps {
  wsUrl?: string;
  fontSize?: number;
  fontFamily?: string;
    onOutput?: (data: string) => void; // ✅ new prop
  onMount?: () => void; // ✅ new prop
}

export interface InteractiveTerminalHandle {
  startExecution: (code: string, lang: string) => void;
    switchLanguage: (lang: string) => void; // Add this
}

const InteractiveTerminal = forwardRef<
  InteractiveTerminalHandle,
  InteractiveTerminalProps
>(({ wsUrl, fontSize = 16, fontFamily = "monospace", onOutput, onMount  }, ref) => {
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
    
    // Simple fit without retry - let it fail gracefully
    try {
      fitAddon.current.fit();
    } catch (error) {
      console.error("Initial terminal fit failed:", error);
    }

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
        term.current.write(data.replace(/\r?\n/g, "\r\n"));
        term.current.scrollToBottom();
          // ✅ this uses onOutput
  if (onOutput) onOutput(data);
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
    startExecution: (code: string, lang: string) => {
      if (socket.current?.readyState === WebSocket.OPEN) {
        term.current?.clear();
        inputBuffer.current = "";

        // 1️⃣ Notify server about language change
        if (lang !== currentLang.current) {
          socket.current.send(JSON.stringify({ type: "lang", lang }));
          currentLang.current = lang;
        }

        // 2️⃣ Send code to execute
        socket.current.send(JSON.stringify({ type: "execute", code }));
      } else {
        console.error("WebSocket not connected yet");
      }
    },
  // Add this new method
  switchLanguage: (lang: string) => {
    if (socket.current?.readyState === WebSocket.OPEN && lang !== currentLang.current) {
      term.current?.clear();
      inputBuffer.current = "";
      socket.current.send(JSON.stringify({ type: "lang", lang }));
      currentLang.current = lang;
    }
  },
    

  }));

  return (
    <div className="h-full flex flex-col rounded border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
          INTERACTIVE TERMINAL
        </span>
      </div>
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
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

  // Derive theme for both effects and render
  const isDark = theme === "dark" || (theme === "system" && resolvedTheme === "dark");
  const currentTheme = isDark ? darkTheme : lightTheme;

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const term = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const socket = useRef<WebSocket | null>(null);
  const inputBuffer = useRef<string>("");
  const isSessionReady = useRef<boolean>(false); // Track if backend session is ready
  const isSwitching = useRef<boolean>(false); // Track if currently switching languages

  const currentLang = useRef<string>("python"); // default
  const wsEndpoint = wsUrl || "ws://localhost:5002";

  const safeFit = () => {
    if (!fitAddon.current || !term.current) return;

    // Use requestAnimationFrame to ensure DOM is ready and prevent race conditions
    requestAnimationFrame(() => {
      try {
        if (
          term.current &&
          term.current.element &&
          terminalRef.current &&
          terminalRef.current.offsetWidth > 0 &&
          terminalRef.current.offsetHeight > 0 &&
          // Check if element is actually attached to DOM
          document.body.contains(terminalRef.current)
        ) {
          fitAddon.current?.fit();
        }
      } catch (error) {
        console.warn("Terminal fit suppressed:", error);
      }
    });
  };

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current) return;

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

    const observer = new ResizeObserver(() => safeFit());
    observer.observe(terminalRef.current);

    const handleResizeWindow = () => {
      safeFit();
    };
    window.addEventListener("resize", handleResizeWindow);

    // Delay initial fit
    const fitTimeout = setTimeout(() => {
      safeFit();
    }, 200);

    let pingInterval: NodeJS.Timeout;

    // WebSocket setup with debounce and heartbeat
    const connectTimeout = setTimeout(() => {
      if (!term.current) return;

      const ws = new WebSocket(wsEndpoint);
      socket.current = ws;

      // Heartbeat interval
      pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000); // 25 seconds

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

        if (msg.type === "ready") {
          // Backend session is now ready for this language
          isSessionReady.current = true;
          isSwitching.current = false;
          currentLang.current = msg.lang;
          term.current.write(`\r\n\x1b[1;32m✅ Ready for ${msg.lang}\x1b[0m\r\n`);
          console.log("Session ready for language:", msg.lang);
        } else if (msg.type === "lang") {
          // Language switch confirmed - also mark session as ready
          isSessionReady.current = true;
          isSwitching.current = false;
          currentLang.current = msg.lang;
          term.current.write(`\r\n\x1b[1;32m✅ Language set to ${msg.lang}\x1b[0m\r\n`);
          console.log("Language switched and ready:", msg.lang);
        } else if (msg.type === "pong") {
          // Heartbeat response, ignore
        } else if (msg.type === "error") {
          // Display error message from backend
          term.current.write(`\r\n\x1b[1;31m⚠️ ${msg.message || "An error occurred"}\x1b[0m\r\n`);
          console.error("Backend error:", msg.message);
          isSessionReady.current = true;
          isSwitching.current = false;
        } else {
          const data = msg.data ?? msg;

          // Ensure data is string before checking for images
          if (typeof data !== 'string') {
            // If it's an object we don't know how to handle, just ignore or stringify
            console.log("Received non-string data:", data);
            return;
          }

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
    }, 100);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", handleResizeWindow);

      clearTimeout(fitTimeout);
      clearTimeout(connectTimeout);
      if (pingInterval) clearInterval(pingInterval);

      if (term.current) {
        term.current.dispose();
        term.current = null;
      }
      fitAddon.current = null;

      if (socket.current) {
        if (socket.current.readyState === WebSocket.OPEN || socket.current.readyState === WebSocket.CONNECTING) {
          socket.current.close();
        }
        socket.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsEndpoint]); // Re-run only if endpoint changes

  // Update options dynamically
  useEffect(() => {
    if (!term.current) return;

    term.current.options.fontSize = fontSize;
    term.current.options.fontFamily = fontFamily;
    term.current.options.theme = currentTheme;

    if (terminalRef.current) {
      terminalRef.current.style.backgroundColor = currentTheme.background || "#ffffff";
    }
    safeFit();
  }, [fontSize, fontFamily, currentTheme]);


  useImperativeHandle(ref, () => ({
    startExecution: (filesOrCode: FileData[] | string, activeFileOrLang?: string) => {
      if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
        term.current?.write("\r\n\x1b[1;31m❌ WebSocket not connected!\x1b[0m\r\n");
        return;
      }

      // Check if session is ready (not still switching languages)
      if (isSwitching.current || !isSessionReady.current) {
        term.current?.write("\r\n\x1b[1;33m⏳ Waiting for session to be ready...\x1b[0m\r\n");

        // Retry with multiple attempts
        let retryCount = 0;
        const maxRetries = 5;

        const retryExecution = () => {
          retryCount++;
          if (isSessionReady.current && !isSwitching.current) {
            performExecution(filesOrCode, activeFileOrLang);
          } else if (retryCount < maxRetries) {
            term.current?.write(`\r\n\x1b[1;33m⏳ Still waiting... (attempt ${retryCount}/${maxRetries})\x1b[0m\r\n`);
            setTimeout(retryExecution, 1000);
          } else {
            term.current?.write("\r\n\x1b[1;31m❌ Session not ready after multiple attempts. Please try again.\x1b[0m\r\n");
          }
        };
        setTimeout(retryExecution, 1000);
        return;
      }

      performExecution(filesOrCode, activeFileOrLang);
    },
    switchLanguage: (newLang: string) => {
      currentLang.current = newLang;
      isSwitching.current = true;
      isSessionReady.current = false;

      // Check if WebSocket is connected before sending
      if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
        term.current?.write(`\r\n\x1b[1;33m⚠️ Waiting for connection to switch to ${newLang}...\x1b[0m\r\n`);
        // Retry after a short delay when connection is ready
        const checkConnection = setInterval(() => {
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            const msg = JSON.stringify({ type: "lang", lang: newLang });
            socket.current.send(msg);
            term.current?.clear();
            term.current?.write(`\r\n\x1b[1;33m📝 Switching to ${newLang}...\x1b[0m\r\n`);
          }
        }, 100);
        // Clear interval after 5 seconds to prevent memory leak
        setTimeout(() => clearInterval(checkConnection), 5000);
        return;
      }

      const msg = JSON.stringify({ type: "lang", lang: newLang });
      socket.current.send(msg);
      term.current?.clear();
      term.current?.write(`\r\n\x1b[1;33m📝 Switching to ${newLang}...\x1b[0m\r\n`);
    },
  }));

  // Helper function to perform actual execution
  const performExecution = (filesOrCode: FileData[] | string, activeFileOrLang?: string) => {
    // Clear terminal before running
    term.current?.clear();

    if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
      term.current?.write("\r\n\x1b[1;31m❌ WebSocket not connected!\x1b[0m\r\n");
      return;
    }

    // Determine if this is multi-file or single-file mode
    const isMultiFile = Array.isArray(filesOrCode);

    if (isMultiFile) {
      const files = filesOrCode as FileData[];
      const activeFileName = activeFileOrLang!;

      // Send all files to the backend
      files.forEach((file, index) => {
        const msg = JSON.stringify({
          type: "file",
          data: file.content,
          filename: file.name,
          isLast: index === files.length - 1,
          activeFile: file.name === activeFileName
        });
        socket.current?.send(msg);
      });

      term.current?.write(`\r\n\x1b[1;36m🚀 Running ${activeFileName}...\x1b[0m\r\n\n`);
    } else {
      // Single-file mode (backward compatibility)
      const code = filesOrCode as string;
      const msg = JSON.stringify({ type: "execute", data: code });
      socket.current?.send(msg);
      term.current?.write(`\r\n\x1b[1;36m🚀 Running code...\x1b[0m\r\n\n`);
    }
  };

  return (
    <div className="h-full flex flex-col rounded border border-gray-200 dark:border-gray-700 overflow-hidden">

      <div
        ref={terminalRef}
        className="flex-1"
        style={{ overflow: "hidden", backgroundColor: currentTheme.background }}
      />
    </div>
  );
});

InteractiveTerminal.displayName = "InteractiveTerminal";
export default InteractiveTerminal;

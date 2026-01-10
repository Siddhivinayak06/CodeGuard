"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Sparkles, Loader2, Copy, Check, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import { motion, AnimatePresence } from "framer-motion";

// --------- helpers ---------
function extractText(children: React.ReactNode): string {
    if (children == null) return "";
    if (typeof children === "string" || typeof children === "number") return String(children);
    if (Array.isArray(children)) return children.map(extractText).join("");
    if (children && typeof children === "object" && "props" in children) {
        const props = (children as any).props;
        if (props && props.children) {
            return extractText(props.children);
        }
    }
    return "";
}

function normalizeMarkdown(text: string) {
    return text
        .replace(/\n{3,}/g, "\n\n")
        .replace(/([a-zA-Z]):\n([A-Z])/g, "$1\n\n$2")
        .trim();
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);
    const onCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
            onClick={onCopy}
            title="Copy"
        >
            {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
            ) : (
                <Copy className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors" />
            )}
        </Button>
    );
}

// --------- types ---------
interface Message {
    id: string;
    role: "user" | "model";
    text: string;
}

interface CodeContext {
    code: string;
    activeFile?: string;
    files?: { name: string; language: string }[];
    cursorPosition?: { lineNumber: number; column: number };
}

interface AssistantPanelProps {
    codeContext: CodeContext;
    onClose: () => void;
}

// Message animation variants
const messageVariants = {
    initial: { opacity: 0, y: 10, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -10, scale: 0.95 }
};

// --------- component ---------
export function AssistantPanel({ codeContext, onClose }: AssistantPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        { id: crypto.randomUUID(), role: "model", text: "Hello! I'm your AI coding assistant. How can I help you today?" },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    const viewportRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    const md = useMemo(() => ({ rehypePlugins: [rehypeHighlight] }), []);

    async function handleSend() {
        if (!input.trim() || loading) return;

        const userMsg: Message = { id: crypto.randomUUID(), role: "user", text: input };
        setMessages((p) => [...p, userMsg]);
        setInput("");
        setLoading(true);

        const modelId = crypto.randomUUID();
        setMessages((p) => [...p, { id: modelId, role: "model", text: "" }]);

        try {
            const apiMessages = [...messages, userMsg].map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
            const config = JSON.parse(localStorage.getItem("ai_settings") || "{}");
            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

            const res = await fetch(`${apiUrl}/chat2`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: apiMessages, codeContext, config }),
            });
            if (!res.ok || !res.body) throw new Error(res.statusText || "No response body");

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
                    const parsed = JSON.parse(payload);
                    if (parsed?.text) {
                        setMessages((p) => p.map((m) => (m.id === modelId ? { ...m, text: m.text + parsed.text } : m)));
                    }
                }
            }
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            setMessages((p) => p.map((m) => (m.role === "model" && !m.text ? { ...m, text: `Error: ${errMsg}` } : m)));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden border-l border-gray-200 dark:border-white/10 bg-gradient-to-b from-gray-50 via-white to-gray-50 dark:from-gray-900/95 dark:via-gray-900/98 dark:to-gray-950 backdrop-blur-xl shadow-2xl transition-colors duration-300">
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-blue-500/5 pointer-events-none" />

            {/* Header */}
            <div className="relative flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-4 py-3 bg-gradient-to-r from-purple-500/5 via-transparent to-blue-500/5 dark:from-purple-500/10 dark:to-blue-500/10">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
                            <Sparkles className="h-4 w-4 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900 animate-pulse" />
                    </div>
                    <div>
                        <span className="text-sm font-bold text-gray-900 dark:text-white">AI Assistant</span>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">Powered by AI</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-8 w-8 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-all"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Messages */}
            <div className="relative flex-1 min-h-0">
                <ScrollArea className="h-full" viewportRef={viewportRef}>
                    <div className="space-y-4 p-4">
                        <AnimatePresence mode="popLayout">
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    variants={messageVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={{ duration: 0.2, ease: "easeOut" }}
                                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    {msg.role === "model" && (
                                        <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                            <Bot className="h-4 w-4 text-white" />
                                        </div>
                                    )}
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm transition-all ${msg.role === "user"
                                            ? "bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg shadow-blue-500/20"
                                            : "bg-gray-100 dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 text-gray-800 dark:text-gray-100"
                                            }`}
                                    >
                                        {msg.role === "user" ? (
                                            msg.text
                                        ) : (
                                            <div className="prose prose-sm max-w-none dark:prose-invert prose-p:text-gray-700 dark:prose-p:text-gray-200 prose-headings:text-gray-900 dark:prose-headings:text-white prose-strong:text-gray-900 dark:prose-strong:text-white prose-code:text-purple-600 dark:prose-code:text-purple-300">
                                                <ReactMarkdown
                                                    {...md}
                                                    components={{
                                                        code({ inline, className, children, ...props }: React.ComponentPropsWithoutRef<"code"> & { inline?: boolean }) {
                                                            const lang = /language-(\w+)/.exec(className || "")?.[1];
                                                            const text = extractText(children);
                                                            if (!inline && !lang && !text.includes("\n")) {
                                                                return <span className="font-mono text-purple-600 dark:text-purple-300 bg-purple-100 dark:bg-purple-500/20 px-1.5 py-0.5 rounded">{text}</span>;
                                                            }
                                                            if (!inline) {
                                                                return (
                                                                    <div className="relative my-4 overflow-hidden rounded-xl bg-transparent dark:bg-gray-900 p-0 dark:p-3 shadow-sm dark:shadow-lg dark:ring-1 dark:ring-white/10">
                                                                        <div className="overflow-hidden rounded-lg bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-white/5">
                                                                            <div className="flex items-center justify-between bg-white dark:bg-[#252526] px-4 py-3 border-b border-gray-100 dark:border-white/5">
                                                                                <div className="flex items-center gap-2">
                                                                                    <div className="flex items-center gap-1.5 opacity-100">
                                                                                        <div className="w-3 h-3 rounded-full bg-[#ff5f56] shadow-sm border border-black/5 dark:border-transparent" />
                                                                                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] shadow-sm border border-black/5 dark:border-transparent" />
                                                                                        <div className="w-3 h-3 rounded-full bg-[#27c93f] shadow-sm border border-black/5 dark:border-transparent" />
                                                                                    </div>
                                                                                    <span className="ml-3 text-xs font-bold text-gray-400 dark:text-gray-500 font-mono tracking-wider">{lang || "TEXT"}</span>
                                                                                </div>
                                                                                <CopyButton text={text.replace(/\n$/, "")} />
                                                                            </div>
                                                                            <div className="relative bg-[#fbfcff] dark:bg-[#1e1e1e]">
                                                                                <pre className="overflow-x-auto p-4 not-prose text-[13px] leading-relaxed text-gray-800 dark:text-gray-300 font-mono scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700 hover:scrollbar-thumb-gray-300 dark:hover:scrollbar-thumb-gray-600"><code className={className} {...props}>{children}</code></pre>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                            return <code className="rounded bg-gray-50 dark:bg-white/10 px-1.5 py-0.5 font-mono text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-white/5" {...props}>{children}</code>;
                                                        },
                                                    }}
                                                >
                                                    {normalizeMarkdown(msg.text)}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                    {
                                        msg.role === "user" && (
                                            <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                                <User className="h-4 w-4 text-white" />
                                            </div>
                                        )
                                    }
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {loading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex gap-3 justify-start"
                            >
                                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                    <Bot className="h-4 w-4 text-white" />
                                </div>
                                <div className="rounded-2xl bg-gray-100 dark:bg-white/5 backdrop-blur-sm border border-gray-200 dark:border-white/10 px-4 py-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </ScrollArea>
            </div >

            {/* Input */}
            < div className="relative border-t border-gray-200 dark:border-white/10 p-4 bg-gradient-to-t from-gray-100 dark:from-gray-950 to-transparent" >
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <div className="relative flex-1">
                        <Textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Ask anything about your code… (Shift+Enter for new line)"
                            disabled={loading}
                            className="w-full min-h-[50px] max-h-[200px] resize-none bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl py-3 px-4 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all shadow-sm scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-700"
                        />
                    </div>
                    <Button
                        type="submit"
                        size="icon"
                        disabled={loading || !input.trim()}
                        className="h-[42px] w-[42px] rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all hover:-translate-y-0.5"
                    >
                        <Send className="h-4 w-4 text-white" />
                    </Button>
                </form>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-2">AI can make mistakes. Verify important code.</p>
            </div >
        </div >
    );
}


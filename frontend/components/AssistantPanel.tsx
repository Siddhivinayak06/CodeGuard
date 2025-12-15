"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Sparkles, Loader2, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

// --------- helpers ---------
function extractText(children: any): string {
    if (children == null) return "";
    if (typeof children === "string" || typeof children === "number") return String(children);
    if (Array.isArray(children)) return children.map(extractText).join("");
    if (children?.props?.children) return extractText(children.props.children);
    return "";
}
function normalizeMarkdown(text: string) {
    return text
        .replace(/\n{3,}/g, "\n\n") // collapse excessive newlines
        .replace(/([a-zA-Z]):\n([A-Z])/g, "$1\n\n$2") // paragraph break after headings
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
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCopy} title="Copy">
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
    );
}

// --------- types ---------
interface Message {
    id: string;
    role: "user" | "model";
    text: string;
}

interface AssistantPanelProps {
    codeContext: any;
    onClose: () => void;
}

// --------- component ---------
export function AssistantPanel({ codeContext, onClose }: AssistantPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        { id: crypto.randomUUID(), role: "model", text: "Hello! I’m your AI coding assistant. How can I help?" },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);

    // ScrollArea does not forward ref; use viewportRef
    const viewportRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        viewportRef.current?.scrollTo({ top: viewportRef.current.scrollHeight, behavior: "smooth" });
    }, [messages, loading]);

    const md = useMemo(() => ({ rehypePlugins: [rehypeHighlight] as any[] }), []);

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

            const res = await fetch(`${apiUrl}/chat`, {
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

                // Robust SSE parsing
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
        } catch (e: any) {
            setMessages((p) => p.map((m) => (m.role === "model" && !m.text ? { ...m, text: `Error: ${e.message || e}` } : m)));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex h-full w-full flex-col overflow-hidden border-l bg-background shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    <span className="text-sm font-semibold">AI Assistant</span>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
            </div>

            {/* Messages */}
            <div className="relative flex-1 min-h-0">
                <ScrollArea className="h-full" viewportRef={viewportRef}>
                    <div className="space-y-4 p-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-blue-600 text-white" : "bg-muted"}`}>
                                    {msg.role === "user" ? (
                                        msg.text
                                    ) : (
                                        <div className="prose prose-sm max-w-none dark:prose-invert">
                                            <ReactMarkdown
                                                {...md}
                                                components={{
                                                    code({ inline, className, children, ...props }: any) {
                                                        const lang = /language-(\w+)/.exec(className || "")?.[1];
                                                        // Treat single-line, no-language blocks as inline text to avoid noisy TEXT boxes
                                                        const text = extractText(children);
                                                        if (!inline && !lang && !text.includes("\n")) {
                                                            return <span className="font-mono">{text}</span>;
                                                        }
                                                        if (!inline) {
                                                            return (
                                                                <div className="relative my-3 overflow-hidden rounded-lg border">
                                                                    <div className="flex items-center justify-between border-b bg-muted px-3 py-1.5">
                                                                        <span className="text-xs uppercase opacity-60">{lang || "code"}</span>
                                                                        <CopyButton text={text.replace(/\n$/, "")} />
                                                                    </div>
                                                                    <pre className="overflow-x-auto p-3 not-prose"><code className={className} {...props}>{children}</code></pre>
                                                                </div>
                                                            );
                                                        }
                                                        return <code className="rounded bg-muted px-1.5 py-0.5 font-mono" {...props}>{children}</code>;
                                                    },
                                                }}
                                            >
                                                {normalizeMarkdown(msg.text)}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start"><div className="rounded-lg bg-muted px-3 py-2"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input */}
            <div className="border-t p-4">
                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                    <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" disabled={loading} />
                    <Button type="submit" size="icon" disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
                </form>
            </div>
        </div>
    );
}

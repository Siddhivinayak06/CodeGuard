"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, X, Sparkles, Loader2, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={handleCopy}
            title="Copy code"
        >
            {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
                <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            )}
        </Button>
    );
}

interface Message {
    role: "user" | "model";
    text: string;
}

interface AssistantPanelProps {
    codeContext: any; // Can be string or structured object
    onClose: () => void;
}

export function AssistantPanel({ codeContext, onClose }: AssistantPanelProps) {
    const [messages, setMessages] = useState<Message[]>([
        { role: "model", text: "Hello! I'm your AI coding assistant. How can I help you today?" },
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: "user", text: input };
        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setLoading(true);

        try {
            const apiMessages = [...messages, userMsg].map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const savedSettings = localStorage.getItem("ai_settings");
            const config = savedSettings ? JSON.parse(savedSettings) : {};
            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

            const res = await fetch(`${apiUrl}/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: apiMessages,
                    codeContext,
                    config,
                }),
            });

            if (!res.ok) throw new Error(res.statusText);
            if (!res.body) throw new Error("No response body");

            // Add empty model message to start streaming into
            setMessages((prev) => [...prev, { role: "model", text: "" }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split("\n");

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const data = line.slice(6);
                        if (data.trim() === "[DONE]") break;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.text) {
                                setMessages((prev) => {
                                    const newMsgs = [...prev];
                                    const lastMsg = newMsgs[newMsgs.length - 1];
                                    if (lastMsg.role === "model") {
                                        lastMsg.text += parsed.text;
                                    }
                                    return newMsgs;
                                });
                            } else if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                        } catch (e) {
                            console.error("Error parsing stream:", e);
                        }
                    }
                }
            }
        } catch (err: any) {
            setMessages((prev) => {
                // Remove the empty streaming message if it exists and is empty, or append error
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === "model" && lastMsg.text === "") {
                    lastMsg.text = "Sorry, I encountered an error. " + (err.message || "");
                } else {
                    newMsgs.push({ role: "model", text: "Error: " + (err.message || "Unknown error") });
                }
                return newMsgs;
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 w-full shadow-xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-sm">AI Assistant</span>
                </div>
                <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
                    <X className="w-4 h-4" />
                </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-hidden relative min-h-0">
                <ScrollArea className="h-full w-full p-4" ref={scrollRef}>
                    <div className="space-y-4">
                        {messages.map((msg, i) => (
                            <div
                                key={i}
                                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm max-w-full ${msg.role === "user"
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                                        }`}
                                >
                                    {msg.role === "user" ? (
                                        msg.text
                                    ) : (
                                        <div className="prose dark:prose-invert prose-sm max-w-none">
                                            <ReactMarkdown
                                                rehypePlugins={[rehypeHighlight]}
                                                components={{
                                                    code({ node, inline, className, children, ...props }: any) {
                                                        const match = /language-(\w+)/.exec(className || "");
                                                        const language = match ? match[1] : "";

                                                        if (!inline && match) {
                                                            return (
                                                                <div className="relative my-4 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                                                                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                                                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                                                                            {language}
                                                                        </span>
                                                                        <CopyButton text={String(children).replace(/\n$/, '')} />
                                                                    </div>
                                                                    <div className="p-3 overflow-x-auto">
                                                                        <code className={`${className} !bg-transparent !p-0`} {...props}>
                                                                            {children}
                                                                        </code>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <code className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                                                                {children}
                                                            </code>
                                                        );
                                                    }
                                                }}
                                            >
                                                {msg.text}
                                            </ReactMarkdown>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                    }}
                    className="flex gap-2"
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask a question..."
                        disabled={loading}
                        className="flex-1"
                    />
                    <Button type="submit" size="icon" disabled={loading || !input.trim()}>
                        <Send className="w-4 h-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
}

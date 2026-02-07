"use client";

import React, { useState } from "react";
import {
    X,
    Upload,
    FileText,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Plus,
    Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Practical, TestCase } from "../types";

interface GeneratedPractical {
    title: string;
    practical_number?: number;
    description: string;
    max_marks: number;
    testCases: TestCase[];
    enableLevels?: boolean;
    language?: string;
    reference_code?: string;
    deadline?: string;
    levels?: {
        level: "easy" | "medium" | "hard";
        title: string;
        description: string;
        max_marks: number;
        reference_code?: string;
        testCases: TestCase[];
    }[];
}

interface BulkImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (practicals: GeneratedPractical[]) => Promise<void>;
    subjectId: number | string;
}

export default function BulkImportModal({
    isOpen,
    onClose,
    onImport,
    subjectId,
}: BulkImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<GeneratedPractical[]>([]);
    const [activeStep, setActiveStep] = useState<"upload" | "preview">("upload");

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError("Please select a PDF file first.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const formData = new FormData();
            formData.append("pdf", file);

            // Use the environment variable for API URL or default to localhost
            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";

            const res = await fetch(`${apiUrl}/generate-bulk-practicals-from-pdf`, {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to process PDF");
            }

            const data = await res.json();

            if (!data.practicals || !Array.isArray(data.practicals)) {
                throw new Error("Invalid response format from AI");
            }

            const formatted: GeneratedPractical[] = data.practicals.map((p: any, idx: number) => {
                const levels = Array.isArray(p.levels) ? p.levels.map((l: any, lIdx: number) => ({
                    level: lIdx === 0 ? "easy" : "hard", // Set first level to easy, others to hard as per instruction
                    title: l.title || "",
                    description: l.description || "",
                    max_marks: Number(l.max_marks) || 10,
                    reference_code: l.reference_code || "",
                    testCases: Array.isArray(l.testCases) ? l.testCases.map((tc: any) => ({
                        input: String(tc.input || ""),
                        expected_output: String(tc.expected_output || ""),
                        is_hidden: false,
                        time_limit_ms: 2000,
                        memory_limit_kb: 65536,
                        id: Math.random(),
                        practical_id: null,
                        level_id: null,
                        created_at: new Date().toISOString()
                    })) : []
                })) : [];

                // Strict logic: Mulit-level only if more than 1 (or at least 1? No, single task is single level).
                // If AI returns levels array with > 1 item, it's multilevel.
                // If AI returns levels array with 1 item, treat as single level for simplicity unless explicitly requested?
                // User said "single task off the multi-level mode".
                const isMultilevel = levels.length > 1;

                // Fallback: If root description/code is empty but present in first level, use it.
                // This handles cases where AI puts everything in "Task 1" even for single-level practicals.
                const fallbackDescription = levels.length > 0 ? levels[0].description : "";
                const fallbackCode = levels.length > 0 ? levels[0].reference_code : "";

                // Calculate staggered deadline: 1 week gap per practical
                const baseDate = new Date();
                baseDate.setDate(baseDate.getDate() + 7 * (idx + 1)); // First practical is 1 week from now
                const deadline = baseDate.toISOString().slice(0, 16);

                return {
                    title: p.title || "Untitled Practical",
                    practical_number: Number(p.practical_number) || undefined,
                    description: p.description || fallbackDescription || "",
                    max_marks: Number(p.max_marks) || 10,
                    enableLevels: isMultilevel,
                    language: p.language || "c",
                    reference_code: p.reference_code || fallbackCode || "",
                    deadline: deadline, // Staggered deadline
                    testCases: Array.isArray(p.testCases) ? p.testCases.map((tc: any) => ({
                        input: String(tc.input || ""),
                        expected_output: String(tc.expected_output || ""),
                        is_hidden: false,
                        time_limit_ms: 2000,
                        memory_limit_kb: 65536,
                        id: Math.random(),
                        practical_id: null,
                        level_id: null,
                        created_at: new Date().toISOString()
                    })) : [],
                    levels: levels
                };
            });

            setPreviewData(formatted);
            setActiveStep("preview");
        } catch (err: any) {
            console.error("Upload error:", err);
            setError(err.message || "Failed to upload and process file.");
        } finally {
            setLoading(false);
        }
    };

    const handleFinalImport = async () => {
        setLoading(true);
        try {
            await onImport(previewData);
            onClose();
        } catch (err) {
            console.error("Import error:", err);
            setError("Failed to save imported practicals.");
        } finally {
            setLoading(false);
        }
    };

    const removePractical = (index: number) => {
        setPreviewData(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-card-premium rounded-3xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col animate-scaleIn bg-white dark:bg-gray-900">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                            <Upload className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                Import from PDF
                            </h3>
                            <p className="text-sm text-gray-500">
                                Bulk create practicals from a lab manual
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onClose}
                        className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 bg-gray-50/50 dark:bg-gray-950/50">

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-400">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {activeStep === "upload" ? (
                        <div className="flex flex-col items-center justify-center h-full min-h-[300px] border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-900/50 p-8 text-center transition-all hover:border-indigo-400 dark:hover:border-indigo-600">
                            <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
                                <FileText className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                Upload Lab Manual PDF
                            </h4>
                            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
                                Select a PDF file containing your experiment list. We will extract titles, descriptions, and generate test cases.
                            </p>

                            <div className="relative">
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    disabled={loading}
                                />
                                <Button
                                    disabled={loading}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/30 rounded-xl px-8 py-6 h-auto text-base"
                                >
                                    {file ? file.name : "Select PDF File"}
                                </Button>
                            </div>

                            {loading && (
                                <div className="mt-8 flex flex-col items-center text-indigo-600 dark:text-indigo-400 animate-fadeIn">
                                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                    <span className="text-sm font-medium">Analyzing PDF & Generating Practicals...</span>
                                    <span className="text-xs text-gray-400 mt-1">This may take a minute</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                    Found {previewData.length} Experiments
                                </h4>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveStep("upload")}
                                    className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                                >
                                    Start Over
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {previewData.map((practical, idx) => (
                                    <div
                                        key={idx}
                                        className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all group"
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h5 className="font-bold text-gray-900 dark:text-white text-lg">
                                                    {practical.title}
                                                </h5>
                                                <p className="text-xs text-gray-500 font-mono mt-1">
                                                    Max Marks: {practical.max_marks} • Test Cases: {practical.testCases.length}
                                                </p>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removePractical(idx)}
                                                className="text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 line-clamp-2">
                                            {practical.description}
                                        </p>

                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-xs">
                                            <p className="font-medium text-gray-500 mb-2">Example Test Case:</p>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-gray-400 mb-1">Input</span>
                                                    <code className="block bg-white dark:bg-gray-950 px-2 py-1 rounded border border-gray-200 dark:border-gray-800 truncate">
                                                        {practical.testCases[0]?.input || "-"}
                                                    </code>
                                                </div>
                                                <div>
                                                    <span className="block text-gray-400 mb-1">Expected Output</span>
                                                    <code className="block bg-white dark:bg-gray-950 px-2 py-1 rounded border border-gray-200 dark:border-gray-800 truncate">
                                                        {practical.testCases[0]?.expected_output || "-"}
                                                    </code>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancel
                    </Button>
                    {activeStep === "upload" ? (
                        <Button
                            onClick={handleUpload}
                            disabled={!file || loading}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                "Analyze PDF"
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinalImport}
                            disabled={loading || previewData.length === 0}
                            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/20"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                `Import ${previewData.length} Practicals`
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

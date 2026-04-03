"use client";

import React, { useState, useEffect } from "react";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
    SheetFooter,
    SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
    Code2,
    FileText,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clock,
    ChevronLeft,
    ChevronRight,
    Save,
    Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

// Re-using interfaces roughly (will refine if needed in types.ts later)
interface TestCaseResult {
    id: number;
    test_case_id: number;
    status: string;
    stdout: string;
    stderr: string;
    input?: string;
    expected?: string;
    execution_time_ms: number;
    memory_used_kb: number;
}

interface TestCase {
    id: number;
    practical_id: number;
    input: string;
    expected_output: string;
    is_hidden: boolean;
}

export interface ViewingSubmission {
    id: number;
    submission_id: number;
    student_id: string;
    student_name: string;
    practical_id: number;
    practical_title: string;
    code: string;
    output: string;
    language: string;
    status: string;
    marks_obtained: number | null;
    created_at: string;
    roll_no?: string;
    testCaseResults?: TestCaseResult[];
}

interface GradingSheetProps {
    isOpen: boolean;
    onClose: () => void;
    submission: ViewingSubmission | null;
    testCases: TestCase[]; // passed from parent to avoid re-fetching if possible
    onSaveGrade: (submissionId: number, marks: number, status: string) => Promise<void>;
    onNext?: () => void;
    onPrev?: () => void;
    hasNext?: boolean;
    hasPrev?: boolean;
}

export default function GradingSheet({
    isOpen,
    onClose,
    submission,
    testCases,
    onSaveGrade,
    onNext,
    onPrev,
    hasNext,
    hasPrev,
}: GradingSheetProps) {
    const [gradeMarks, setGradeMarks] = useState<string>("");
    const [gradeStatus, setGradeStatus] = useState<string>("passed");
    const [gradingLoading, setGradingLoading] = useState(false);

    // Initialize state when submission changes
    useEffect(() => {
        if (submission) {
            setGradeMarks(submission.marks_obtained?.toString() || "");
            setGradeStatus(
                submission.status === "pending" || submission.status === "submitted"
                    ? "passed"
                    : submission.status
            );
        }
    }, [submission]);

    if (!submission) return null;

    const handleSave = async () => {
        if (!gradeMarks) {
            alert("Please enter marks");
            return;
        }
        setGradingLoading(true);
        try {
            await onSaveGrade(submission.id, parseInt(gradeMarks), gradeStatus);
        } catch (e) {
            console.error(e);
        } finally {
            setGradingLoading(false);
        }
    };

    // Helper for Status Badge in Header — supports both legacy and new grade statuses
    const StatusBadge = ({ status }: { status: string }) => {
        const styles: Record<string, string> = {
            excellent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200",
            very_good: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200",
            good: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border-cyan-200",
            needs_improvement: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200",
            poor: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200",
            passed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200",
            failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200",
            pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200",
            submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200",
        };
        const labels: Record<string, string> = {
            excellent: "Excellent",
            very_good: "Very Good",
            good: "Good",
            needs_improvement: "Needs Improvement",
            poor: "Poor",
        };
        const style = styles[status?.toLowerCase()] || styles.pending;
        const label = labels[status?.toLowerCase()] || status;
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style} capitalize`}>
                {label}
            </span>
        )
    }

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl overflow-y-auto bg-slate-50 dark:bg-slate-950 p-0 sm:p-0">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-10">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <SheetTitle className="text-xl font-bold font-display">
                                    {submission.student_name}
                                </SheetTitle>
                                <SheetDescription className="flex items-center gap-2 mt-1">
                                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400">
                                        {submission.roll_no || submission.student_id}
                                    </span>
                                    <span>•</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                        {submission.practical_title}
                                    </span>
                                </SheetDescription>
                            </div>
                            <StatusBadge status={submission.status} />
                        </div>

                        {/* Navigation & Actions */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onPrev}
                                    disabled={!hasPrev}
                                    className="h-8 w-8 p-0 rounded-full"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                                    Navigate
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onNext}
                                    disabled={!hasNext}
                                    className="h-8 w-8 p-0 rounded-full"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                            {/* Could add download PDF here if needed */}
                        </div>
                    </div>

                    <div className="flex-1 p-6 space-y-8">
                        {/* Grading Section - Always Visible for quick access */}
                        <div className="bg-white dark:bg-gray-900 rounded-xl border border-indigo-100 dark:border-indigo-900/50 shadow-sm p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                    Grading & Feedback
                                </h3>
                            </div>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                                        Marks Obtained (out of 10)
                                    </label>
                                    <Input
                                        type="number"
                                        min="0"
                                        max="10"
                                        value={gradeMarks}
                                        onChange={(e) => setGradeMarks(e.target.value)}
                                        className="bg-gray-50 dark:bg-gray-800 text-lg font-bold text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                                        Status
                                    </label>
                                    <Select value={gradeStatus} onValueChange={setGradeStatus}>
                                        <SelectTrigger className="bg-gray-50 dark:bg-gray-800">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="excellent">🏆 Excellent</SelectItem>
                                            <SelectItem value="very_good">⭐ Very Good</SelectItem>
                                            <SelectItem value="good">✅ Good</SelectItem>
                                            <SelectItem value="needs_improvement">📝 Needs Improvement</SelectItem>
                                            <SelectItem value="poor">❌ Poor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    onClick={handleSave}
                                    disabled={gradingLoading}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[100px]"
                                >
                                    {gradingLoading ? "Saving..." : <><Save className="w-4 h-4 mr-2" /> Save</>}
                                </Button>
                            </div>
                        </div>

                        {/* Code View */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Code2 className="w-4 h-4 text-gray-500" />
                                Source Code
                                <Badge variant="secondary" className="ml-auto text-xs uppercase">
                                    {submission.language}
                                </Badge>
                            </h3>
                            <div className="relative rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-950 overflow-hidden">
                                <div className="absolute top-2 right-2 flex gap-1">
                                    {/* Copy button could go here */}
                                </div>
                                <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed">
                                    {submission.code || "// No code submitted"}
                                </pre>
                            </div>
                        </div>

                        {/* Output */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-gray-500" />
                                Execution Output
                            </h3>
                            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-4 text-sm font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                                {submission.output || <span className="text-gray-400 italic">No output captured</span>}
                            </div>
                        </div>

                        {/* Test Case Results */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Clock className="w-4 h-4 text-gray-500" />
                                Test Cases
                            </h3>
                            <div className="grid gap-3">
                                {submission.testCaseResults && submission.testCaseResults.length > 0 ? (
                                    submission.testCaseResults.map((result, idx) => {
                                        const tc = testCases.find(t => Number(t.id) === Number(result.test_case_id));
                                    const isPassed = result.status.toLowerCase() === 'passed' || result.status.toLowerCase() === 'accepted';
                                        
                                        // Verdict config for the test case
                                        const tcVerdictConfig: Record<string, { label: string; color: string }> = {
                                            accepted: { label: 'Accepted', color: 'emerald' },
                                            passed: { label: 'Accepted', color: 'emerald' },
                                            wrong_answer: { label: 'Wrong Answer', color: 'red' },
                                            time_limit_exceeded: { label: 'TLE', color: 'amber' },
                                            memory_limit_exceeded: { label: 'MLE', color: 'purple' },
                                            runtime_error: { label: 'Runtime Error', color: 'rose' },
                                            compile_error: { label: 'Compile Error', color: 'orange' },
                                            failed: { label: 'Failed', color: 'red' },
                                        };
                                        const tcVC = tcVerdictConfig[result.status.toLowerCase()] || { label: result.status, color: 'gray' };
                                        
                                        const colorClasses: Record<string, string> = {
                                            emerald: 'bg-emerald-50/50 border-emerald-100 dark:bg-emerald-900/10 dark:border-emerald-900/50',
                                            red: 'bg-red-50/50 border-red-100 dark:bg-red-900/10 dark:border-red-900/50',
                                            amber: 'bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/50',
                                            purple: 'bg-purple-50/50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/50',
                                            rose: 'bg-rose-50/50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/50',
                                            orange: 'bg-orange-50/50 border-orange-100 dark:bg-orange-900/10 dark:border-orange-900/50',
                                            gray: 'bg-gray-50/50 border-gray-100 dark:bg-gray-900/10 dark:border-gray-900/50',
                                        };
                                        const badgeClasses: Record<string, string> = {
                                            emerald: 'bg-emerald-600',
                                            red: 'bg-red-600',
                                            amber: 'bg-amber-600',
                                            purple: 'bg-purple-600',
                                            rose: 'bg-rose-600',
                                            orange: 'bg-orange-600',
                                            gray: 'bg-gray-600',
                                        };
                                        // Use result.input/expected if available (embedded in execution_details), otherwise fallback to tc
                                        const displayInput = result.input || tc?.input || "-";
                                        const displayExpected = result.expected || tc?.expected_output || "-";

                                        return (
                                            <div key={idx} className={`p-4 rounded-xl border ${colorClasses[tcVC.color] || colorClasses.gray}`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="font-medium text-sm text-gray-900 dark:text-gray-100">
                                                        Test Case #{idx + 1}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        {result.execution_time_ms > 0 && (
                                                            <span className="text-[10px] font-mono text-gray-400">{result.execution_time_ms}ms</span>
                                                        )}
                                                        {result.memory_used_kb > 0 && (
                                                            <span className="text-[10px] font-mono text-gray-400">{result.memory_used_kb > 1024 ? `${(result.memory_used_kb/1024).toFixed(1)}MB` : `${result.memory_used_kb}KB`}</span>
                                                        )}
                                                        <Badge variant={isPassed ? "default" : "destructive"} className={badgeClasses[tcVC.color] || ''}>
                                                            {tcVC.label}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono mt-2">
                                                    <div>
                                                        <div className="text-gray-500 mb-1">Input</div>
                                                        <div className="bg-white dark:bg-gray-950 p-2 rounded border border-gray-100 dark:border-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                            {displayInput}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-gray-500 mb-1">Expected</div>
                                                        <div className="bg-white dark:bg-gray-950 p-2 rounded border border-gray-100 dark:border-gray-800 whitespace-pre-wrap max-h-32 overflow-y-auto">
                                                            {displayExpected}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <div className="text-center py-6 text-gray-500 text-sm italic border rounded-xl border-dashed">
                                        No test case results available.
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
    Download,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Users,
    CheckCircle2,
    XCircle,
    X,
    Award,
    Target,
} from "lucide-react";

interface StudentPracticalMarks {
    student_name: string;
    roll_no: string;
    practicals: { title: string; marks: number | null }[];
}

interface SubjectReportViewProps {
    isOpen: boolean;
    onClose: () => void;
    subjectName: string;
    subjectCode: string;
    practicalTitles: string[];
    practicalDeadlines: string[];
    students: StudentPracticalMarks[];
    onDownloadPdf: () => void;
}

export default function SubjectReportView({
    isOpen,
    onClose,
    subjectName,
    subjectCode,
    practicalTitles,
    practicalDeadlines,
    students,
    onDownloadPdf,
}: SubjectReportViewProps) {
    // Calculate analytics
    const totalStudents = students.length;

    const practicalStats = practicalTitles.map((title, idx) => {
        const marks = students
            .map((s) => s.practicals[idx]?.marks)
            .filter((m): m is number => m !== null);

        const avg = marks.length > 0 ? marks.reduce((a, b) => a + b, 0) / marks.length : 0;
        const passed = marks.filter((m) => m >= 5).length;
        const submitted = marks.length;

        return {
            title,
            avg: avg.toFixed(1),
            passed,
            failed: submitted - passed,
            notSubmitted: totalStudents - submitted,
            passRate: submitted > 0 ? ((passed / submitted) * 100).toFixed(0) : "0",
        };
    });

    // Overall stats
    const allMarks = students.flatMap((s) =>
        s.practicals.map((p) => p.marks).filter((m): m is number => m !== null)
    );
    const overallAvg = allMarks.length > 0 ? (allMarks.reduce((a, b) => a + b, 0) / allMarks.length).toFixed(1) : "0";

    // Student performance ranking
    const studentPerformance = students.map((s) => {
        const validMarks = s.practicals.filter((p) => p.marks !== null);
        const total = validMarks.reduce((sum, p) => sum + (p.marks || 0), 0);
        const avg = validMarks.length > 0 ? total / validMarks.length : 0;
        return { ...s, total, avg, completed: validMarks.length };
    }).sort((a, b) => b.avg - a.avg);

    // Top and bottom performers
    const topPerformers = studentPerformance.slice(0, 3);
    const needsAttention = studentPerformance.filter(s => s.avg < 5 && s.completed > 0).slice(0, 3);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                    <div className="flex items-start justify-between">
                        <div className="text-white">
                            <h2 className="text-2xl font-bold">{subjectName} Report</h2>
                            <p className="text-white/80 text-sm mt-1">
                                <span className="font-mono bg-white/20 px-2 py-0.5 rounded text-xs mr-2">
                                    {subjectCode}
                                </span>
                                {totalStudents} Students • {practicalTitles.length} Practicals
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={onDownloadPdf}
                                className="bg-white text-indigo-600 hover:bg-gray-100 gap-2 font-semibold"
                            >
                                <Download className="w-4 h-4" />
                                Download PDF
                            </Button>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-gray-950">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                                    <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalStudents}</p>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Students</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                    <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{overallAvg}</p>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Avg Score</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <Award className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{topPerformers[0]?.avg.toFixed(1) || "-"}</p>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Top Score</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-900 rounded-xl p-5 border border-gray-100 dark:border-gray-800 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                    <Target className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{practicalTitles.length}</p>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Practicals</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Two Column Layout */}
                    <div className="grid lg:grid-cols-3 gap-6">
                        {/* Left: Practical Analysis */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                Practical-wise Performance
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {practicalStats.map((stat, i) => (
                                    <div
                                        key={i}
                                        className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1 min-w-0">
                                                <span className="inline-block px-2 py-0.5 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400 rounded mb-1">
                                                    P{i + 1}
                                                </span>
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate" title={stat.title}>
                                                    {stat.title}
                                                </p>
                                            </div>
                                            <span className="text-xl font-bold text-gray-900 dark:text-white ml-2">
                                                {stat.avg}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs">
                                            <span className="flex items-center gap-1 text-emerald-600">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> {stat.passed}
                                            </span>
                                            <span className="flex items-center gap-1 text-red-500">
                                                <XCircle className="w-3.5 h-3.5" /> {stat.failed}
                                            </span>
                                            <span className="text-gray-400 ml-auto font-medium">
                                                {stat.passRate}% pass
                                            </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="mt-3 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                                                style={{ width: `${stat.passRate}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right: Top/Bottom Performers */}
                        <div className="space-y-4">
                            {/* Top Performers */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    Top Performers
                                </h3>
                                <div className="space-y-2">
                                    {topPerformers.map((student, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-xl p-3"
                                        >
                                            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shadow-sm">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {student.student_name}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono">{student.roll_no}</p>
                                            </div>
                                            <span className="text-lg font-bold text-emerald-600">
                                                {student.avg.toFixed(1)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Needs Attention */}
                            <div>
                                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2 mb-3">
                                    <TrendingDown className="w-4 h-4 text-amber-500" />
                                    Needs Attention
                                </h3>
                                <div className="space-y-2">
                                    {needsAttention.length > 0 ? needsAttention.map((student, i) => (
                                        <div
                                            key={i}
                                            className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/50 rounded-xl p-3"
                                        >
                                            <span className="w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                                                !
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                    {student.student_name}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono">{student.roll_no}</p>
                                            </div>
                                            <span className="text-lg font-bold text-amber-600">
                                                {student.avg.toFixed(1)}
                                            </span>
                                        </div>
                                    )) : (
                                        <p className="text-sm text-gray-500 italic p-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-center">
                                            All students performing well! 🎉
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Full Marks Table */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
                            Complete Marks Grid
                        </h3>
                        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase w-12">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-600 dark:text-gray-400 uppercase">Roll</th>
                                            {practicalTitles.map((_, i) => (
                                                <th key={i} className="px-2 py-3 text-center text-xs font-bold text-gray-600 dark:text-gray-400 uppercase w-14">
                                                    P{i + 1}
                                                </th>
                                            ))}
                                            <th className="px-4 py-3 text-center text-xs font-bold text-indigo-600 uppercase">Total</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold text-indigo-600 uppercase">Avg</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                        {studentPerformance.map((student, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                <td className="px-4 py-3 text-gray-400 font-medium">{idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                                                    {student.student_name}
                                                </td>
                                                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{student.roll_no}</td>
                                                {student.practicals.map((p, pIdx) => (
                                                    <td key={pIdx} className="px-2 py-3 text-center">
                                                        {p.marks !== null ? (
                                                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold ${p.marks >= 8 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                                                p.marks >= 5 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                                                                    "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                                }`}>
                                                                {p.marks}
                                                            </span>
                                                        ) : (
                                                            (() => {
                                                                const deadline = practicalDeadlines[pIdx];
                                                                const isExpired = deadline && new Date(deadline).getTime() < Date.now();
                                                                if (isExpired) {
                                                                    return <span className="text-red-400 dark:text-red-900/50 text-[10px] uppercase font-bold">Abs</span>;
                                                                }
                                                                return <span className="text-gray-300 dark:text-gray-600">—</span>;
                                                            })()
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                                                    {student.total}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${student.avg >= 5
                                                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        }`}>
                                                        {student.avg.toFixed(1)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

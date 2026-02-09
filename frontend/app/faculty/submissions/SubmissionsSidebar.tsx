"use client";

import React, { useState, useEffect } from "react";
import {
    BookOpen,
    ChevronRight,
    ChevronDown,
    LayoutGrid,
    FileCode2,
    Sparkles,
    Code2,
    Folder,
    FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Types
interface Practical {
    id: number;
    title: string;
    submission_count?: number;
}

interface Subject {
    id: number;
    subject_name: string;
    subject_code: string;
    practicals: Practical[];
}

interface SubmissionsSidebarProps {
    subjects: Subject[];
    selectedSubjectId: number | null;
    selectedPracticalId: number | null;
    onSelectSubject: (id: number | null) => void;
    onSelectPractical: (id: number | null) => void;
    className?: string;
}

// Subject color palette for visual variety
const subjectColors = [
    { bg: "from-violet-500 to-purple-600", light: "bg-violet-50 dark:bg-violet-900/20", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-800" },
    { bg: "from-blue-500 to-cyan-600", light: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
    { bg: "from-emerald-500 to-teal-600", light: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
    { bg: "from-amber-500 to-orange-600", light: "bg-amber-50 dark:bg-amber-900/20", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
    { bg: "from-rose-500 to-pink-600", light: "bg-rose-50 dark:bg-rose-900/20", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
];

export default function SubmissionsSidebar({
    subjects,
    selectedSubjectId,
    selectedPracticalId,
    onSelectSubject,
    onSelectPractical,
    className,
}: SubmissionsSidebarProps) {
    const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (selectedSubjectId) {
            setExpandedSubjects(prev => new Set(prev).add(selectedSubjectId));
        }
    }, [selectedSubjectId]);

    const toggleSubject = (subjectId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        const next = new Set(expandedSubjects);
        if (next.has(subjectId)) {
            next.delete(subjectId);
        } else {
            next.add(subjectId);
        }
        setExpandedSubjects(next);
    };

    return (
        <aside className={cn(
            "flex flex-col h-full bg-gradient-to-b from-white via-gray-50/50 to-white dark:from-gray-900 dark:via-gray-950 dark:to-gray-900 overflow-hidden",
            className
        )}>
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
                        <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Navigation</h2>
                </div>

                {/* All Submissions Button */}
                <button
                    onClick={() => {
                        onSelectSubject(null);
                        onSelectPractical(null);
                    }}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm font-semibold group",
                        !selectedSubjectId
                            ? "bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-indigo-500/30 scale-[1.02]"
                            : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-100 dark:border-gray-700 hover:shadow-md hover:scale-[1.01]"
                    )}
                >
                    <LayoutGrid className={cn(
                        "w-5 h-5 transition-transform",
                        !selectedSubjectId ? "text-white" : "text-indigo-500 group-hover:rotate-12"
                    )} />
                    <span>All Submissions</span>
                    {!selectedSubjectId && (
                        <span className="ml-auto w-2 h-2 rounded-full bg-white animate-pulse" />
                    )}
                </button>
            </div>

            {/* Subjects List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Subjects</p>

                {subjects.map((subject, index) => {
                    const isExpanded = expandedSubjects.has(subject.id);
                    const isSelected = selectedSubjectId === subject.id;
                    const colorScheme = subjectColors[index % subjectColors.length];

                    return (
                        <div key={subject.id} className="mb-1">
                            {/* Subject Header */}
                            <div
                                onClick={() => {
                                    if (isSelected) {
                                        // If already selected, toggle expansion
                                        const next = new Set(expandedSubjects);
                                        if (next.has(subject.id)) {
                                            next.delete(subject.id);
                                        } else {
                                            next.add(subject.id);
                                        }
                                        setExpandedSubjects(next);
                                    } else {
                                        // If not selected, select it (effect will handle expansion)
                                        onSelectSubject(subject.id);
                                    }
                                }}
                                className={cn(
                                    "group flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200",
                                    isSelected
                                        ? `${colorScheme.light} ${colorScheme.text} border ${colorScheme.border} shadow-sm`
                                        : "text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800 hover:shadow-sm border border-transparent hover:border-gray-100 dark:hover:border-gray-700"
                                )}
                            >
                                {/* Expand/Collapse Button */}
                                <button
                                    onClick={(e) => toggleSubject(subject.id, e)}
                                    className={cn(
                                        "p-1.5 rounded-lg transition-all duration-200",
                                        isSelected
                                            ? `${colorScheme.light} hover:bg-opacity-80`
                                            : "hover:bg-gray-100 dark:hover:bg-gray-700"
                                    )}
                                >
                                    {isExpanded ? (
                                        <FolderOpen className={cn("w-4 h-4", isSelected ? colorScheme.text : "text-amber-500")} />
                                    ) : (
                                        <Folder className={cn("w-4 h-4", isSelected ? colorScheme.text : "text-gray-400 group-hover:text-amber-500")} />
                                    )}
                                </button>

                                {/* Subject Name */}
                                <div className="flex-1 min-w-0">
                                    <span className="font-semibold truncate block text-sm">{subject.subject_name}</span>
                                    <span className={cn(
                                        "text-[10px] font-mono uppercase tracking-wider",
                                        isSelected ? "opacity-70" : "text-gray-400"
                                    )}>
                                        {subject.subject_code}
                                    </span>
                                </div>

                                {/* Practicals Count Badge */}
                                <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                                    isSelected
                                        ? "bg-white/50 dark:bg-black/20"
                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500"
                                )}>
                                    {subject.practicals?.length || 0}
                                </span>

                                {/* Chevron */}
                                <ChevronDown className={cn(
                                    "w-4 h-4 transition-transform duration-300",
                                    isExpanded ? "rotate-0" : "-rotate-90",
                                    isSelected ? colorScheme.text : "text-gray-400"
                                )} />
                            </div>

                            {/* Practicals List - Animated */}
                            <div className={cn(
                                "overflow-hidden transition-all duration-300 ease-in-out",
                                isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                            )}>
                                <div className="ml-5 pl-4 border-l-2 border-gray-100 dark:border-gray-800 mt-2 space-y-1">
                                    {subject.practicals && subject.practicals.length > 0 ? (
                                        subject.practicals.map((practical, pIndex) => (
                                            <button
                                                key={practical.id}
                                                onClick={() => onSelectPractical(practical.id)}
                                                className={cn(
                                                    "w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2 group/item",
                                                    selectedPracticalId === practical.id
                                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20"
                                                        : "text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white hover:shadow-sm"
                                                )}
                                            >
                                                <span className={cn(
                                                    "w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold flex-shrink-0",
                                                    selectedPracticalId === practical.id
                                                        ? "bg-white/20"
                                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 group-hover/item:bg-indigo-100 group-hover/item:text-indigo-600"
                                                )}>
                                                    {pIndex + 1}
                                                </span>
                                                <span className="truncate flex-1">{practical.title}</span>
                                                {practical.submission_count !== undefined && practical.submission_count > 0 && (
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                                                        selectedPracticalId === practical.id
                                                            ? "bg-white/20"
                                                            : "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                                                    )}>
                                                        {practical.submission_count}
                                                    </span>
                                                )}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-3 text-xs text-gray-400 italic flex items-center gap-2">
                                            <Code2 className="w-4 h-4" />
                                            No practicals yet
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
                <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase tracking-wider">
                    <BookOpen className="w-3 h-3" />
                    <span>{subjects.length} Subjects</span>
                    <span>•</span>
                    <span>{subjects.reduce((acc, s) => acc + (s.practicals?.length || 0), 0)} Practicals</span>
                </div>
            </div>
        </aside>
    );
}

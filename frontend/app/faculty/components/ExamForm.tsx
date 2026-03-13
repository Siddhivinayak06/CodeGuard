"use client";

import React, { useState, useMemo, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    Clock,
    Shield,
    Eye,
    Copy,
    Maximize,
    AlertTriangle,
    X,
    Save,
    Timer,
    Shuffle,
    Plus,
    Trash2,
    CheckSquare,
    Layers,
} from "lucide-react";

interface ExamFormProps {
    isOpen: boolean;
    practicalId: number;
    practicalTitle: string;
    onClose: () => void;
    onSaved: () => void;
    existingExam?: any;
}

interface QuestionSet {
    id?: string;
    set_name: string;
    level_ids: number[];
}

interface LevelInfo {
    id: number;
    level: string;
    title: string | null;
    description: string | null;
    max_marks: number;
}

export default function ExamForm({
    isOpen,
    practicalId,
    practicalTitle,
    onClose,
    onSaved,
    existingExam,
}: ExamFormProps) {
    const supabase = useMemo(() => createClient(), []);

    const [durationMinutes, setDurationMinutes] = useState(
        existingExam?.duration_minutes || 60
    );
    const [maxViolations, setMaxViolations] = useState(
        existingExam?.max_violations || 3
    );
    const [allowCopyPaste, setAllowCopyPaste] = useState(
        existingExam?.allow_copy_paste || false
    );
    const [requireFullscreen, setRequireFullscreen] = useState(
        existingExam?.require_fullscreen ?? true
    );
    const [showTestResults, setShowTestResults] = useState(
        existingExam?.show_test_results || false
    );
    const [startTime, setStartTime] = useState(
        existingExam?.start_time
            ? new Date(existingExam.start_time).toISOString().slice(0, 16)
            : ""
    );
    const [endTime, setEndTime] = useState(
        existingExam?.end_time
            ? new Date(existingExam.end_time).toISOString().slice(0, 16)
            : ""
    );
    const [saving, setSaving] = useState(false);

    // ---- Question Sets State ----
    const [enableSets, setEnableSets] = useState(false);
    const [questionSets, setQuestionSets] = useState<QuestionSet[]>([]);
    const [availableLevels, setAvailableLevels] = useState<LevelInfo[]>([]);
    const [loadingLevels, setLoadingLevels] = useState(false);

    // Fetch levels for this practical + existing sets
    useEffect(() => {
        if (!isOpen || !practicalId) return;

        const fetchData = async () => {
            setLoadingLevels(true);
            try {
                // Fetch practical levels
                const { data: levels } = await supabase
                    .from("practical_levels")
                    .select("id, level, title, description, max_marks")
                    .eq("practical_id", practicalId)
                    .order("id", { ascending: true });

                setAvailableLevels((levels as LevelInfo[]) || []);

                // Fetch existing question sets if exam exists
                if (existingExam?.id) {
                    const res = await fetch(`/api/exam/sets?examId=${existingExam.id}`);
                    const json = await res.json();
                    if (json.success && json.sets.length > 0) {
                        setEnableSets(true);
                        setQuestionSets(
                            json.sets.map((s: any) => ({
                                id: s.id,
                                set_name: s.set_name,
                                level_ids: s.level_ids || [],
                            }))
                        );
                    }
                }
            } catch (err) {
                console.error("Failed to fetch levels/sets:", err);
            } finally {
                setLoadingLevels(false);
            }
        };

        fetchData();
    }, [isOpen, practicalId, existingExam?.id, supabase]);

    // ---- Question Set Helpers ----
    const addSet = () => {
        const nextLetter = String.fromCharCode(65 + questionSets.length); // A, B, C, ...
        setQuestionSets((prev) => [
            ...prev,
            { set_name: `Set ${nextLetter}`, level_ids: [] },
        ]);
    };

    const removeSet = (index: number) => {
        setQuestionSets((prev) => prev.filter((_, i) => i !== index));
    };

    const updateSetName = (index: number, name: string) => {
        setQuestionSets((prev) =>
            prev.map((s, i) => (i === index ? { ...s, set_name: name } : s))
        );
    };

    const toggleLevelInSet = (setIndex: number, levelId: number) => {
        setQuestionSets((prev) =>
            prev.map((s, i) => {
                if (i !== setIndex) return s;
                const has = s.level_ids.includes(levelId);
                return {
                    ...s,
                    level_ids: has
                        ? s.level_ids.filter((id) => id !== levelId)
                        : [...s.level_ids, levelId],
                };
            })
        );
    };

    // Check if a level is already used in another set
    const isLevelUsedElsewhere = (setIndex: number, levelId: number) => {
        return questionSets.some(
            (s, i) => i !== setIndex && s.level_ids.includes(levelId)
        );
    };

    // Validation
    const getSetValidationErrors = (): string[] => {
        const errors: string[] = [];
        if (questionSets.length < 2) {
            errors.push("At least 2 sets are required for random assignment.");
        }
        questionSets.forEach((s, i) => {
            if (!s.set_name.trim()) errors.push(`Set ${i + 1} has no name.`);
            if (s.level_ids.length === 0)
                errors.push(`"${s.set_name}" has no sub-questions assigned.`);
        });
        // Check for unassigned levels
        const assignedLevelIds = new Set(questionSets.flatMap((s) => s.level_ids));
        const unassigned = availableLevels.filter(
            (l) => !assignedLevelIds.has(l.id)
        );
        if (unassigned.length > 0 && questionSets.length > 0) {
            errors.push(
                `${unassigned.length} sub-question(s) not assigned to any set.`
            );
        }
        return errors;
    };

    const handleSave = async () => {
        // Validate sets if enabled
        if (enableSets) {
            const errors = getSetValidationErrors();
            if (errors.length > 0) {
                toast.error(errors[0]);
                return;
            }
        }

        setSaving(true);
        try {
            // Mark the practical as an exam
            await (supabase.from("practicals") as any)
                .update({ is_exam: true })
                .eq("id", practicalId);

            const payload: Record<string, any> = {
                practical_id: practicalId,
                duration_minutes: durationMinutes,
                max_violations: maxViolations,
                allow_copy_paste: allowCopyPaste,
                require_fullscreen: requireFullscreen,
                show_test_results: showTestResults,
                start_time: startTime ? new Date(startTime).toISOString() : null,
                end_time: endTime ? new Date(endTime).toISOString() : null,
            };

            let examId = existingExam?.id;

            if (existingExam?.id) {
                const { error } = await (supabase.from("exams") as any)
                    .update(payload)
                    .eq("id", existingExam.id);
                if (error) throw error;
            } else {
                const { data, error } = await (supabase.from("exams") as any)
                    .insert(payload)
                    .select("id")
                    .single();
                if (error) throw error;
                examId = data.id;
            }

            // Save question sets
            if (examId) {
                const setsPayload = enableSets ? questionSets : [];
                const res = await fetch("/api/exam/sets", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ examId, sets: setsPayload }),
                });
                const json = await res.json();
                if (!res.ok) {
                    throw new Error(json.error || "Failed to save question sets");
                }
            }

            toast.success("Exam settings saved!");
            onSaved();
        } catch (err: any) {
            console.error("Failed to save exam:", err);
            toast.error(err?.message || "Failed to save exam settings");
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const setErrors = enableSets ? getSetValidationErrors() : [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl mx-4 overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-red-500 to-orange-500 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">Exam Settings</h2>
                            <p className="text-sm opacity-80 truncate max-w-[300px]">{practicalTitle}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/20 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                    {/* Duration */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Timer className="w-4 h-4 text-orange-500" />
                            Duration (minutes)
                        </label>
                        <input
                            type="number"
                            value={durationMinutes}
                            onChange={(e) => setDurationMinutes(Number(e.target.value))}
                            min={5}
                            max={300}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/50 outline-none"
                        />
                    </div>

                    {/* Time Window */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                <Clock className="w-4 h-4 text-blue-500" />
                                Start Time
                            </label>
                            <input
                                type="datetime-local"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/50 outline-none"
                            />
                        </div>
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                                <Clock className="w-4 h-4 text-red-500" />
                                End Time
                            </label>
                            <input
                                type="datetime-local"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500/50 outline-none"
                            />
                        </div>
                    </div>

                    {/* Max Violations */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Max Violations (auto-submit after)
                        </label>
                        <input
                            type="number"
                            value={maxViolations}
                            onChange={(e) => setMaxViolations(Number(e.target.value))}
                            min={1}
                            max={10}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-amber-500/50 outline-none"
                        />
                    </div>

                    {/* Toggle Options */}
                    <div className="space-y-3">
                        {/* Require Fullscreen */}
                        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                            <div className="flex items-center gap-3">
                                <Maximize className="w-4 h-4 text-purple-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Require Fullscreen</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={requireFullscreen}
                                onChange={(e) => setRequireFullscreen(e.target.checked)}
                                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500"
                            />
                        </label>

                        {/* Allow Copy/Paste */}
                        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                            <div className="flex items-center gap-3">
                                <Copy className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Allow Copy/Paste</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={allowCopyPaste}
                                onChange={(e) => setAllowCopyPaste(e.target.checked)}
                                className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500"
                            />
                        </label>

                        {/* Show Test Results */}
                        <label className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                            <div className="flex items-center gap-3">
                                <Eye className="w-4 h-4 text-emerald-500" />
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Test Results to Student</span>
                            </div>
                            <input
                                type="checkbox"
                                checked={showTestResults}
                                onChange={(e) => setShowTestResults(e.target.checked)}
                                className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                            />
                        </label>
                    </div>

                    {/* ================================================================ */}
                    {/* QUESTION SETS SECTION */}
                    {/* ================================================================ */}
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                        {/* Enable toggle */}
                        <label className="flex items-center justify-between p-3 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800 cursor-pointer hover:from-indigo-100 hover:to-purple-100 dark:hover:from-indigo-900/30 dark:hover:to-purple-900/30 transition-colors">
                            <div className="flex items-center gap-3">
                                <Shuffle className="w-4 h-4 text-indigo-500" />
                                <div>
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        Random Question Sets
                                    </span>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                        Randomly assign different question sets to students
                                    </p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={enableSets}
                                onChange={(e) => {
                                    setEnableSets(e.target.checked);
                                    if (e.target.checked && questionSets.length === 0) {
                                        // Auto-create 2 sets
                                        setQuestionSets([
                                            { set_name: "Set A", level_ids: [] },
                                            { set_name: "Set B", level_ids: [] },
                                        ]);
                                    }
                                }}
                                disabled={availableLevels.length === 0}
                                className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                            />
                        </label>

                        {availableLevels.length === 0 && (
                            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Add sub-questions (Tasks) to the exam first before creating question sets.
                            </p>
                        )}

                        {/* Sets Editor */}
                        {enableSets && availableLevels.length > 0 && (
                            <div className="mt-4 space-y-4">
                                {/* Validation errors */}
                                {setErrors.length > 0 && (
                                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                                        {setErrors.map((err, i) => (
                                            <p key={i} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                {err}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                {/* Set cards */}
                                {questionSets.map((set, setIdx) => (
                                    <div
                                        key={setIdx}
                                        className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3"
                                    >
                                        {/* Set header */}
                                        <div className="flex items-center gap-3">
                                            <Layers className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                            <input
                                                type="text"
                                                value={set.set_name}
                                                onChange={(e) => updateSetName(setIdx, e.target.value)}
                                                placeholder="Set Name"
                                                className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                            />
                                            <button
                                                onClick={() => removeSet(setIdx)}
                                                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                title="Remove set"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Level checkboxes */}
                                        <div className="grid grid-cols-1 gap-1.5">
                                            {availableLevels.map((level) => {
                                                const isInThisSet = set.level_ids.includes(level.id);
                                                const usedElsewhere = isLevelUsedElsewhere(setIdx, level.id);
                                                const disabled = usedElsewhere && !isInThisSet;

                                                return (
                                                    <label
                                                        key={level.id}
                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer ${
                                                            isInThisSet
                                                                ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700"
                                                                : disabled
                                                                ? "bg-gray-100 dark:bg-gray-700/50 opacity-50 cursor-not-allowed border border-transparent"
                                                                : "bg-white dark:bg-gray-900 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 border border-gray-100 dark:border-gray-700"
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isInThisSet}
                                                            disabled={disabled}
                                                            onChange={() => toggleLevelInSet(setIdx, level.id)}
                                                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-medium text-gray-800 dark:text-gray-200">
                                                                {level.title || level.level}
                                                            </span>
                                                            {level.description && (
                                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 truncate">
                                                                    — {level.description.slice(0, 60)}
                                                                    {level.description.length > 60 ? "..." : ""}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                                            {level.max_marks} marks
                                                        </span>
                                                        {usedElsewhere && !isInThisSet && (
                                                            <span className="text-xs text-amber-500 flex-shrink-0">
                                                                (in another set)
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {/* Set summary */}
                                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-1">
                                            <span className="flex items-center gap-1">
                                                <CheckSquare className="w-3 h-3" />
                                                {set.level_ids.length} sub-question{set.level_ids.length !== 1 ? "s" : ""}
                                            </span>
                                            <span>
                                                {set.level_ids.reduce((sum, id) => {
                                                    const lvl = availableLevels.find((l) => l.id === id);
                                                    return sum + (lvl?.max_marks || 0);
                                                }, 0)} total marks
                                            </span>
                                        </div>
                                    </div>
                                ))}

                                {/* Add set button */}
                                <button
                                    onClick={addSet}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border-2 border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add Question Set
                                </button>

                                {/* Summary */}
                                <div className="flex items-center gap-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-200 dark:border-indigo-800">
                                    <Shuffle className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                                    <p className="text-xs text-indigo-700 dark:text-indigo-300">
                                        <strong>{questionSets.length} sets</strong> will be randomly assigned to students using round-robin (balanced distribution).
                                        Each student will only see the sub-questions in their assigned set.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || (enableSets && setErrors.length > 0)}
                        className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-orange-500 rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? "Saving..." : existingExam ? "Update Exam" : "Create Exam"}
                    </button>
                </div>
            </div>
        </div>
    );
}

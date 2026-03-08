"use client";

import React, { useState, useMemo } from "react";
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
} from "lucide-react";

interface ExamFormProps {
    isOpen: boolean;
    practicalId: number; // The practical this exam is for
    practicalTitle: string;
    onClose: () => void;
    onSaved: () => void;
    existingExam?: any; // For editing
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

    const handleSave = async () => {
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

            if (existingExam?.id) {
                // Update existing
                const { error } = await (supabase.from("exams") as any)
                    .update(payload)
                    .eq("id", existingExam.id);
                if (error) throw error;
            } else {
                // Insert new
                const { error } = await (supabase.from("exams") as any)
                    .insert(payload);
                if (error) throw error;
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg mx-4 overflow-hidden">
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
                <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
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
                        disabled={saving}
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

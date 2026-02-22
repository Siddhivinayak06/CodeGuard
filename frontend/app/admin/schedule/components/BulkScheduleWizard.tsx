"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
    Loader2,
    CalendarRange,
    CheckCircle2,
    Sparkles,
    Users,
    Save,
    FileText,
    Upload,
    Trash2,
    AlertCircle,
    Edit2,
    AlertTriangle,
    BookOpen,
    ArrowUp,
} from "lucide-react";

type TabType = "schedule" | "faculty";

export function BulkScheduleWizard({ onScheduleCreated }: { onScheduleCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("schedule");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Subject
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState("");

    // Grid Data
    const [gridPracticals, setGridPracticals] = useState<any[]>([]);
    const [gridBatches, setGridBatches] = useState<string[]>([]);
    const [existingSchedules, setExistingSchedules] = useState<Record<string, Record<string, any>>>({});
    const [facultyLookup, setFacultyLookup] = useState<Record<string, string>>({});

    // Pending Schedule Changes
    const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, any>>>({});

    // Cell Editor
    const [editingCell, setEditingCell] = useState<{ pid: string; batch: string; isExisting?: boolean; id?: number } | null>(null);
    const [editDate, setEditDate] = useState("");
    const [editStart, setEditStart] = useState("09:00");
    const [editEnd, setEditEnd] = useState("11:00");
    const [checkingConflict, setCheckingConflict] = useState(false);
    const [conflictError, setConflictError] = useState<string | null>(null);

    // Faculty Management
    const [allFaculty, setAllFaculty] = useState<any[]>([]);
    const [facultyAssignments, setFacultyAssignments] = useState<Record<string, string>>({});
    const [originalAssignments, setOriginalAssignments] = useState<Record<string, string>>({});
    const [savingFaculty, setSavingFaculty] = useState(false);

    // PDF Import
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [pdfPreviews, setPdfPreviews] = useState<any[]>([]);
    const [pdfStep, setPdfStep] = useState<"upload" | "preview">("upload");
    const [pdfSaving, setPdfSaving] = useState(false);

    const supabase = createClient();

    useEffect(() => {
        if (open) {
            loadSubjects();
            loadFacultyList();
        } else {
            setSelectedSubject("");
            setGridPracticals([]);
            setGridBatches([]);
            setPendingChanges({});
            setEditingCell(null);
            setActiveTab("schedule");
            resetPdfState();
        }
    }, [open]);

    useEffect(() => {
        if (selectedSubject) {
            loadGridData();
            resetPdfState();
        } else {
            setGridPracticals([]);
            setGridBatches([]);
            setExistingSchedules({});
            setFacultyLookup({});
            setFacultyAssignments({});
            setOriginalAssignments({});
        }
    }, [selectedSubject]);

    function resetPdfState() {
        setPdfFile(null);
        setPdfLoading(false);
        setPdfError(null);
        setPdfPreviews([]);
        setPdfStep("upload");
    }

    async function loadSubjects() {
        try {
            const res = await fetch("/api/admin/subjects");
            const data = await res.json();
            if (data.success) setSubjects(data.data);
        } catch (e) { console.error(e); }
    }

    async function loadFacultyList() {
        try {
            const { data } = await supabase
                .from("users")
                .select("uid, email, name")
                .eq("role", "faculty");
            if (data) setAllFaculty(data);
        } catch (e) { console.error(e); }
    }

    const loadGridData = async () => {
        if (!selectedSubject) return;
        setLoading(true);
        setPendingChanges({});
        try {
            const res = await fetch(`/api/schedule/grid-data?subject_id=${selectedSubject}`);
            const data = await res.json();
            if (res.ok) {
                setGridPracticals(data.practicals || []);
                setGridBatches(data.batches || []);
                setExistingSchedules(data.schedulesMap || {});
                setFacultyLookup(data.facultyLookup || {});
                setFacultyAssignments({ ...(data.facultyLookup || {}) });
                setOriginalAssignments({ ...(data.facultyLookup || {}) });
            } else {
                toast.error("Failed to load grid data");
            }
        } catch (e) {
            toast.error("Error loading data");
        } finally {
            setLoading(false);
        }
    };

    // ── Schedule Handlers ──
    const handleCellClick = (pid: string, batch: string) => {
        const existing = existingSchedules[pid]?.[batch];
        const pending = pendingChanges[pid]?.[batch];

        setConflictError(null);

        if (existing) {
            // Edit existing schedule
            setEditDate(existing.date);
            setEditStart(existing.start_time);
            setEditEnd(existing.end_time);
            setEditingCell({ pid, batch, isExisting: true, id: existing.id });
        } else {
            // Create new or edit pending
            setEditDate(pending?.date || "");
            setEditStart(pending?.start_time || "09:00");
            setEditEnd(pending?.end_time || "11:00");
            setEditingCell({ pid, batch, isExisting: false });
        }
    };

    const checkConflict = async (fid: string | undefined): Promise<boolean> => {
        if (!fid || !editDate || !editStart || !editEnd || !editingCell) return false;
        setCheckingConflict(true);
        try {
            const res = await fetch("/api/schedule/check-conflict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    faculty_id: fid,
                    date: editDate,
                    start_time: editStart,
                    end_time: editEnd,
                    batch_name: editingCell.batch,
                    exclude_id: editingCell.isExisting ? editingCell.id : undefined
                }),
            });
            const data = await res.json();
            if (data.conflict) {
                setConflictError(data.reason);
                return true;
            }
            return false;
        } catch (e) {
            console.error("Conflict check failed", e);
            return false;
        } finally {
            setCheckingConflict(false);
        }
    }

    const saveCell = async () => {
        if (!editingCell || !editDate) return;

        const fid = facultyLookup[editingCell.batch];
        const hasConflict = await checkConflict(fid);

        if (hasConflict) {
            // Toast is handled by UI showing error
            return;
        }

        if (editingCell.isExisting && editingCell.id) {
            // Update existing schedule immediately via API
            setCheckingConflict(true);
            try {
                const res = await fetch("/api/schedule/manage", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: editingCell.id,
                        date: editDate,
                        start_time: editStart,
                        end_time: editEnd
                    }),
                });
                if (res.ok) {
                    toast.success("Schedule updated");
                    loadGridData(); // Refresh grid
                    setEditingCell(null);
                } else {
                    toast.error("Failed to update schedule");
                }
            } catch (e) {
                toast.error("Update failed");
            } finally {
                setCheckingConflict(false);
            }
        } else {
            // Add to pending changes
            setPendingChanges((prev) => ({
                ...prev,
                [editingCell.pid]: {
                    ...prev[editingCell.pid],
                    [editingCell.batch]: {
                        date: editDate,
                        start_time: editStart,
                        end_time: editEnd,
                        faculty_id: fid,
                    },
                },
            }));
            setEditingCell(null);
        }
    };

    const deleteExistingSchedule = async () => {
        if (!editingCell?.id) return;
        if (!confirm("Are you sure you want to delete this schedule?")) return;

        setCheckingConflict(true);
        try {
            const res = await fetch(`/api/schedule/manage?id=${editingCell.id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Schedule deleted");
                loadGridData();
                setEditingCell(null);
            } else {
                toast.error("Failed to delete");
            }
        } catch (e) {
            toast.error("Delete failed");
        } finally {
            setCheckingConflict(false);
        }
    }

    const removePendingCell = (pid: string, batch: string) => {
        setPendingChanges((prev) => {
            const updated = { ...prev };
            if (updated[pid]) {
                const { [batch]: _, ...rest } = updated[pid];
                if (Object.keys(rest).length === 0) delete updated[pid];
                else updated[pid] = rest;
            }
            return updated;
        });
    };

    const pendingCount = Object.values(pendingChanges).reduce(
        (acc, curr) => acc + Object.keys(curr).length, 0
    );

    // Stats calculation
    const totalSlots = gridPracticals.length * gridBatches.length;
    const scheduledCount = Object.values(existingSchedules).reduce(
        (acc, curr) => acc + Object.keys(curr).length, 0
    );
    const emptyCount = totalSlots - scheduledCount - pendingCount;
    const progressPercent = totalSlots > 0 ? ((scheduledCount + pendingCount) / totalSlots) * 100 : 0;

    const handleBulkSave = async () => {
        const schedulesToCreate: any[] = [];
        Object.keys(pendingChanges).forEach((pid) => {
            Object.keys(pendingChanges[pid]).forEach((batch) => {
                schedulesToCreate.push({
                    practical_id: pid,
                    batch_name: batch,
                    ...pendingChanges[pid][batch],
                });
            });
        });
        if (schedulesToCreate.length === 0) return;

        setSaving(true);
        try {
            const res = await fetch("/api/schedule/bulk-create", {
                method: "POST",
                body: JSON.stringify({ schedules: schedulesToCreate }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success(`Created ${data.created} schedule(s)`);
                if (data.failed > 0) toast.warning(`${data.failed} conflict(s) skipped`);
                onScheduleCreated();
                loadGridData(); // Reload to show new status
                setOpen(false); // Optionally close or keep open
            } else {
                toast.error(data.error);
            }
        } catch (e) {
            toast.error("Save failed");
        } finally {
            setSaving(false);
        }
    };

    // ── Faculty Management ──
    const handleFacultyChange = (batch: string, facultyId: string) => {
        setFacultyAssignments((prev) => ({ ...prev, [batch]: facultyId }));
    };

    const handleDefaultFacultyChange = (newFid: string) => {
        setFacultyAssignments((prev: Record<string, string>) => {
            const oldDefault = prev["All"];
            const next: Record<string, string> = { ...prev, "All": newFid };
            // Update all batches that were using the old default (or were unassigned/undefined if that's possible)
            // But since grid-data fills them, they likely have a value.
            // If a batch has the SAME value as oldDefault, we assume it was inheriting, so we update it.
            // If it has a different value, we assume it was an override, so we keep it.
            gridBatches.forEach(b => {
                if (!prev[b] || prev[b] === oldDefault) {
                    next[b] = newFid;
                }
            });
            return next;
        });
    };

    const facultyHasChanges = JSON.stringify(facultyAssignments) !== JSON.stringify(originalAssignments);

    const handleSaveFaculty = async () => {
        if (!selectedSubject) return;
        setSavingFaculty(true);
        try {
            const faculty_batches = Object.entries(facultyAssignments)
                .filter(([_, fid]) => fid)
                .map(([batch, faculty_id]) => ({ batch, faculty_id }));

            const res = await fetch("/api/admin/subjects", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: parseInt(selectedSubject), faculty_batches }),
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Faculty assignments updated!");
                setOriginalAssignments({ ...facultyAssignments });
                setFacultyLookup({ ...facultyAssignments });
            } else {
                toast.error(data.error || "Failed to save");
            }
        } catch (e) {
            toast.error("Save failed");
        } finally {
            setSavingFaculty(false);
        }
    };

    // ── PDF Import Handlers ──
    const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setPdfFile(e.target.files[0]);
            setPdfError(null);
        }
    };

    const handlePdfAnalyze = async () => {
        if (!pdfFile) { setPdfError("Select a PDF file first."); return; }
        setPdfLoading(true);
        setPdfError(null);

        try {
            const formData = new FormData();
            formData.append("pdf", pdfFile);

            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
            const { data: { session } } = await supabase.auth.getSession();

            const res = await fetch(`${apiUrl}/generate-bulk-practicals-from-pdf`, {
                method: "POST",
                headers: { Authorization: `Bearer ${session?.access_token || ""}` },
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(typeof errData.error === "object" ? errData.error.message : errData.error || "Failed to process PDF");
            }

            const data = await res.json();
            if (!data.practicals || !Array.isArray(data.practicals)) {
                throw new Error("Invalid response from AI");
            }

            const formatted = data.practicals.map((p: any) => ({
                title: p.title || "Untitled Practical",
                description: p.description || "",
                max_marks: Number(p.max_marks) || 10,
                language: p.language || "c",
            }));

            setPdfPreviews(formatted);
            setPdfStep("preview");
        } catch (err: any) {
            setPdfError(err.message || "Failed to process PDF.");
        } finally {
            setPdfLoading(false);
        }
    };

    const removePdfPreview = (idx: number) => {
        setPdfPreviews((prev) => prev.filter((_, i) => i !== idx));
    };

    const handlePdfImportSave = async () => {
        if (pdfPreviews.length === 0 || !selectedSubject) return;
        setPdfSaving(true);
        try {
            // Save each practical via the admin API
            let created = 0;
            for (const p of pdfPreviews) {
                const res = await fetch("/api/admin/practicals", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        title: p.title,
                        subject_id: parseInt(selectedSubject),
                        description: p.description,
                        language: p.language,
                        max_marks: p.max_marks,
                    }),
                });
                const data = await res.json();
                if (data.success) created++;
            }

            toast.success(`Imported ${created} practical(s)!`);
            resetPdfState();
            loadGridData(); // Reload grid to show new practicals
        } catch (e) {
            toast.error("Failed to save practicals");
        } finally {
            setPdfSaving(false);
        }
    };

    const subjectName = subjects.find((s: any) => s.id.toString() === selectedSubject)?.subject_name;

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button
                        className="gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md transition-all duration-200 hover:scale-[1.05]"
                    >
                        <CalendarRange className="w-4 h-4" />
                        Schedule
                    </Button>
                </DialogTrigger>

                <DialogContent className="w-[96vw] max-w-[1400px] max-h-[92vh] p-0 overflow-hidden bg-white dark:bg-gray-950 border-0 shadow-2xl flex flex-col rounded-2xl">
                    {/* ── Header ── */}
                    <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-8 py-6 shrink-0 overflow-hidden">
                        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23fff" fill-opacity="0.4"%3E%3Ccircle cx="1" cy="1" r="1"/%3E%3C/g%3E%3C/svg%3E")' }} />
                        <DialogHeader className="relative z-10">
                            <DialogTitle className="text-white text-2xl font-bold flex items-center gap-2.5 tracking-tight">
                                <Sparkles className="w-6 h-6 text-amber-300" />
                                Schedule Manager
                            </DialogTitle>
                            <p className="text-white/60 text-sm mt-1">
                                Manage practical sessions, assignments, and faculty allocations efficiently.
                            </p>
                        </DialogHeader>
                    </div>

                    <div className="px-8 pt-5 pb-0 shrink-0">
                        {/* ── Subject Selector & Stats ── */}
                        <div className="flex items-center gap-6 mb-5">
                            <div className="w-[320px] space-y-2 p-1">
                                <Label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Select Subject
                                </Label>
                                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                    <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm hover:shadow-md hover:border-indigo-300 rounded-xl">
                                        <SelectValue placeholder="Choose a subject to schedule..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subjects.map((s: any) => (
                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                <span className="font-medium">{s.subject_name}</span>{" "}
                                                <span className="text-gray-400">({s.subject_code})</span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Stats Bar */}
                            {selectedSubject && activeTab === "schedule" && gridPracticals.length > 0 && (
                                <div className="flex-1 flex items-center gap-3 justify-end">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                                        {totalSlots} Total
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                        {scheduledCount} Scheduled
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/20 text-xs font-semibold text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
                                        <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                        {pendingCount} Pending
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-xs font-semibold text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/40">
                                        <span className="w-2 h-2 rounded-full bg-orange-400" />
                                        {emptyCount} Empty
                                    </div>
                                    <div className="px-2.5 py-1 rounded-full bg-indigo-600 text-[11px] font-bold text-white tabular-nums">
                                        {Math.round(progressPercent)}%
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── Tabs ── */}
                        <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
                            <button
                                onClick={() => setActiveTab("schedule")}
                                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === "schedule"
                                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                    }`}
                            >
                                <CalendarRange className="w-4 h-4" />
                                Schedule Grid
                            </button>
                            <button
                                onClick={() => setActiveTab("faculty")}
                                className={`flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-full transition-all duration-200 ${activeTab === "faculty"
                                    ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-200 dark:ring-indigo-800"
                                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50"
                                    }`}
                            >
                                <Users className="w-4 h-4" />
                                Faculty Assignments
                                {facultyHasChanges && (
                                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="px-8 py-5 overflow-y-auto flex-1 h-full min-h-0">
                        {/* ── Loading ── */}
                        {loading && (
                            <div className="flex items-center justify-center py-12">
                                <div className="flex flex-col items-center gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                    <span className="text-sm text-gray-400">Loading...</span>
                                </div>
                            </div>
                        )}

                        {/* ── Empty State (no subject) ── */}
                        {!loading && !selectedSubject && (
                            <div className="flex flex-col items-center justify-center py-24 text-center animate-in fade-in zoom-in duration-500">
                                <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-6 relative group">
                                    <div className="absolute inset-0 rounded-full border border-indigo-100 dark:border-indigo-800 animate-ping opacity-20" />
                                    <CalendarRange className="w-10 h-10 text-indigo-400 dark:text-indigo-500 group-hover:scale-110 transition-transform duration-300" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                                    Ready to Schedule?
                                </h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mx-auto mb-8">
                                    Select a subject from the dropdown above to view the grid and start scheduling practicals.
                                </p>
                                <div className="text-xs uppercase tracking-widest text-gray-400 flex items-center gap-2 animate-bounce">
                                    <ArrowUp className="w-4 h-4" />
                                    Start Here
                                </div>
                            </div>
                        )}

                        {/* ════════════ SCHEDULE TAB ════════════ */}
                        {!loading && selectedSubject && activeTab === "schedule" && (
                            <>
                                {gridPracticals.length > 0 ? (
                                    /* ── Grid ── */
                                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden h-full flex flex-col bg-white dark:bg-gray-950 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                                        <div className="overflow-auto flex-1 max-h-[calc(92vh-340px)]">
                                            <table className="w-full text-sm border-collapse">
                                                <thead className="sticky top-0 z-20">
                                                    <tr className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900 border-b-2 border-gray-200 dark:border-gray-800">
                                                        <th className="px-5 py-3.5 border-r border-gray-200 dark:border-gray-800 min-w-[280px] text-left font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900 z-30 text-xs uppercase tracking-widest">
                                                            Practical
                                                        </th>
                                                        {gridBatches.map((b) => (
                                                            <th key={b} className="px-4 py-3.5 border-r border-gray-200 dark:border-gray-800 min-w-[180px] text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-widest bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900">
                                                                Batch {b}
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {gridPracticals.map((p: any, idx: number) => (
                                                        <tr key={p.id} className={`transition-colors ${idx % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/40 dark:bg-gray-900/20"} hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10`}>
                                                            <td className="px-5 py-3.5 border-b border-r border-gray-100 dark:border-gray-800 font-medium sticky left-0 z-10 bg-inherit text-gray-800 dark:text-gray-200 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_-4px_rgba(0,0,0,0.4)]">
                                                                <div className="flex items-center gap-3 max-w-[260px]">
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-[11px] font-bold text-indigo-500 dark:text-indigo-400 shrink-0">{p.practical_number ?? (idx + 1)}</span>
                                                                    <span className="truncate text-[13px] font-medium" title={p.title}>{p.title}</span>
                                                                </div>
                                                            </td>
                                                            {gridBatches.map((b) => {
                                                                const pid = p.id.toString();
                                                                const existing = existingSchedules[pid]?.[b];
                                                                const pending = pendingChanges[pid]?.[b];

                                                                if (existing) {
                                                                    return (
                                                                        <td key={`${pid}-${b}`} className="p-2 border-b border-r border-gray-100 dark:border-gray-800 relative group cursor-pointer" onClick={() => handleCellClick(pid, b)}>
                                                                            <div className="flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:shadow-sm transition-all">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                                    <span className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">{existing.date}</span>
                                                                                </div>
                                                                                <div className="pl-3 opacity-70 text-[10px] text-emerald-600 dark:text-emerald-400">{existing.start_time} - {existing.end_time}</div>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                }
                                                                if (pending) {
                                                                    return (
                                                                        <td key={`${pid}-${b}`} className="p-2 border-b border-r border-gray-100 dark:border-gray-800 group cursor-pointer" onClick={() => handleCellClick(pid, b)}>
                                                                            <div className="relative flex flex-col gap-0.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-300/60 dark:border-indigo-700/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 hover:shadow-sm transition-all">
                                                                                <div className="flex items-center gap-1.5">
                                                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                                                                                    <span className="font-bold text-[11px] text-indigo-700 dark:text-indigo-300">{pending.date}</span>
                                                                                </div>
                                                                                <div className="pl-3 opacity-70 text-[10px] text-indigo-600 dark:text-indigo-400">{pending.start_time} - {pending.end_time}</div>
                                                                                <button
                                                                                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full text-[9px] leading-none opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center shadow-sm z-10"
                                                                                    onClick={(e) => { e.stopPropagation(); removePendingCell(pid, b); }}
                                                                                >×</button>
                                                                            </div>
                                                                        </td>
                                                                    );
                                                                }
                                                                return (
                                                                    <td key={`${pid}-${b}`} className="p-2 border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer group" onClick={() => handleCellClick(pid, b)}>
                                                                        <div className="flex items-center justify-center h-[42px] rounded-xl border border-dashed border-gray-200/80 dark:border-gray-700/60 group-hover:border-indigo-400 dark:group-hover:border-indigo-500 group-hover:bg-gradient-to-br group-hover:from-indigo-50 group-hover:to-purple-50/50 dark:group-hover:from-indigo-900/20 dark:group-hover:to-purple-900/10 transition-all duration-200">
                                                                            <span className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 text-xl font-light transition-colors">+</span>
                                                                        </div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    /* ── No Practicals → PDF Import ── */
                                    <div className="space-y-4">
                                        {pdfStep === "upload" ? (
                                            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-8 text-center bg-gray-50/50 dark:bg-gray-900/30 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all min-h-[300px]">
                                                <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-5">
                                                    <FileText className="w-8 h-8 text-indigo-500" />
                                                </div>
                                                <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-1">
                                                    No practicals found for {subjectName}
                                                </h4>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mb-6">
                                                    Upload a lab manual PDF and we&apos;ll extract practicals automatically using AI.
                                                </p>

                                                {pdfError && (
                                                    <div className="mb-4 w-full max-w-sm p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                        {pdfError}
                                                    </div>
                                                )}

                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept="application/pdf"
                                                        onChange={handlePdfFileChange}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                        disabled={pdfLoading}
                                                    />
                                                    <Button
                                                        disabled={pdfLoading}
                                                        variant="outline"
                                                        className="gap-2 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                        {pdfFile ? pdfFile.name : "Select PDF File"}
                                                    </Button>
                                                </div>

                                                {pdfFile && !pdfLoading && (
                                                    <Button
                                                        onClick={handlePdfAnalyze}
                                                        className="mt-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25"
                                                    >
                                                        <Sparkles className="w-4 h-4 mr-2" />
                                                        Analyze PDF
                                                    </Button>
                                                )}

                                                {pdfLoading && (
                                                    <div className="mt-6 flex flex-col items-center text-indigo-500">
                                                        <Loader2 className="w-7 h-7 animate-spin mb-2" />
                                                        <span className="text-sm font-medium">Analyzing PDF & Extracting Practicals...</span>
                                                        <span className="text-xs text-gray-400 mt-1">This may take a minute</span>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            /* ── Preview Extracted Practicals ── */
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                                        Found {pdfPreviews.length} Practicals
                                                    </h4>
                                                    <Button variant="ghost" size="sm" onClick={() => setPdfStep("upload")} className="text-gray-500 hover:text-gray-700">
                                                        ← Back to Upload
                                                    </Button>
                                                </div>

                                                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="bg-gray-100 dark:bg-gray-900">
                                                                <th className="p-3 border-b border-r border-gray-200 dark:border-gray-800 text-left font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider w-8">#</th>
                                                                <th className="p-3 border-b border-r border-gray-200 dark:border-gray-800 text-left font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">Title</th>
                                                                <th className="p-3 border-b border-r border-gray-200 dark:border-gray-800 text-left font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider w-[80px]">Marks</th>
                                                                <th className="p-3 border-b border-gray-200 dark:border-gray-800 text-center font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider w-[60px]"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {pdfPreviews.map((p: any, idx: number) => (
                                                                <tr key={idx} className={`group ${idx % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/30"}`}>
                                                                    <td className="p-3 border-b border-r border-gray-100 dark:border-gray-800 text-gray-400 text-xs">
                                                                        {idx + 1}
                                                                    </td>
                                                                    <td className="p-3 border-b border-r border-gray-100 dark:border-gray-800">
                                                                        <div className="font-medium text-gray-800 dark:text-gray-200">{p.title}</div>
                                                                        {p.description && (
                                                                            <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</div>
                                                                        )}
                                                                    </td>
                                                                    <td className="p-3 border-b border-r border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-400">
                                                                        {p.max_marks}
                                                                    </td>
                                                                    <td className="p-3 border-b border-gray-100 dark:border-gray-800 text-center">
                                                                        <button
                                                                            onClick={() => removePdfPreview(idx)}
                                                                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                                            title="Remove"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}

                        {/* ════════════ FACULTY TAB ════════════ */}
                        {!loading && selectedSubject && activeTab === "faculty" && (
                            <div className="space-y-4">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    Assign faculty members to each batch for <span className="font-semibold text-gray-700 dark:text-gray-300">{subjectName}</span>.
                                </p>

                                {/* Default Faculty Selector */}
                                <div className="p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <h4 className="text-sm font-semibold text-indigo-900 dark:text-indigo-300">Default Faculty (All Batches)</h4>
                                        <p className="text-xs text-indigo-700 dark:text-indigo-400 opacity-80">
                                            Sets the faculty for all batches. You can override specific batches below.
                                        </p>
                                    </div>
                                    <div className="w-[240px]">
                                        <Select
                                            value={facultyAssignments["All"] || ""}
                                            onValueChange={handleDefaultFacultyChange}
                                        >
                                            <SelectTrigger className="h-9 bg-white dark:bg-gray-900 border-indigo-200 dark:border-indigo-800 focus:ring-indigo-500">
                                                <SelectValue placeholder="Select default faculty..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {allFaculty.map((f: any) => (
                                                    <SelectItem key={f.uid} value={f.uid}>
                                                        <span className="font-medium">{f.name || "Unnamed"}</span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-100 dark:bg-gray-900">
                                                <th className="p-3 border-b border-r border-gray-200 dark:border-gray-800 text-left font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider w-[200px]">
                                                    Batch
                                                </th>
                                                <th className="p-3 border-b border-gray-200 dark:border-gray-800 text-left font-semibold text-gray-600 dark:text-gray-400 text-xs uppercase tracking-wider">
                                                    Assigned Faculty
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {gridBatches.length === 0 ? (
                                                <tr>
                                                    <td colSpan={2} className="p-8 text-center text-gray-400 text-sm">No batches found.</td>
                                                </tr>
                                            ) : (
                                                gridBatches.map((batch, idx) => {
                                                    const currentFacultyId = facultyAssignments[batch] || "";
                                                    const isChanged = currentFacultyId !== (originalAssignments[batch] || "");
                                                    return (
                                                        <tr key={batch} className={idx % 2 === 0 ? "bg-white dark:bg-gray-950" : "bg-gray-50/50 dark:bg-gray-900/30"}>
                                                            <td className="p-3 border-b border-r border-gray-100 dark:border-gray-800">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-2 h-2 rounded-full ${isChanged ? "bg-amber-500 animate-pulse" : currentFacultyId ? "bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"}`} />
                                                                    <span className="font-medium text-gray-800 dark:text-gray-200">{batch}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-2 border-b border-gray-100 dark:border-gray-800">
                                                                <Select value={currentFacultyId} onValueChange={(v) => handleFacultyChange(batch, v)}>
                                                                    <SelectTrigger className={`h-9 text-sm transition-all ${isChanged ? "ring-2 ring-amber-400/50 border-amber-300 dark:border-amber-700" : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800"}`}>
                                                                        <SelectValue placeholder="Select faculty..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {allFaculty.map((f: any) => (
                                                                            <SelectItem key={f.uid} value={f.uid}>
                                                                                <span className="font-medium">{f.name || "Unnamed"}</span>{" "}
                                                                                <span className="text-gray-400 text-xs">({f.email})</span>
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Footer ── */}
                    {selectedSubject && (
                        <div className="px-8 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-gray-50/50 dark:from-gray-900/80 dark:to-gray-900/30 flex items-center justify-between shrink-0">
                            {activeTab === "schedule" ? (
                                <>
                                    {gridPracticals.length > 0 ? (
                                        <>
                                            <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                <span className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
                                                    Scheduled
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-md bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700" />
                                                    Pending
                                                </span>
                                                <span className="flex items-center gap-2">
                                                    <span className="w-3 h-3 rounded-md bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600" />
                                                    Empty
                                                </span>
                                            </div>
                                            <Button
                                                onClick={handleBulkSave}
                                                disabled={saving || pendingCount === 0}
                                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all disabled:opacity-40 disabled:shadow-none px-6"
                                            >
                                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                                Save {pendingCount} {pendingCount === 1 ? "Schedule" : "Schedules"}
                                            </Button>
                                        </>
                                    ) : pdfStep === "preview" && pdfPreviews.length > 0 ? (
                                        <>
                                            <span className="text-xs text-gray-400">
                                                {pdfPreviews.length} practical(s) ready to import
                                            </span>
                                            <Button
                                                onClick={handlePdfImportSave}
                                                disabled={pdfSaving || pdfPreviews.length === 0}
                                                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-40 px-6"
                                            >
                                                {pdfSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                                                Import {pdfPreviews.length} Practicals
                                            </Button>
                                        </>
                                    ) : (
                                        <span className="text-xs text-gray-400">Upload a PDF to create practicals</span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4 text-xs text-gray-400">
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            Assigned
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            Changed
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                                            Unassigned
                                        </span>
                                    </div>
                                    <Button
                                        onClick={handleSaveFaculty}
                                        disabled={savingFaculty || !facultyHasChanges}
                                        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl transition-all disabled:opacity-40 disabled:shadow-none px-6"
                                    >
                                        {savingFaculty ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                        Save Faculty
                                    </Button>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Cell Editor Mini-Dialog ── */}
            {editingCell && (
                <Dialog open={!!editingCell} onOpenChange={(o) => !o && setEditingCell(null)}>
                    <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-0 shadow-2xl">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 flex justify-between items-center">
                            <DialogHeader>
                                <DialogTitle className="text-white text-base">
                                    {editingCell.isExisting ? "Edit Schedule" : "Set Schedule"}
                                </DialogTitle>
                            </DialogHeader>
                            <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                                {editingCell.batch}
                            </span>
                        </div>
                        <div className="px-5 py-4 space-y-4">
                            {conflictError && (
                                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-2">
                                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                                    <p className="text-xs text-red-700 dark:text-red-300">{conflictError}</p>
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date</Label>
                                <Input type="date" value={editDate} onChange={(e) => { setEditDate(e.target.value); setConflictError(null); }} className="h-10 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">Start</Label>
                                    <Input type="time" value={editStart} onChange={(e) => { setEditStart(e.target.value); setConflictError(null); }} className="h-10 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">End</Label>
                                    <Input type="time" value={editEnd} onChange={(e) => { setEditEnd(e.target.value); setConflictError(null); }} className="h-10 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>

                            {!facultyLookup[editingCell.batch] && (
                                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                                    <span className="text-amber-500 text-sm">⚠</span>
                                    <p className="text-xs text-amber-700 dark:text-amber-300">No faculty assigned. Go to Faculty Assignments tab.</p>
                                </div>
                            )}
                        </div>
                        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-between gap-2">
                            {editingCell.isExisting ? (
                                <Button variant="destructive" size="sm" onClick={deleteExistingSchedule} disabled={checkingConflict} className="px-3">
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            ) : (
                                <div /> /* Spacer */
                            )}
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => setEditingCell(null)}>Cancel</Button>
                                <Button
                                    size="sm"
                                    onClick={saveCell}
                                    disabled={!editDate || checkingConflict}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[80px]"
                                >
                                    {checkingConflict ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingCell.isExisting ? "Update" : "Set")}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}

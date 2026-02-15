"use client";

import React, { useState, useEffect } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, CalendarPlus, X } from "lucide-react";
import { toast } from "sonner";
import { ScheduleDialog } from "./ScheduleDialog";

interface ScheduleGridProps {
    onScheduleUpdated: () => void;
}

export function ScheduleGrid({ onScheduleUpdated }: ScheduleGridProps) {
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedSubject, setSelectedSubject] = useState<string>("");

    // Grid Data
    const [practicals, setPracticals] = useState<any[]>([]);
    const [batches, setBatches] = useState<string[]>([]);
    const [schedulesMap, setSchedulesMap] = useState<Record<string, Record<string, any>>>({});
    const [facultyLookup, setFacultyLookup] = useState<Record<string, string>>({});

    // Loading State
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [loadingGrid, setLoadingGrid] = useState(false);

    // Dialog State (for creating/editing)
    const [dialogOpen, setDialogOpen] = useState(false);
    const [pendingCell, setPendingCell] = useState<{ practicalId: string, batchName: string } | null>(null);

    // Fetch Subjects on Mount
    useEffect(() => {
        async function loadSubjects() {
            try {
                const res = await fetch("/api/admin/subjects");
                const data = await res.json();
                if (data.success) {
                    setSubjects(data.data);
                    if (data.data.length > 0) setSelectedSubject(data.data[0].id.toString());
                }
            } catch (e) { console.error(e); } finally { setLoadingSubjects(false); }
        }
        loadSubjects();
    }, []);

    // Fetch Grid Data
    useEffect(() => {
        if (!selectedSubject) return;
        setLoadingGrid(true);

        async function loadGrid() {
            try {
                const res = await fetch(`/api/schedule/grid-data?subject_id=${selectedSubject}`);
                const data = await res.json();
                if (res.ok) {
                    setPracticals(data.practicals || []);
                    setBatches(data.batches || []);
                    setSchedulesMap(data.schedulesMap || {});
                    setFacultyLookup(data.facultyLookup || {});
                }
            } catch (e) {
                toast.error("Failed to load grid data");
            } finally {
                setLoadingGrid(false);
            }
        }
        loadGrid();
    }, [selectedSubject]);

    const handleCellClick = (practicalId: string, batchName: string) => {
        // Find existing schedule?
        const existing = schedulesMap[practicalId]?.[batchName];
        if (existing) {
            // Already scheduled - maybe confirm delete or edit?
            // For MVP, just show toast or details? Maybe edit later.
            // Let's implement Delete on right click or simple click shows details?
            toast.info(`Scheduled on ${existing.date} (${existing.start_time}-${existing.end_time})`);
            return;
        }

        // Open Dialog
        setPendingCell({ practicalId, batchName });
        setDialogOpen(true);
    };

    const handleScheduleCreated = () => {
        // Refresh grid
        onScheduleUpdated(); // Let parent verify
        // Re-fetch our local grid too?
        // Ideally we just refetch grid data.
        // Re-trigger useEffect
        const currentSub = selectedSubject;
        setSelectedSubject(""); // Flash clear
        setTimeout(() => setSelectedSubject(currentSub), 50);
        setDialogOpen(false);
    };

    if (loadingSubjects) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-gray-400" /></div>;

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex items-center gap-4 bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm w-full">
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                    <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Select Subject" />
                    </SelectTrigger>
                    <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.subject_name}</SelectItem>)}
                    </SelectContent>
                </Select>
                {loadingGrid && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
            </div>

            {/* Grid */}
            <div className="border rounded-lg overflow-x-auto bg-white dark:bg-gray-900 shadow-sm animate-fadeIn">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        <tr>
                            <th className="p-3 border-b border-r min-w-[200px] sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                                Practical / Batch
                            </th>
                            {batches.map(b => (
                                <th key={b} className="p-3 border-b border-r min-w-[140px] text-center font-medium">
                                    {b}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {practicals.length === 0 ? (
                            <tr><td colSpan={batches.length + 1} className="p-8 text-center text-gray-400">No practicals found for subject.</td></tr>
                        ) : (
                            practicals.map((p) => (
                                <tr key={p.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
                                    <td className="p-3 border-b border-r bg-white dark:bg-gray-900 sticky left-0 z-10 font-medium text-gray-800 dark:text-gray-200">
                                        {p.title}
                                    </td>
                                    {batches.map(b => {
                                        const schedule = schedulesMap[p.id.toString()]?.[b];
                                        const statusColor = schedule ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300" : "hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer";

                                        return (
                                            <td
                                                key={`${p.id}-${b}`}
                                                className={`p-2 border-b border-r max-w-[140px] transition-colors relative group ${statusColor}`}
                                                onClick={() => handleCellClick(p.id.toString(), b)}
                                            >
                                                {schedule ? (
                                                    <div className="flex flex-col text-xs">
                                                        <span className="font-semibold">{schedule.date}</span>
                                                        <span className="opacity-80">{schedule.start_time}</span>
                                                    </div>
                                                ) : (
                                                    <div className="opacity-0 group-hover:opacity-100 flex justify-center items-center text-gray-400">
                                                        <CalendarPlus className="w-4 h-4" />
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Hidden Dialog Trigger - or pass props to a controlled Dialog */}
            {/* 
                We reuse ScheduleDialog but we need to pre-fill it.
                Since ScheduleDialog controls its own state mainly, we might need to modify it or wrapper.
                For now, let's just use the Wizard logic? No, Dialog is better for single cell.
                We need to pass initial values to ScheduleDialog.
             */}

            {/* Modification: We can pass initialData prop to ScheduleDialog if not present, checking quickly... */}
            {/* Checked `ScheduleDialog.tsx`, it takes `selectedDate`. We might need to add `initialData` prop. */}

        </div>
    );
}

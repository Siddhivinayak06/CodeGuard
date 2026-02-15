"use client";

import React from "react";
import { format } from "date-fns";
import { Clock, User, Users, BookOpen, Trash2, CalendarDays } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ScheduleDetailsPanelProps {
    selectedDate: Date | undefined;
    schedules: any[];
    onDelete?: (id: string) => void;
}

export function ScheduleDetailsPanel({
    selectedDate,
    schedules,
    onDelete,
}: ScheduleDetailsPanelProps) {
    if (!selectedDate) {
        return (
            <div className="glass-card-premium rounded-2xl p-8 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-full mb-4 animate-pulse">
                    <CalendarDays className="w-8 h-8 text-indigo-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">
                    Select a Date
                </h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-xs">
                    Click on a date in the calendar to view scheduled practicals and sessions.
                </p>
            </div>
        );
    }

    const dateStr = selectedDate.toISOString().split("T")[0];
    const dailySchedules = schedules.filter((s) => s.date === dateStr);

    return (
        <div className="glass-card-premium rounded-2xl overflow-hidden h-full flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shrink-0">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CalendarDays className="w-6 h-6" />
                    {format(selectedDate, "MMMM d, yyyy")}
                </h2>
                <p className="text-white/80 mt-1 pl-8">
                    {dailySchedules.length} session{dailySchedules.length !== 1 ? "s" : ""} scheduled
                </p>
            </div>

            {/* List */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4 custom-scrollbar">
                <AnimatePresence mode="popLayout">
                    {dailySchedules.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-12"
                        >
                            <p className="text-gray-400 dark:text-gray-500 italic">
                                No sessions scheduled for this day.
                            </p>
                        </motion.div>
                    ) : (
                        dailySchedules.map((schedule, idx) => (
                            <motion.div
                                key={schedule.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: idx * 0.1 }}
                                className="group relative bg-white dark:bg-gray-800/50 rounded-xl p-4 border border-gray-100 dark:border-gray-700/50 shadow-sm hover:shadow-md transition-all hover:border-indigo-200 dark:hover:border-indigo-700"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                            {schedule.practicals?.title || schedule.title_placeholder || "Untitled Session"}
                                        </h3>
                                        {schedule.practicals?.title && (
                                            <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full mt-1 inline-block">
                                                Practical
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 bg-gray-50 dark:bg-gray-900/50 px-3 py-1 rounded-lg border border-gray-100 dark:border-gray-800">
                                        <Clock className="w-4 h-4 text-indigo-500" />
                                        {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                        <User className="w-4 h-4 text-purple-500" />
                                        <span className="truncate">
                                            {schedule.faculty?.email || "Unknown Faculty"}
                                        </span>
                                    </div>
                                    {schedule.batch_name && (
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                                            <Users className="w-4 h-4 text-amber-500" />
                                            <span>Batch: {schedule.batch_name}</span>
                                        </div>
                                    )}
                                </div>

                                {onDelete && (
                                    <button
                                        onClick={() => onDelete(schedule.id)}
                                        className="absolute top-4 right-4 p-2 text-red-400 hover:text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                        title="Delete Schedule"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

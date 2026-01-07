"use client";

import React, { useState, useEffect } from "react";
import { YearlyCalendar } from "./components/YearlyCalendar";
import { ScheduleDialog } from "./components/ScheduleDialog";
import { ExportControls } from "./components/ExportControls";
import { Loader2, CalendarDays, Sparkles } from "lucide-react";

export default function YearlySchedulePage() {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            // Fetch for a wide range, e.g., entire current year
            const currentYear = new Date().getFullYear();
            const res = await fetch(`/api/schedule/get?startDate=${currentYear}-01-01&endDate=${currentYear}-12-31`);
            const data = await res.json();
            if (res.ok) {
                setSchedules(data.schedules);
            }
        } catch (error) {
            console.error("Failed to fetch schedules", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, []);

    return (
        <div className="min-h-screen pt-20 pb-12 relative overflow-hidden">
            {/* Premium Background Effects */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/20 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/10" />
                <div className="floating-shape w-[600px] h-[600px] bg-indigo-400/20 dark:bg-indigo-500/10 top-20 -right-40 animate-float-slow" />
                <div className="floating-shape w-[500px] h-[500px] bg-purple-400/15 dark:bg-purple-500/10 -bottom-20 -left-40 animate-float-reverse" />
                <div className="floating-shape w-[300px] h-[300px] bg-pink-400/10 dark:bg-pink-500/5 top-1/2 left-1/3 animate-float" />
            </div>

            <div className="container mx-auto px-4 md:px-6 space-y-8">
                {/* Premium Header Section */}
                <div className="glass-card-premium rounded-2xl p-6 md:p-8 animate-slideUp">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        <div className="flex items-start gap-4">
                            <div className="icon-container-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30">
                                <CalendarDays className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-2xl md:text-3xl font-bold text-gradient">
                                        Practical Schedule
                                    </h1>
                                    <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
                                </div>
                                <p className="text-muted-foreground mt-1 text-sm md:text-base">
                                    Manage and view all practical sessions for the academic year
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            <ExportControls schedules={schedules} />
                            <ScheduleDialog
                                onScheduleCreated={fetchSchedules}
                                selectedDate={selectedDate}
                            />
                        </div>
                    </div>

                    {/* Stats Row */}
                    {!loading && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/20 dark:border-white/5 animate-fadeIn animation-delay-200">
                            <StatCard
                                label="Total Sessions"
                                value={schedules.length}
                                color="blue"
                            />

                            <StatCard
                                label="This Month"
                                value={schedules.filter((s: any) => {
                                    const date = new Date(s.date);
                                    const now = new Date();
                                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                                }).length}
                                color="purple"
                            />
                            <StatCard
                                label="Upcoming"
                                value={schedules.filter((s: any) => new Date(s.date) > new Date()).length}
                                color="green"
                            />
                        </div>
                    )}
                </div>

                {/* Calendar Section */}
                <div className="animate-slideUp animation-delay-300">
                    {loading ? (
                        <div className="glass-card rounded-2xl p-16 flex flex-col items-center justify-center gap-4">
                            <div className="relative">
                                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 animate-pulse" />
                                <Loader2 className="absolute inset-0 m-auto h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <p className="text-muted-foreground animate-pulse">Loading schedule...</p>
                        </div>
                    ) : (
                        <YearlyCalendar
                            schedules={schedules}
                            onSelectDate={setSelectedDate}
                            selectedDate={selectedDate}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Stat Card Component
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    const colorClasses = {
        blue: "from-blue-500/10 to-cyan-500/10 border-blue-200/50 dark:border-blue-800/50 text-blue-700 dark:text-blue-300",
        red: "from-red-500/10 to-pink-500/10 border-red-200/50 dark:border-red-800/50 text-red-700 dark:text-red-300",
        purple: "from-purple-500/10 to-indigo-500/10 border-purple-200/50 dark:border-purple-800/50 text-purple-700 dark:text-purple-300",
        green: "from-green-500/10 to-emerald-500/10 border-green-200/50 dark:border-green-800/50 text-green-700 dark:text-green-300",
    };

    return (
        <div className={`rounded-xl bg-gradient-to-br ${colorClasses[color as keyof typeof colorClasses]} border p-4 transition-all hover:scale-105 hover:shadow-lg cursor-default`}>
            <p className="text-2xl md:text-3xl font-bold">{value}</p>
            <p className="text-xs md:text-sm opacity-80 font-medium">{label}</p>
        </div>
    );
}

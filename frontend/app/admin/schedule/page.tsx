"use client";

import React, { useState, useEffect } from "react";
import { YearlyCalendar } from "./components/YearlyCalendar";
import { ScheduleDialog } from "./components/ScheduleDialog";
import { ExportControls } from "./components/ExportControls";
import { Loader2 } from "lucide-react";

export default function YearlySchedulePage() {
    const [schedules, setSchedules] = useState([]);
    const [holidays, setHolidays] = useState([]);
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
                setHolidays(data.holidays);
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
        <div className="container mx-auto py-8 pt-24 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Practical Schedule</h1>
                    <p className="text-gray-500 dark:text-gray-400">Manage and view all practical sessions for the academic year.</p>
                </div>

                <div className="flex items-center gap-4">
                    <ExportControls schedules={schedules} />
                    <ScheduleDialog
                        onScheduleCreated={fetchSchedules}
                        selectedDate={selectedDate}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : (
                <YearlyCalendar
                    schedules={schedules}
                    holidays={holidays}
                    onSelectDate={setSelectedDate}
                    selectedDate={selectedDate}
                />
            )}
        </div>
    );
}

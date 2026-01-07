"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface YearlyCalendarProps {
    schedules: any[];
    holidays: any[];
    onSelectDate: (date: Date) => void;
    selectedDate?: Date;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export function YearlyCalendar({ schedules, holidays, onSelectDate, selectedDate }: YearlyCalendarProps) {
    const [year, setYear] = useState(new Date().getFullYear());

    const isHoliday = (date: Date) => {
        return holidays.find(h => new Date(h.date).toDateString() === date.toDateString());
    };

    const getSchedulesForDate = (date: Date) => {
        return schedules.filter(s => new Date(s.date).toDateString() === date.toDateString());
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{year}</h2>
                <div className="flex gap-2">
                    <button onClick={() => setYear(year - 1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => setYear(year + 1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {months.map((month, monthIndex) => (
                    <MonthGrid
                        key={month}
                        year={year}
                        monthIndex={monthIndex}
                        schedules={schedules}
                        holidays={holidays}
                        onSelectDate={onSelectDate}
                        selectedDate={selectedDate}
                    />
                ))}
            </div>
        </div>
    );
}

function MonthGrid({ year, monthIndex, schedules, holidays, onSelectDate, selectedDate }: any) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sunday

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDay }, (_, i) => i);

    return (
        <div className="border border-gray-100 dark:border-gray-700/50 rounded-lg p-4">
            <h3 className="font-semibold text-center mb-2 text-gray-700 dark:text-gray-300">{months[monthIndex]}</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="text-gray-400 font-medium py-1">{d}</div>
                ))}
                {blanks.map(b => <div key={`blank-${b}`} />)}
                {days.map(day => {
                    const date = new Date(year, monthIndex, day);
                    const dateString = date.toISOString().split('T')[0];
                    const hasSchedule = schedules.some((s: any) => s.date === dateString);
                    const isHolidayDay = holidays.some((h: any) => h.date === dateString);
                    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

                    return (
                        <button
                            key={day}
                            onClick={() => onSelectDate(date)}
                            className={`
                w-8 h-8 rounded-full flex items-center justify-center transition-all relative
                ${isSelected ? "bg-blue-600 text-white ring-2 ring-blue-300 dark:ring-blue-900" : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"}
                ${isHolidayDay ? "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400" : ""}
                ${hasSchedule && !isSelected ? "font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : ""}
              `}
                        >
                            {day}
                            {hasSchedule && (
                                <span className="absolute bottom-1 w-1 h-1 bg-current rounded-full" />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

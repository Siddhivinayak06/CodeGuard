"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar, Sun, CloudRain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface YearlyCalendarProps {
    schedules: any[];
    onSelectDate: (date: Date) => void;
    selectedDate?: Date;
}

const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

export function YearlyCalendar({ schedules, onSelectDate, selectedDate }: YearlyCalendarProps) {
    const [year, setYear] = useState(new Date().getFullYear());

    return (
        <div className="glass-card-premium rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 p-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                            <Calendar className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white">{year}</h2>
                            <p className="text-white/70 text-sm">Academic Calendar</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setYear(year - 1)}
                            className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors backdrop-blur-sm text-white"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setYear(new Date().getFullYear())}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors backdrop-blur-sm text-white text-sm font-medium"
                        >
                            Today
                        </motion.button>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => setYear(year + 1)}
                            className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-colors backdrop-blur-sm text-white"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </motion.button>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap items-center gap-4 mt-4 text-white/80 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
                        <span>Scheduled</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-white shadow-lg" />
                        <span>Selected</span>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="p-4 md:p-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {months.map((month, monthIndex) => (
                        <motion.div
                            key={month}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: monthIndex * 0.05 }}
                        >
                            <MonthGrid
                                year={year}
                                monthIndex={monthIndex}
                                schedules={schedules}
                                onSelectDate={onSelectDate}
                                selectedDate={selectedDate}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MonthGrid({ year, monthIndex, schedules, onSelectDate, selectedDate }: any) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startDay = new Date(year, monthIndex, 1).getDay(); // 0 = Sunday
    const today = new Date();
    const isCurrentMonth = today.getMonth() === monthIndex && today.getFullYear() === year;

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDay }, (_, i) => i);

    // Count schedules for this month
    const monthScheduleCount = schedules.filter((s: any) => {
        const date = new Date(s.date);
        return date.getMonth() === monthIndex && date.getFullYear() === year;
    }).length;

    return (
        <div className={`rounded-xl border transition-all duration-300 hover:shadow-lg ${isCurrentMonth
            ? "border-indigo-300 dark:border-indigo-700 bg-gradient-to-br from-indigo-50/80 to-purple-50/80 dark:from-indigo-950/30 dark:to-purple-950/30 shadow-md shadow-indigo-100 dark:shadow-indigo-900/20"
            : "border-gray-200/70 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80"
            } p-4 backdrop-blur-sm`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className={`font-semibold ${isCurrentMonth ? "text-indigo-700 dark:text-indigo-300" : "text-gray-700 dark:text-gray-300"}`}>
                    {months[monthIndex]}
                </h3>
                {monthScheduleCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 font-medium">
                        {monthScheduleCount} sessions
                    </span>
                )}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(d => (
                    <div key={d} className="text-gray-400 dark:text-gray-500 font-medium py-1 text-[10px]">{d}</div>
                ))}
                {blanks.map(b => <div key={`blank-${b}`} />)}
                {days.map(day => {
                    const date = new Date(year, monthIndex, day);
                    const dateString = date.toISOString().split('T')[0];
                    const hasSchedule = schedules.some((s: any) => s.date === dateString);
                    const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();
                    const isToday = today.toDateString() === date.toDateString();
                    const isPast = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                    return (
                        <motion.button
                            key={day}
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => onSelectDate(date)}
                            className={`
                                w-7 h-7 rounded-full flex items-center justify-center transition-all relative text-xs font-medium
                                ${isSelected
                                    ? "bg-gradient-to-br from-indigo-500 to-purple-600 text-white ring-2 ring-indigo-300 dark:ring-indigo-700 shadow-lg shadow-indigo-500/40"
                                    : isToday
                                        ? "ring-2 ring-indigo-400 dark:ring-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold"
                                        : "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                                }
                                ${hasSchedule && !isSelected
                                    ? "bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 text-blue-700 dark:text-blue-300 font-bold"
                                    : ""
                                }
                                ${isPast && !hasSchedule && !isSelected && !isToday
                                    ? "opacity-40"
                                    : ""
                                }
                            `}
                        >
                            {day}
                            {hasSchedule && (
                                <span className="absolute -bottom-0.5 w-1 h-1 bg-current rounded-full" />
                            )}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}

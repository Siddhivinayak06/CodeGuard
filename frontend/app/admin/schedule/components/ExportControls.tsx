"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Table as TableIcon, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

interface Schedule {
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    batch_name?: string;
    practicals?: {
        title: string;
        language?: string;
    };
    faculty?: {
        email: string;
        name?: string;
    };
}

interface ExportControlsProps {
    schedules: Schedule[];
}

// Helper to format date nicely
function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

// Helper to format time
function formatTime(time: string): string {
    if (!time) return "-";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Group schedules by month
function groupByMonth(schedules: Schedule[]): Record<string, Schedule[]> {
    const grouped: Record<string, Schedule[]> = {};

    // Sort by date first
    const sorted = [...schedules].sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sorted.forEach((s) => {
        const date = new Date(s.date);
        const monthKey = date.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        if (!grouped[monthKey]) {
            grouped[monthKey] = [];
        }
        grouped[monthKey].push(s);
    });

    return grouped;
}

// Helper to get faculty display name - prioritize name field
function getFacultyName(faculty?: { email: string; name?: string }): string {
    if (!faculty) return "TBA";
    if (faculty.name && faculty.name.trim()) {
        return faculty.name;
    }
    // Only use email username if no name
    return faculty.email?.split("@")[0] || "TBA";
}

export function ExportControls({ schedules }: ExportControlsProps) {

    // ============================================================
    // PROFESSIONAL PDF EXPORT
    // ============================================================
    const exportPDF = () => {
        const doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const currentYear = new Date().getFullYear();

        // ---- TITLE PAGE ----
        // Background gradient effect (approximated with rectangles)
        doc.setFillColor(79, 70, 229); // Indigo
        doc.rect(0, 0, pageWidth, 50, "F");

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont("helvetica", "bold");
        doc.text("Yearly Practical Schedule", pageWidth / 2, 30, { align: "center" });

        // Subtitle
        doc.setFontSize(14);
        doc.setFont("helvetica", "normal");
        doc.text(`Academic Year ${currentYear}`, pageWidth / 2, 42, { align: "center" });

        // Reset colors
        doc.setTextColor(0, 0, 0);

        // Summary stats
        const groupedByMonth = groupByMonth(schedules);
        const months = Object.keys(groupedByMonth);
        const totalSessions = schedules.length;
        const uniquePracticals = new Set(schedules.map(s => s.practicals?.title)).size;
        const uniqueBatches = new Set(schedules.map(s => s.batch_name).filter(Boolean)).size;

        // Stats box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(20, 60, pageWidth - 40, 25, 3, 3, "F");

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(71, 85, 105);

        const statsY = 75;
        doc.text(`Total Sessions: ${totalSessions}`, 40, statsY);
        doc.text(`Unique Practicals: ${uniquePracticals}`, 100, statsY);
        doc.text(`Batches: ${uniqueBatches}`, 170, statsY);
        doc.text(`Months Covered: ${months.length}`, 230, statsY);

        // Generated date
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated on ${new Date().toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })}`, pageWidth / 2, 95, { align: "center" });

        // ---- DATA PAGES ----
        // Create table for each month
        months.forEach((month, monthIndex) => {
            const monthSchedules = groupedByMonth[month];

            doc.addPage();

            // Month header
            doc.setFillColor(79, 70, 229);
            doc.rect(0, 0, pageWidth, 20, "F");

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16);
            doc.setFont("helvetica", "bold");
            doc.text(month, 15, 13);

            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text(`${monthSchedules.length} session${monthSchedules.length > 1 ? 's' : ''}`, pageWidth - 15, 13, { align: "right" });

            // Table data
            const tableData = monthSchedules.map((s, index) => [
                (index + 1).toString(),
                formatDate(s.date),
                `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`,
                s.practicals?.title || "Not specified",
                s.practicals?.language || "-",
                s.batch_name || "All Batches",
                getFacultyName(s.faculty),
            ]);

            // Generate table
            autoTable(doc, {
                head: [["#", "Date", "Time", "Practical", "Language", "Batch", "Faculty"]],
                body: tableData,
                startY: 28,
                theme: "grid",
                headStyles: {
                    fillColor: [99, 102, 241], // Indigo-500
                    textColor: [255, 255, 255],
                    fontSize: 10,
                    fontStyle: "bold",
                    halign: "center",
                },
                bodyStyles: {
                    fontSize: 9,
                    cellPadding: 3,
                },
                alternateRowStyles: {
                    fillColor: [248, 250, 252], // Slate-50
                },
                columnStyles: {
                    0: { halign: "center", cellWidth: 10 },
                    1: { cellWidth: 40 },
                    2: { halign: "center", cellWidth: 35 },
                    3: { cellWidth: "auto" },
                    4: { halign: "center", cellWidth: 25 },
                    5: { halign: "center", cellWidth: 30 },
                    6: { cellWidth: 40 },
                },
                margin: { top: 28, left: 10, right: 10 },
                didDrawPage: (data) => {
                    // Footer with page number
                    const pageNumber = doc.getNumberOfPages();
                    doc.setFontSize(8);
                    doc.setTextColor(148, 163, 184);
                    doc.text(
                        `Page ${pageNumber - 1} of ${months.length}`,
                        pageWidth / 2,
                        pageHeight - 8,
                        { align: "center" }
                    );
                    doc.text(
                        "CodeGuard - Practical Schedule",
                        15,
                        pageHeight - 8
                    );
                },
            });
        });

        // Save
        doc.save(`practical_schedule_${currentYear}.pdf`);
    };

    // ============================================================
    // PROFESSIONAL EXCEL EXPORT - CALENDAR VIEW
    // ============================================================
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        const currentYear = new Date().getFullYear();

        // ---- SUMMARY SHEET (DASHBOARD) ----
        const groupedByMonth = groupByMonth(schedules);
        const months = Object.keys(groupedByMonth);
        const uniquePracticals = [...new Set(schedules.map(s => s.practicals?.title).filter(Boolean))];
        const uniqueBatches = [...new Set(schedules.map(s => s.batch_name).filter(Boolean))];
        const uniqueFaculty = [...new Set(schedules.map(s => getFacultyName(s.faculty)).filter(f => f !== "TBA"))];

        const summaryData = [
            ["📅 YEARLY PRACTICAL SCHEDULE", "", "", ""],
            [`Academic Year ${currentYear}`, "", "", ""],
            ["", "", "", ""],
            ["📊 QUICK STATS", "", "", ""],
            ["", "", "", ""],
            ["Metric", "Count", "", "Details"],
            ["Total Sessions", schedules.length, "", `Across ${months.length} months`],
            ["Unique Practicals", uniquePracticals.length, "", uniquePracticals.slice(0, 3).join(", ") + (uniquePracticals.length > 3 ? "..." : "")],
            ["Active Batches", uniqueBatches.length, "", uniqueBatches.join(", ")],
            ["Faculty Members", uniqueFaculty.length, "", uniqueFaculty.slice(0, 3).join(", ") + (uniqueFaculty.length > 3 ? "..." : "")],
            ["", "", "", ""],
            ["📆 MONTH-WISE DISTRIBUTION", "", "", ""],
            ["", "", "", ""],
            ["Month", "Sessions", "% of Total", "Status"],
            ...months.map(m => {
                const count = groupedByMonth[m].length;
                const percentage = ((count / schedules.length) * 100).toFixed(1);
                const monthDate = new Date(groupedByMonth[m][0].date);
                const isPast = monthDate < new Date();
                return [m, count, `${percentage}%`, isPast ? "Completed" : "Upcoming"];
            }),
            ["", "", "", ""],
            ["Generated", new Date().toLocaleString("en-IN"), "", ""],
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        summarySheet["!cols"] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 50 }];
        summarySheet["!rows"] = [
            { hpt: 28 }, // Title
            { hpt: 22 }, // Subtitle
            { hpt: 18 }, // Empty
            { hpt: 24 }, // Section header
            { hpt: 18 }, // Empty
            { hpt: 20 }, // Header
            ...Array(10).fill({ hpt: 20 }), // Data rows
        ];
        summarySheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
            { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
        ];
        XLSX.utils.book_append_sheet(wb, summarySheet, "📊 Summary");

        // ---- CALENDAR VIEW SHEET ----
        // Create a weekly calendar view for each month
        const calendarData: any[][] = [
            ["📅 CALENDAR VIEW - Weekly Schedule", "", "", "", "", "", "", ""],
            ["", "", "", "", "", "", "", ""],
        ];

        months.forEach((month) => {
            const monthSchedules = groupedByMonth[month];
            const firstDate = new Date(monthSchedules[0].date);
            const year = firstDate.getFullYear();
            const monthIndex = firstDate.getMonth();

            // Add month header
            calendarData.push([`📆 ${month}`, "", "", "", "", "", "", ""]);
            calendarData.push(["Week", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

            // Get first day of month and number of days
            const firstDay = new Date(year, monthIndex, 1);
            const lastDay = new Date(year, monthIndex + 1, 0);
            const daysInMonth = lastDay.getDate();

            let weekNum = 1;
            let currentWeek: string[] = [`Week ${weekNum}`];

            // Fill in blank days at start of month
            for (let i = 0; i < firstDay.getDay(); i++) {
                currentWeek.push("");
            }

            // Fill in each day
            for (let day = 1; day <= daysInMonth; day++) {
                const date = new Date(year, monthIndex, day);
                const dateString = date.toISOString().split('T')[0];
                const daySchedules = monthSchedules.filter(s => s.date === dateString);

                if (daySchedules.length > 0) {
                    const sessionInfo = daySchedules.map(s =>
                        `${formatTime(s.start_time)}: ${s.practicals?.title || "Session"} (${s.batch_name || "All"})`
                    ).join("\n");
                    currentWeek.push(sessionInfo);
                } else {
                    currentWeek.push(day.toString());
                }

                // If Saturday or last day of month, start new week
                if (date.getDay() === 6 || day === daysInMonth) {
                    // Pad with empty cells if needed
                    while (currentWeek.length < 8) {
                        currentWeek.push("");
                    }
                    calendarData.push(currentWeek);
                    weekNum++;
                    currentWeek = [`Week ${weekNum}`];
                }
            }

            calendarData.push(["", "", "", "", "", "", "", ""]); // Empty row between months
        });

        const calendarSheet = XLSX.utils.aoa_to_sheet(calendarData);
        calendarSheet["!cols"] = [
            { wch: 10 },  // Week
            { wch: 30 }, // Sunday
            { wch: 30 }, // Monday
            { wch: 30 }, // Tuesday
            { wch: 30 }, // Wednesday
            { wch: 30 }, // Thursday
            { wch: 30 }, // Friday
            { wch: 30 }, // Saturday
        ];
        // Set row heights for calendar - each row needs adequate height for session info
        calendarSheet["!rows"] = calendarData.map((_, i) => {
            if (i === 0) return { hpt: 28 }; // Title
            if (i === 1) return { hpt: 18 }; // Empty
            return { hpt: 45 }; // Calendar rows need more height for multi-line content
        });
        XLSX.utils.book_append_sheet(wb, calendarSheet, "📅 Calendar View");

        // ---- DETAILED SCHEDULE SHEET ----
        const detailedData: any[][] = [
            ["📋 DETAILED SCHEDULE", "", "", "", "", "", "", "", "", ""],
            ["Complete list of all scheduled sessions", "", "", "", "", "", "", "", "", ""],
            ["", "", "", "", "", "", "", "", "", ""],
            ["#", "Date", "Day", "Start", "End", "Duration", "Practical", "Language", "Batch", "Faculty"],
        ];

        const sorted = [...schedules].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        sorted.forEach((s, index) => {
            const startParts = s.start_time?.split(":") || ["0", "0"];
            const endParts = s.end_time?.split(":") || ["0", "0"];
            const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            const endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
            const duration = endMins - startMins;
            const hours = Math.floor(duration / 60);
            const mins = duration % 60;

            detailedData.push([
                index + 1,
                formatDate(s.date),
                new Date(s.date).toLocaleDateString("en-IN", { weekday: "long" }),
                formatTime(s.start_time),
                formatTime(s.end_time),
                `${hours}h ${mins}m`,
                s.practicals?.title || "Not specified",
                s.practicals?.language || "-",
                s.batch_name || "All Batches",
                getFacultyName(s.faculty),
            ]);
        });

        // Add totals row
        detailedData.push(["", "", "", "", "", "", "", "", "", ""]);
        detailedData.push(["TOTAL", `${schedules.length} sessions`, "", "", "", "", "", "", "", ""]);

        const detailedSheet = XLSX.utils.aoa_to_sheet(detailedData);
        detailedSheet["!cols"] = [
            { wch: 6 },   // #
            { wch: 22 },  // Date
            { wch: 14 },  // Day
            { wch: 12 },  // Start
            { wch: 12 },  // End
            { wch: 12 },  // Duration
            { wch: 40 },  // Practical
            { wch: 15 },  // Language
            { wch: 18 },  // Batch
            { wch: 28 },  // Faculty
        ];
        detailedSheet["!rows"] = [
            { hpt: 28 }, // Title
            { hpt: 20 }, // Subtitle
            { hpt: 18 }, // Empty
            { hpt: 22 }, // Header
            ...Array(sorted.length + 2).fill({ hpt: 20 }), // Data rows
        ];
        XLSX.utils.book_append_sheet(wb, detailedSheet, "📋 All Sessions");

        // ---- BATCH-WISE SHEET ----
        const batchData: any[][] = [
            ["👥 BATCH-WISE SCHEDULE", "", "", "", "", ""],
            ["Sessions organized by batch", "", "", "", "", ""],
            ["", "", "", "", "", ""],
        ];

        uniqueBatches.forEach(batch => {
            const batchSchedules = sorted.filter(s => s.batch_name === batch);
            batchData.push([`📌 ${batch}`, `${batchSchedules.length} sessions`, "", "", "", ""]);
            batchData.push(["#", "Date", "Time", "Practical", "Faculty", ""]);

            batchSchedules.forEach((s, i) => {
                batchData.push([
                    i + 1,
                    formatDate(s.date),
                    `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`,
                    s.practicals?.title || "Not specified",
                    getFacultyName(s.faculty),
                    "",
                ]);
            });
            batchData.push(["", "", "", "", "", ""]);
        });

        const batchSheet = XLSX.utils.aoa_to_sheet(batchData);
        batchSheet["!cols"] = [
            { wch: 6 },
            { wch: 22 },
            { wch: 26 },
            { wch: 40 },
            { wch: 28 },
            { wch: 6 },
        ];
        batchSheet["!rows"] = batchData.map((row, i) => {
            if (i < 3) return { hpt: i === 0 ? 28 : 20 }; // Title rows
            if (String(row[0]).includes("📌")) return { hpt: 24 }; // Batch headers
            if (row[0] === "#") return { hpt: 22 }; // Column headers
            return { hpt: 20 }; // Data rows
        });
        XLSX.utils.book_append_sheet(wb, batchSheet, "👥 By Batch");

        // ---- FACULTY WORKLOAD SHEET ----
        const facultyData: any[][] = [
            ["👨‍🏫 FACULTY WORKLOAD", "", "", "", ""],
            ["Sessions per faculty member", "", "", "", ""],
            ["", "", "", "", ""],
            ["Faculty Name", "Total Sessions", "Batches", "Practicals Covered", "Next Session"],
        ];

        uniqueFaculty.forEach(faculty => {
            const facultySchedules = sorted.filter(s =>
                getFacultyName(s.faculty) === faculty
            );
            const facultyBatches = [...new Set(facultySchedules.map(s => s.batch_name).filter(Boolean))];
            const facultyPracticals = [...new Set(facultySchedules.map(s => s.practicals?.title).filter(Boolean))];
            const upcomingSessions = facultySchedules.filter(s => new Date(s.date) >= new Date());
            const nextSession = upcomingSessions.length > 0 ? formatDate(upcomingSessions[0].date) : "None";

            facultyData.push([
                faculty,
                facultySchedules.length,
                facultyBatches.join(", ") || "All",
                facultyPracticals.slice(0, 3).join(", ") + (facultyPracticals.length > 3 ? "..." : ""),
                nextSession,
            ]);
        });

        facultyData.push(["", "", "", "", ""]);
        facultyData.push(["TOTAL", schedules.length, "", "", ""]);

        const facultySheet = XLSX.utils.aoa_to_sheet(facultyData);
        facultySheet["!cols"] = [
            { wch: 30 },
            { wch: 18 },
            { wch: 25 },
            { wch: 50 },
            { wch: 22 },
        ];
        facultySheet["!rows"] = [
            { hpt: 28 }, // Title
            { hpt: 20 }, // Subtitle
            { hpt: 18 }, // Empty
            { hpt: 22 }, // Header
            ...Array(uniqueFaculty.length + 2).fill({ hpt: 20 }), // Data rows
        ];
        XLSX.utils.book_append_sheet(wb, facultySheet, "👨‍🏫 Faculty Load");

        // ---- MONTH-WISE SHEETS ----
        months.forEach((month) => {
            const monthSchedules = groupedByMonth[month];
            const monthData: any[][] = [
                [`📆 ${month.toUpperCase()}`, "", "", "", "", "", ""],
                [`${monthSchedules.length} scheduled sessions`, "", "", "", "", "", ""],
                ["", "", "", "", "", "", ""],
                ["#", "Date", "Day", "Time", "Practical", "Batch", "Faculty"],
            ];

            monthSchedules.forEach((s, index) => {
                monthData.push([
                    index + 1,
                    formatDate(s.date),
                    new Date(s.date).toLocaleDateString("en-IN", { weekday: "short" }),
                    `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`,
                    s.practicals?.title || "Not specified",
                    s.batch_name || "All Batches",
                    getFacultyName(s.faculty),
                ]);
            });

            const monthSheet = XLSX.utils.aoa_to_sheet(monthData);
            monthSheet["!cols"] = [
                { wch: 6 },
                { wch: 22 },
                { wch: 12 },
                { wch: 26 },
                { wch: 40 },
                { wch: 18 },
                { wch: 28 },
            ];
            monthSheet["!rows"] = [
                { hpt: 28 }, // Title
                { hpt: 20 }, // Subtitle
                { hpt: 18 }, // Empty
                { hpt: 22 }, // Header
                ...Array(monthSchedules.length).fill({ hpt: 20 }), // Data rows
            ];

            // Shorten month name for sheet name (max 31 chars)
            const shortMonth = month.replace(" ", "_").substring(0, 28);
            XLSX.utils.book_append_sheet(wb, monthSheet, shortMonth);
        });

        // Save
        XLSX.writeFile(wb, `practical_schedule_${currentYear}.xlsx`);
    };

    return (
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={exportPDF}
                className="gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-red-50 hover:to-pink-50 dark:hover:from-red-950/30 dark:hover:to-pink-950/30 hover:text-red-700 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 transition-all duration-300 shadow-sm hover:shadow-md group"
            >
                <div className="p-1 rounded-md bg-red-100 dark:bg-red-900/30 group-hover:bg-red-200 dark:group-hover:bg-red-800/40 transition-colors">
                    <FileDown className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                </div>
                <span className="font-medium">PDF</span>
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={exportExcel}
                className="gap-2 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-teal-50 dark:hover:from-emerald-950/30 dark:hover:to-teal-950/30 hover:text-emerald-700 dark:hover:text-emerald-400 hover:border-emerald-300 dark:hover:border-emerald-800 transition-all duration-300 shadow-sm hover:shadow-md group"
            >
                <div className="p-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 transition-colors">
                    <TableIcon className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <span className="font-medium">Excel</span>
            </Button>
        </div>
    );
}

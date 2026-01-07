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
        full_name?: string;
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
                s.faculty?.full_name || s.faculty?.email?.split("@")[0] || "TBA",
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
    // PROFESSIONAL EXCEL EXPORT
    // ============================================================
    const exportExcel = () => {
        const wb = XLSX.utils.book_new();
        const currentYear = new Date().getFullYear();

        // ---- SUMMARY SHEET ----
        const groupedByMonth = groupByMonth(schedules);
        const months = Object.keys(groupedByMonth);

        const summaryData = [
            ["Yearly Practical Schedule"],
            [`Academic Year ${currentYear}`],
            [],
            ["Summary Statistics"],
            ["Total Sessions", schedules.length],
            ["Unique Practicals", new Set(schedules.map(s => s.practicals?.title)).size],
            ["Batches", new Set(schedules.map(s => s.batch_name).filter(Boolean)).size],
            ["Months Covered", months.length],
            [],
            ["Month-wise Breakdown"],
            ["Month", "Sessions"],
            ...months.map(m => [m, groupedByMonth[m].length]),
            [],
            [`Generated on ${new Date().toLocaleString("en-IN")}`],
        ];

        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);

        // Style summary sheet
        summarySheet["!cols"] = [{ wch: 25 }, { wch: 15 }];
        summarySheet["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // Title
            { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // Subtitle
        ];

        XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

        // ---- ALL SCHEDULES SHEET ----
        const allData = schedules
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map((s, index) => ({
                "#": index + 1,
                "Date": formatDate(s.date),
                "Day": new Date(s.date).toLocaleDateString("en-IN", { weekday: "long" }),
                "Start Time": formatTime(s.start_time),
                "End Time": formatTime(s.end_time),
                "Practical": s.practicals?.title || "Not specified",
                "Language": s.practicals?.language || "-",
                "Batch": s.batch_name || "All Batches",
                "Faculty": s.faculty?.full_name || s.faculty?.email?.split("@")[0] || "TBA",
            }));

        const allSheet = XLSX.utils.json_to_sheet(allData);

        // Set column widths
        allSheet["!cols"] = [
            { wch: 5 },  // #
            { wch: 18 }, // Date
            { wch: 12 }, // Day
            { wch: 12 }, // Start Time
            { wch: 12 }, // End Time
            { wch: 35 }, // Practical
            { wch: 12 }, // Language
            { wch: 15 }, // Batch
            { wch: 20 }, // Faculty
        ];

        XLSX.utils.book_append_sheet(wb, allSheet, "All Schedules");

        // ---- MONTH-WISE SHEETS (optional, max 5 to avoid too many sheets) ----
        if (months.length <= 12) {
            months.forEach((month) => {
                const monthSchedules = groupedByMonth[month];
                const monthData = monthSchedules.map((s, index) => ({
                    "#": index + 1,
                    "Date": formatDate(s.date),
                    "Day": new Date(s.date).toLocaleDateString("en-IN", { weekday: "long" }),
                    "Time": `${formatTime(s.start_time)} - ${formatTime(s.end_time)}`,
                    "Practical": s.practicals?.title || "Not specified",
                    "Language": s.practicals?.language || "-",
                    "Batch": s.batch_name || "All Batches",
                    "Faculty": s.faculty?.full_name || s.faculty?.email?.split("@")[0] || "TBA",
                }));

                const monthSheet = XLSX.utils.json_to_sheet(monthData);
                monthSheet["!cols"] = [
                    { wch: 5 },
                    { wch: 18 },
                    { wch: 12 },
                    { wch: 22 },
                    { wch: 35 },
                    { wch: 12 },
                    { wch: 15 },
                    { wch: 20 },
                ];

                // Shorten month name for sheet name (max 31 chars)
                const shortMonth = month.replace(" ", "_").substring(0, 31);
                XLSX.utils.book_append_sheet(wb, monthSheet, shortMonth);
            });
        }

        // Save
        XLSX.writeFile(wb, `practical_schedule_${currentYear}.xlsx`);
    };

    return (
        <div className="flex gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={exportPDF}
                className="gap-2 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
            >
                <FileDown className="h-4 w-4" />
                Export PDF
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={exportExcel}
                className="gap-2 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
            >
                <TableIcon className="h-4 w-4" />
                Export Excel
            </Button>
        </div>
    );
}

// lib/SubjectReportPdf.ts
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface StudentPracticalMarks {
    student_name: string;
    roll_no: string;
    practicals: { title: string; marks: number | null }[];
}

interface SubjectReportData {
    subjectName: string;
    subjectCode: string;
    practicalTitles: string[];
    practicalDeadlines: string[];
    students: StudentPracticalMarks[];
    generatedBy?: string;
}

export async function generateSubjectReport({
    subjectName,
    subjectCode,
    practicalTitles,
    practicalDeadlines,
    students,
    generatedBy,
}: SubjectReportData) {
    const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    let cursorY = margin;

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(`Subject Report: ${subjectName}`, pageWidth / 2, cursorY, {
        align: "center",
    });
    cursorY += 25;

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Subject Code: ${subjectCode}`, pageWidth / 2, cursorY, {
        align: "center",
    });
    cursorY += 15;

    doc.setFontSize(10);
    doc.text(
        `Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`,
        pageWidth / 2,
        cursorY,
        { align: "center" }
    );
    cursorY += 30;

    // Table Headers: Sr. No, Name, Roll No, Practical 1, Practical 2, ... , Total
    const tableHead = [
        "Sr.",
        "Student Name",
        "Roll No.",
        ...practicalTitles.map((_, i) => `P${i + 1}`),
        "Total",
        "Avg",
    ];

    const tableBody = students.map((student, idx) => {
        const marks = student.practicals.map((p, pIdx) => {
            if (p.marks !== null) return p.marks.toString();

            const deadline = practicalDeadlines[pIdx];
            const isExpired = deadline && new Date(deadline).getTime() < Date.now();
            return isExpired ? "Abs" : "-";
        });
        const validMarks = student.practicals
            .filter((p) => p.marks !== null)
            .map((p) => p.marks as number);
        const total = validMarks.reduce((sum, m) => sum + m, 0);
        const avg =
            validMarks.length > 0 ? (total / validMarks.length).toFixed(1) : "-";

        return [
            (idx + 1).toString(),
            student.student_name,
            student.roll_no,
            ...marks,
            total.toString(),
            avg,
        ];
    });

    // Use autoTable for the grid
    autoTable(doc, {
        startY: cursorY,
        head: [tableHead],
        body: tableBody,
        theme: "grid",
        headStyles: {
            fillColor: [79, 70, 229], // Indigo
            textColor: 255,
            fontStyle: "bold",
            fontSize: 8,
            halign: "center",
        },
        bodyStyles: {
            fontSize: 8,
            halign: "center",
        },
        columnStyles: {
            0: { cellWidth: 30 }, // Sr.
            1: { cellWidth: 120, halign: "left" }, // Name
            2: { cellWidth: 60 }, // Roll No
        },
        alternateRowStyles: {
            fillColor: [245, 245, 250],
        },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
            // Footer on each page
            const pageCount = doc.getNumberOfPages();
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.text("CodeGuard", margin, pageHeight - 20);
            doc.text(
                `Page ${data.pageNumber} of ${pageCount}`,
                pageWidth - margin - 60,
                pageHeight - 20
            );
        },
    });

    // Practical Title Legend on last page
    const finalY = (doc as any).lastAutoTable.finalY + 30;

    if (finalY < pageHeight - 100) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Practical Legend:", margin, finalY);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        practicalTitles.forEach((title, i) => {
            const legendY = finalY + 15 + i * 12;
            if (legendY < pageHeight - 40) {
                doc.text(`P${i + 1}: ${title}`, margin + 10, legendY);
            }
        });
    }

    // Save
    const filename = `${subjectCode}_report_${new Date().toISOString().split("T")[0]}.pdf`;
    doc.save(filename);
}

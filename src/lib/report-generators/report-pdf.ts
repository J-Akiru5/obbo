import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportExportData } from "./types";

export function generateReportPDF(data: ReportExportData): void {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const BLUE = [26, 58, 100] as [number, number, number];
    const YELLOW = [255, 193, 7] as [number, number, number];
    const LIGHT_GRAY = [248, 248, 248] as [number, number, number];
    const pageW = doc.internal.pageSize.getWidth();

    // ── Header ────────────────────────────────────────────────────
    doc.setFillColor(...BLUE);
    doc.rect(0, 0, pageW, 28, "F");

    doc.setFillColor(...YELLOW);
    doc.rect(0, 26, pageW, 2, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("OBBO iManage", 14, 12);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Daily Warehouse Report", 14, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`Report Date: ${data.date}`, pageW - 14, 12, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 14, 20, { align: "right" });

    let y = 36;

    // ── Section 1: Physical Warehouse Inventory ───────────────────
    doc.setTextColor(...BLUE);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("1. Physical Warehouse Inventory", 14, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [["Metric", "JB Bags", "SB Bags"]],
        body: [
            ["Yesterday's Closing", data.physical.yesterday_jb, data.physical.yesterday_sb],
            ["Stock Received (+)", data.physical.received_jb, data.physical.received_sb],
            ["Total Dispatched (−)", data.physical.dispatched_jb, data.physical.dispatched_sb],
            ["Customer Returns (+)", data.physical.returned_jb, data.physical.returned_sb],
            ["Waste / Damaged (−)", data.physical.waste_jb, data.physical.waste_sb],
            ["Today's Closing Balance", data.physical.closing_jb, data.physical.closing_sb],
        ],
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: LIGHT_GRAY },
        columnStyles: {
            0: { cellWidth: 100 },
            1: { halign: "right" },
            2: { halign: "right" },
        },
        // Style the closing row bold
        didParseCell(data) {
            if (data.row.index === 5 && data.section === "body") {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [230, 240, 255];
                data.cell.styles.textColor = BLUE;
            }
        },
        margin: { left: 14, right: 14 },
        theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // ── Section 2: Customer Movement ─────────────────────────────
    doc.setTextColor(...BLUE);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("2. Customer Movement Today", 14, y);
    y += 4;

    const totalJb = data.dispatches.reduce((s, d) => s + d.jb, 0);
    const totalSb = data.dispatches.reduce((s, d) => s + d.sb, 0);

    autoTable(doc, {
        startY: y,
        head: [["Client", "DR Number", "Service", "JB", "SB", "Total"]],
        body: data.dispatches.length > 0
            ? [
                ...data.dispatches.map((d) => [
                    d.client,
                    d.dr || "—",
                    d.service?.toUpperCase() ?? "—",
                    d.jb,
                    d.sb,
                    d.jb + d.sb,
                ]),
                ["TOTAL", "", "", totalJb, totalSb, totalJb + totalSb],
            ]
            : [["No dispatches recorded today", "", "", "", "", ""]],
        headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: LIGHT_GRAY },
        columnStyles: {
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right", fontStyle: "bold" },
        },
        didParseCell(data) {
            // Bold the total row
            if (data.row.index === data.table.body.length - 1 && data.section === "body" && totalJb + totalSb > 0) {
                data.cell.styles.fontStyle = "bold";
                data.cell.styles.fillColor = [230, 240, 255];
            }
        },
        margin: { left: 14, right: 14 },
        theme: "striped",
    });

    y = (doc as any).lastAutoTable.finalY + 10;

    // Check if need a new page
    if (y > 240) {
        doc.addPage();
        y = 20;
    }

    // ── Section 3: Customer Obligations ───────────────────────────
    doc.setTextColor(180, 100, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("3. Customer Obligation Report", 14, y);
    y += 4;

    autoTable(doc, {
        startY: y,
        head: [["Client Name", "Product", "Bag Type", "Remaining Balance"]],
        body: data.balances.length > 0
            ? data.balances.map((b) => [b.client, b.product, b.bag_type, b.qty])
            : [["No pending obligations", "", "", ""]],
        headStyles: { fillColor: [180, 100, 0], textColor: 255, fontStyle: "bold" },
        bodyStyles: { fontSize: 9 },
        alternateRowStyles: { fillColor: [255, 252, 240] },
        columnStyles: {
            3: { halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14 },
        theme: "striped",
    });

    // ── Footer ────────────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const footerY = doc.internal.pageSize.getHeight() - 8;
        doc.setFillColor(...BLUE);
        doc.rect(0, footerY - 4, pageW, 14, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`OBBO iManage · Daily Warehouse Report · ${data.date}`, 14, footerY + 2);
        doc.text(`Page ${i} of ${pageCount}`, pageW - 14, footerY + 2, { align: "right" });
    }

    doc.save(`OBBO_Daily_Report_${data.date}.pdf`);
}

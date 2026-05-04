import * as XLSX from "xlsx";
import type { ReportExportData } from "./types";

export function generateReportXLSX(data: ReportExportData): void {
    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Physical Warehouse Inventory ─────────────────────
    const physicalRows = [
        ["OBBO iManage — Daily Warehouse Report", "", ""],
        [`Date: ${data.date}`, "", ""],
        [],
        ["PHYSICAL WAREHOUSE INVENTORY", "", ""],
        ["Metric", "JB Bags", "SB Bags"],
        ["Yesterday's Closing", data.physical.yesterday_jb, data.physical.yesterday_sb],
        ["Stock Received (+)", data.physical.received_jb, data.physical.received_sb],
        ["Total Dispatched (−)", data.physical.dispatched_jb, data.physical.dispatched_sb],
        ["Customer Returns (+)", data.physical.returned_jb, data.physical.returned_sb],
        ["Waste / Damaged (−)", data.physical.waste_jb, data.physical.waste_sb],
        ["Today's Closing Balance", data.physical.closing_jb, data.physical.closing_sb],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(physicalRows);
    ws1["!cols"] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }];
    ws1["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }, // Title
        { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } }, // Date
    ];
    XLSX.utils.book_append_sheet(wb, ws1, "Physical Inventory");

    // ── Sheet 2: Customer Movement ────────────────────────────────
    const movHeader = ["Client", "DR Number", "Service Type", "JB", "SB", "Total"];
    const movRows = data.dispatches.map((d) => [
        d.client,
        d.dr || "—",
        d.service?.toUpperCase() ?? "—",
        d.jb,
        d.sb,
        d.jb + d.sb,
    ]);
    const totalJb = data.dispatches.reduce((s, d) => s + d.jb, 0);
    const totalSb = data.dispatches.reduce((s, d) => s + d.sb, 0);
    movRows.push(["TOTAL", "", "", totalJb, totalSb, totalJb + totalSb]);

    const ws2 = XLSX.utils.aoa_to_sheet([
        [`Customer Movement — ${data.date}`],
        [],
        movHeader,
        ...movRows,
    ]);
    ws2["!cols"] = [{ wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Customer Movement");

    // ── Sheet 3: Customer Obligations ─────────────────────────────
    const balHeader = ["Client Name", "Product", "Bag Type", "Remaining Balance"];
    const balRows = data.balances.map((b) => [b.client, b.product, b.bag_type, b.qty]);

    const ws3 = XLSX.utils.aoa_to_sheet([
        [`Customer Obligation Report — ${data.date}`],
        [],
        balHeader,
        ...balRows,
    ]);
    ws3["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 12 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Customer Obligations");

    // ── Download ──────────────────────────────────────────────────
    XLSX.writeFile(wb, `OBBO_Daily_Report_${data.date}.xlsx`);
}

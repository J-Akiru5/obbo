// Shared types for daily report export utilities

export interface PhysicalData {
  yesterday_jb: number;
  yesterday_sb: number;
  received_jb: number;
  received_sb: number;
  dispatched_jb: number;
  dispatched_sb: number;
  returned_jb: number;
  returned_sb: number;
  waste_jb: number;
  waste_sb: number;
  closing_jb: number;
  closing_sb: number;
}

/**
 * One delivery receipt for a given day.
 *
 * jb / sb are INDIVIDUAL BAGS (rounded whole numbers), NOT internal JB/SB
 * units. `delivery_receipts.jb/sb` are stored in units and can be fractional;
 * `fetchDispatchesForDate` converts them to bags before building these rows,
 * so every table, PDF, and XLSX that sums `jb + sb` gets a real bag total.
 */
export interface DispatchRow {
  client: string;
  dr: string | null;
  service: string;
  jb: number;
  sb: number;
}

export interface BalanceRow {
  client: string;
  product: string;
  qty: number;
  bag_type: string;
}

export interface ReportExportData {
  date: string;
  physical: PhysicalData;
  dispatches: DispatchRow[];
  balances: BalanceRow[];
}

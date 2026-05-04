import { fetchClientBalances, fetchBalanceSummary } from "@/lib/actions/client-actions";
import LedgerClient from "./components/ledger-client";

export const metadata = {
    title: "Balance Ledger | OBBO iManage",
};

export default async function ClientLedgerPage() {
    const [balances, summary] = await Promise.all([
        fetchClientBalances(),
        fetchBalanceSummary(),
    ]);

    return <LedgerClient balances={balances} summary={summary} />;
}

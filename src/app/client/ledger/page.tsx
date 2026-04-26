import { fetchClientBalances } from "@/lib/actions/client-actions";
import LedgerClient from "./components/ledger-client";

export const metadata = {
    title: "Balance Ledger | OBBO iManage",
};

export default async function ClientLedgerPage() {
    const balances = await fetchClientBalances();

    return <LedgerClient balances={balances} />;
}

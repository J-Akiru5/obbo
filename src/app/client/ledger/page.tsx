import {
  fetchClientBalances,
  fetchBalanceSummary,
  getClientKycStatus,
  fetchPendingRedeliveries,
} from '@/lib/actions/client-actions';
import LedgerClient from './components/ledger-client';

export const metadata = {
  title: 'Balance Ledger | OBBO iManage',
};

export default async function ClientLedgerPage() {
  const { kyc_status } = await getClientKycStatus();

  if (kyc_status !== 'verified') {
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
          <svg
            className="h-8 w-8 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-9.364A9 9 0 1112 3a9 9 0 017.364 4.636z"
            />
          </svg>
        </div>
        <h2 className="text-foreground text-xl font-bold">KYC Verification Required</h2>
        <p className="text-muted-foreground">
          Your account must be verified before you can view your balance ledger and request
          redeliveries. Please wait for an administrator to verify your submitted KYC documents, or
          contact support if you need assistance.
        </p>
        <a
          href="/client/profile"
          className="text-primary hover:text-primary/80 inline-flex items-center gap-2 text-sm font-medium transition-colors"
        >
          View Profile Status →
        </a>
      </div>
    );
  }

  const [balances, summary, pendingRedeliveries] = await Promise.all([
    fetchClientBalances(),
    fetchBalanceSummary(),
    fetchPendingRedeliveries(),
  ]);

  return (
    <LedgerClient balances={balances} summary={summary} pendingRedeliveries={pendingRedeliveries} />
  );
}

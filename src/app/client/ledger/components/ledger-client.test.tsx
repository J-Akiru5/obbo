import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LedgerClient from "@/app/client/ledger/components/ledger-client";

// Mock next/navigation
vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
    toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock Supabase client
vi.mock("@/lib/supabase/client", () => ({
    createClient: () => ({
        channel: () => ({
            on: () => ({ subscribe: vi.fn() }),
        }),
        removeChannel: vi.fn(),
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => ({ data: [], error: null }),
                    single: () => ({ data: null, error: null }),
                }),
            }),
        }),
        auth: {
            getUser: () => ({ data: { user: { id: "test-user" } }, error: null }),
        },
    }),
}));

// Mock server actions
vi.mock("@/lib/actions/client-actions", () => ({
    submitRedeliveryRequest: vi.fn(),
}));

describe("LedgerClient - Balance Ledger Component", () => {
    it("renders empty state when no balances exist", () => {
        render(
            <LedgerClient
                balances={[]}
                summary={{
                    totalPurchased: 0,
                    totalDelivered: 0,
                    remainingBalance: 0,
                }}
            />
        );

        expect(screen.getByText("You have no outstanding balances.")).toBeInTheDocument();
    });

    it("renders summary cards with correct values", () => {
        render(
            <LedgerClient
                balances={[]}
                summary={{
                    totalPurchased: 100,
                    totalDelivered: 75,
                    remainingBalance: 25,
                }}
            />
        );

        expect(screen.getByText("100")).toBeInTheDocument();
        expect(screen.getByText("75")).toBeInTheDocument();
        expect(screen.getByText("25")).toBeInTheDocument();
    });

    it("renders fulfilled balances section even with no fulfilled entries", () => {
        render(
            <LedgerClient
                balances={[]}
                summary={{
                    totalPurchased: 10,
                    totalDelivered: 10,
                    remainingBalance: 0,
                }}
            />
        );

        expect(screen.getByText("Fulfilled Balances")).toBeInTheDocument();
        expect(screen.getByText("No completed balances yet.")).toBeInTheDocument();
    });

    it('shows "Completed" badge when remaining balance is 0', () => {
        render(
            <LedgerClient
                balances={[
                    {
                        id: "1",
                        client_id: "client-1",
                        order_id: "order-1",
                        product_id: "prod-1",
                        bag_type: "JB",
                        total_purchase: 10,
                        remaining_qty: 0,
                        status: "pending",
                        created_at: new Date().toISOString(),
                        product: { name: "Portland Cement" },
                        order: {
                            po_number: "PO-2026-001",
                            created_at: new Date().toISOString(),
                        },
                    },
                ]}
                summary={{
                    totalPurchased: 10,
                    totalDelivered: 10,
                    remainingBalance: 0,
                }}
            />
        );

        expect(screen.getByText("Completed")).toBeInTheDocument();
        expect(screen.queryByText("Request Balance Delivery")).not.toBeInTheDocument();
    });

    it("shows request button when balance is greater than 0", () => {
        render(
            <LedgerClient
                balances={[
                    {
                        id: "2",
                        client_id: "client-1",
                        order_id: "order-1",
                        product_id: "prod-1",
                        bag_type: "SB",
                        total_purchase: 20,
                        remaining_qty: 5,
                        status: "pending",
                        created_at: new Date().toISOString(),
                        product: { name: "Portland Cement" },
                        order: {
                            po_number: "PO-2026-002",
                            created_at: new Date().toISOString(),
                        },
                    },
                ]}
                summary={{
                    totalPurchased: 20,
                    totalDelivered: 15,
                    remainingBalance: 5,
                }}
            />
        );

        expect(screen.getByText("Request Balance Delivery")).toBeInTheDocument();
    });
});

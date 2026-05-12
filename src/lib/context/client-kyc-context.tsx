"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type KycStatus = "pending_verification" | "verified" | "rejected";

interface ClientKycContextValue {
  kycStatus: KycStatus;
  isLoading: boolean;
}

const ClientKycContext = createContext<ClientKycContextValue>({
  kycStatus: "verified",
  isLoading: true,
});

export function ClientKycProvider({ children }: { children: React.ReactNode }) {
  const [kycStatus, setKycStatus] = useState<KycStatus>("verified");
  const [isLoading, setIsLoading] = useState(true);

  const loadKycStatus = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("kyc_status")
        .eq("id", user.id)
        .single();

      if (profile?.kyc_status) {
        setKycStatus(profile.kyc_status as KycStatus);
      }
    } catch {
      // silently fail — default to verified to avoid locking verified users
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKycStatus();

    // Real-time subscription: update KYC status if admin approves/rejects
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    const supabase = createClient();

    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      channel = supabase
        .channel(`kyc-status-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.new?.kyc_status) {
              setKycStatus(payload.new.kyc_status as KycStatus);
            }
          }
        )
        .subscribe();
    };

    setupSubscription();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadKycStatus]);

  return (
    <ClientKycContext.Provider value={{ kycStatus, isLoading }}>
      {children}
    </ClientKycContext.Provider>
  );
}

export function useClientKyc() {
  return useContext(ClientKycContext);
}

export function useIsKycVerified() {
  const { kycStatus, isLoading } = useClientKyc();
  return { isVerified: kycStatus === "verified", isLoading };
}

"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export function SubscriptionPortalDialog() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCustomer, setHasCustomer] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const checkCustomer = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: customer } = await supabase
          .from("customers")
          .select("creem_customer_id")
          .eq("user_id", user.id)
          .single();

        setHasCustomer(!!customer?.creem_customer_id?.startsWith("cust_"));
      } catch (err) {
        console.error("Error checking customer:", err);
        setHasCustomer(false);
      }
    };

    checkCustomer();
  }, []);

  const handleManageSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/creem/customer-portal");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get portal link");
      }

      const data = await response.json();
      const link = data.customer_portal_link;

      if (link) {
        window.location.href = link;
      } else {
        throw new Error("No portal link in response");
      }
    } catch (err: any) {
      console.error("Error getting portal link:", err);
      setError(
        err.message ||
          "Failed to access subscription portal. Please try again later."
      );
      setIsLoading(false);
    }
  };

  if (!hasCustomer) {
    return null;
  }

  return (
    <div>
      <Button
        variant="outline"
        className="w-full"
        disabled={isLoading}
        onClick={handleManageSubscription}
      >
        {isLoading ? "Redirecting..." : "Manage Plan"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
      {error && (
        <p className="text-sm text-destructive mt-2">{error}</p>
      )}
    </div>
  );
}
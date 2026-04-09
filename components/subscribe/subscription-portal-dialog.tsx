"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

interface SubscriptionPortalDialogProps {
  creemCustomerId?: string | null;
}

export function SubscriptionPortalDialog({
  creemCustomerId,
}: SubscriptionPortalDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 没有有效的 Creem 客户 ID → 不渲染
  if (!creemCustomerId || !creemCustomerId.startsWith("cust_")) {
    return null;
  }

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
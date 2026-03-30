"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function ClientDashboardRedirect({ clientId }: { clientId: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(`/clients/${clientId}`);
  }, [clientId, router]);
  return null;
}

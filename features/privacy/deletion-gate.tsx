"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function DeletionGate({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = pathname === "/account/deletion-pending";

  useEffect(() => {
    if (pending && !allowed) {
      router.replace("/account/deletion-pending");
    }
  }, [allowed, pending, router]);

  if (pending && !allowed) {
    return null;
  }

  return children;
}

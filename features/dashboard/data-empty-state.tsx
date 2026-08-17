import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

export function DataEmptyState({
  title,
  description,
  href = "/import",
  action = "Importera Garmin-fil",
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <Empty className="border-border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href={href}>{action}</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}

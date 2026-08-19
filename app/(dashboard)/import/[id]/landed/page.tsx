import { notFound, redirect } from "next/navigation";

import { LandedStory } from "@/features/sync/landed-story";
import { getImportLanding } from "@/lib/db/queries";

export default async function ImportLandedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: LandingPayload | null = null;
  try {
    data = await getImportLanding(id);
  } catch {
    data = null;
  }

  const item = data?.data_imports_by_pk;
  if (!data || !item) {
    notFound();
  }
  if (item.status !== "committed") {
    redirect(`/import/${id}`);
  }

  return (
    <LandedStory
      activities={data.activities}
      healthCount={data.daily_health_metrics.length}
      bodyCount={data.body_measurements.length}
      duplicateCount={item.duplicate_count}
    />
  );
}

type LandingPayload = {
  data_imports_by_pk: {
    id: string;
    status: string;
    committed_count: number;
    duplicate_count: number;
    committed_at: string | null;
  } | null;
  activities: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
  }>;
  daily_health_metrics: Array<{ id: string }>;
  body_measurements: Array<{ id: string }>;
};

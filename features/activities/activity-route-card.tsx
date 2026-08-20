import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type RoutePoint = {
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  distanceM: number | null;
  recordedAt: string;
};

function buildPolyline(points: RoutePoint[]): string {
  if (points.length < 2) return "";

  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);

  return points
    .map((point) => {
      const x = ((point.longitude - minLng) / lngRange) * 100;
      const y = 100 - ((point.latitude - minLat) / latRange) * 100;
      return `${x},${y}`;
    })
    .join(" ");
}

export function ActivityRouteCard({ points }: { points: RoutePoint[] }) {
  if (points.length < 2) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Rutt</CardTitle>
        <CardDescription>
          Förenklad Garmin-rutt baserad på sparade trackpoints.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-[1.25rem] border border-white/45 bg-[linear-gradient(180deg,rgba(250,252,255,0.9),rgba(238,244,255,0.78))] p-3">
          <svg viewBox="0 0 100 100" className="aspect-[1.15/1] w-full">
            <defs>
              <linearGradient id="routeStroke" x1="0%" x2="100%" y1="0%" y2="100%">
                <stop offset="0%" stopColor="currentColor" />
                <stop offset="100%" stopColor="rgba(111,154,255,0.55)" />
              </linearGradient>
            </defs>
            <polyline
              points={buildPolyline(points)}
              fill="none"
              stroke="url(#routeStroke)"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            />
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

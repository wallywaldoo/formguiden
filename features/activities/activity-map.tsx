"use client";

import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";

import { downsample, toLatitude, toLongitude } from "@/lib/garmin/geo";
import { toFiniteNumber } from "@/lib/numbers";

type RoutePoint = {
  latitude: unknown;
  longitude: unknown;
};

function routeLatLngs(
  points: RoutePoint[],
): Array<[number, number]> {
  const latLngs: Array<[number, number]> = [];
  for (const point of points) {
    const latitude = toLatitude(toFiniteNumber(point.latitude));
    const longitude = toLongitude(toFiniteNumber(point.longitude));
    if (latitude == null || longitude == null) continue;
    latLngs.push([latitude, longitude]);
  }
  return downsample(latLngs, 800);
}

export function ActivityMap({ points }: { points: RoutePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const routeKey = points
    .map(
      (point) =>
        `${toFiniteNumber(point.latitude) ?? ""},${toFiniteNumber(point.longitude) ?? ""}`,
    )
    .join("|");
  const latLngs = useMemo(() => routeLatLngs(points), [routeKey]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || latLngs.length < 2) return;

    const marked = container as HTMLDivElement & { _leaflet_id?: number };
    if (marked._leaflet_id != null) {
      delete marked._leaflet_id;
      container.replaceChildren();
    }

    let map: import("leaflet").Map | null = null;
    let cancelled = false;

    async function renderMap() {
      const leaflet = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      map = leaflet.map(containerRef.current, {
        scrollWheelZoom: false,
        zoomControl: true,
        bounceAtZoomLimits: false,
      });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        })
        .addTo(map);

      const line = leaflet
        .polyline(latLngs, {
          color: "#2f6bff",
          weight: 5,
          opacity: 0.92,
          lineJoin: "round",
          lineCap: "round",
        })
        .addTo(map);

      leaflet
        .circleMarker(latLngs[0]!, {
          radius: 7,
          color: "#147a3a",
          fillColor: "#22c55e",
          fillOpacity: 1,
          weight: 2,
        })
        .addTo(map)
        .bindTooltip("Start");
      leaflet
        .circleMarker(latLngs[latLngs.length - 1]!, {
          radius: 7,
          color: "#9f1239",
          fillColor: "#fb7185",
          fillOpacity: 1,
          weight: 2,
        })
        .addTo(map)
        .bindTooltip("Mål");

      map.fitBounds(line.getBounds(), { padding: [28, 28] });
      const current = map;
      requestAnimationFrame(() => {
        current.invalidateSize();
        current.fitBounds(line.getBounds(), { padding: [28, 28] });
      });
    }

    void renderMap();

    return () => {
      cancelled = true;
      map?.remove();
      map = null;
    };
  }, [latLngs, routeKey]);

  if (latLngs.length < 2) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-[1.4rem] border border-white/50 bg-white/50 text-sm text-muted-foreground md:min-h-[22rem]">
        Ingen GPS-rutt finns för det här passet ännu.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="h-[16rem] w-full overflow-hidden rounded-[1.4rem] border border-white/45 bg-[#dfe8f5] md:h-[22rem]"
    />
  );
}

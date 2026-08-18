import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Formkurvan",
    short_name: "Formkurvan",
    description: "Kör. Dela. Formkurvan tar hand om resten.",
    start_url: "/overview",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1a1a1a",
    lang: "sv",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
    // Web Share Target is not in MetadataRoute.Manifest yet.
    ...({
      share_target: {
        action: "/share",
        method: "POST",
        enctype: "multipart/form-data",
        params: {
          files: [
            {
              name: "garmin",
              accept: [
                ".fit",
                ".gpx",
                ".tcx",
                ".csv",
                ".zip",
                "application/gpx+xml",
                "application/zip",
                "text/csv",
              ],
            },
          ],
        },
      },
    } as Record<string, unknown>),
  } as MetadataRoute.Manifest;
}

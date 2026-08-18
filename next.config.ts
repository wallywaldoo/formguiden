import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sql.js is an Emscripten bundle that loads its own WASM at runtime. Bundling
  // it breaks that lookup, so it stays external and is required from disk.
  serverExternalPackages: ["sql.js"],
  outputFileTracingIncludes: {
    // sql.js loads its WASM binary at runtime by resolving it from
    // node_modules. Tracing cannot see that, so the asset is listed here.
    // Without it, GarminDB imports fail in production but pass locally.
    "**": ["./node_modules/sql.js/dist/sql-wasm.wasm"],
  },
};

export default nextConfig;

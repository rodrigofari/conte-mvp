import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // GitHub Pages serves this project below /conte-mvp/; local development
  // and other hosts continue to serve from the domain root.
  base: process.env.GITHUB_ACTIONS ? "/conte-mvp/" : "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          map: ["maplibre-gl"],
          charts: ["recharts"],
          geo: ["@turf/turf"],
        },
      },
    },
  },
});

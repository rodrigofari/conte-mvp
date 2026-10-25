import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
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

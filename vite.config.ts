import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  // GitHub Pages hosts this project under /conte-mvp/.
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

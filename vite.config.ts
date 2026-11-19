import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Served from GitHub Pages at https://t34virus.github.io/job-tracker/
export default defineConfig({
  base: "/job-tracker/",
  plugins: [react()],
});

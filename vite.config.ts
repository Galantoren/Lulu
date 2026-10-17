import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the build works on GitHub Pages (/lulu/) or any other host.
export default defineConfig({
  base: "./",
  plugins: [react()],
});

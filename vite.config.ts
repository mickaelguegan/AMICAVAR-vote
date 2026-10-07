import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Chemins relatifs : le site fonctionne quelle que soit l'adresse GitHub Pages.
export default defineConfig({
  base: "./",
  plugins: [react()],
});

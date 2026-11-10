import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    host: true, // necessário para abrir de dentro do Docker
    port: 5173,
    watch: { usePolling: true }, // necessário para o Docker no Windows detectar mudanças
  },
});

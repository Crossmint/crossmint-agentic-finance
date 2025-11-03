import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  // Load env vars from the project root
  envDir: "..",
  resolve: {
    alias: {
      buffer: "buffer",
      process: "process",
    },
  },
  define: {
    global: "globalThis",
    "process.env": JSON.stringify({}),
  },
  optimizeDeps: {
    include: ["buffer", "process"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // three.js alone is ~700 kB minified and can't be split further
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Libraries change far less often than app code: separate chunks
        // stay cached in the browser across deploys
        // (three.js has no dependencies, so splitting it can't create an
        // import cycle; React-based libraries must stay in one chunk)
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (/node_modules\/three\//.test(id)) return "three";
          return "vendor";
        },
      },
    },
  },
});

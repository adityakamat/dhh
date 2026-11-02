import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so the same build works on the web and inside Capacitor's webview.
  base: "./",
  server: { port: 5173, host: "127.0.0.1" },
});

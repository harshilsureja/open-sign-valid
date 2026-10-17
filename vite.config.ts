import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    // Static site: everything runs in the browser, there is no server.
    tanstackStart({
      spa: { enabled: true, prerender: { outputPath: "/index.html" } },
    }),
    viteReact(),
  ],
})

export default config

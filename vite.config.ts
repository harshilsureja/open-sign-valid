import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// GitHub Pages serves the site from /<repo>/; CI sets BASE_PATH for that.
// Locally and on a custom domain it is "/".
const base = process.env.BASE_PATH ?? "/"

const config = defineConfig({
  base,
  resolve: { tsconfigPaths: true },
  plugins: [
    tailwindcss(),
    // Static site: the landing page is prerendered to real HTML (good for
    // search engines and link previews); everything else runs in the browser.
    tanstackStart({
      prerender: { enabled: true, crawlLinks: true },
    }),
    viteReact(),
  ],
})

export default config

// Finishes the static site in dist/client for GitHub Pages:
//   robots.txt + sitemap.xml  (absolute URLs from SITE_URL)
//   404.html                  (unknown paths load the app instead of GitHub's 404)
//   .nojekyll                 (serve files as-is, including ones starting with "_")
import { copyFileSync, existsSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const dist = join(import.meta.dirname, "..", "dist", "client")
const site = (process.env.VITE_SITE_URL ?? "https://harshilsureja.github.io/open-sign-valid").replace(
  /\/+$/,
  ""
)

if (!existsSync(join(dist, "index.html"))) {
  console.error("postbuild: dist/client/index.html not found — run vite build first")
  process.exit(1)
}

const today = new Date().toISOString().slice(0, 10)
writeFileSync(join(dist, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`)
writeFileSync(
  join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${site}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`
)
copyFileSync(join(dist, "index.html"), join(dist, "404.html"))
writeFileSync(join(dist, ".nojekyll"), "")
console.log(`postbuild: robots.txt, sitemap.xml, 404.html, .nojekyll for ${site}`)

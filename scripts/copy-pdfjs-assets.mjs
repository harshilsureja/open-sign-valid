// Copies pdf.js runtime assets (CMaps, standard fonts, ICC profiles, WASM
// decoders) into public/ so they are served locally — the app never loads
// anything from a CDN.
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const pdfjsRoot = dirname(require.resolve("pdfjs-dist/package.json"))
const target = join(import.meta.dirname, "..", "public", "pdfjs")

mkdirSync(target, { recursive: true })
for (const dir of ["cmaps", "standard_fonts", "iccs", "wasm"]) {
  const from = join(pdfjsRoot, dir)
  if (existsSync(from)) cpSync(from, join(target, dir), { recursive: true })
}
console.log("pdf.js assets copied to public/pdfjs")

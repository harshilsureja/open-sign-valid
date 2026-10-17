// Generates the social preview image and app icons into public/:
//   og-image.png          1200×630  link previews (WhatsApp, X, LinkedIn, Slack…)
//   apple-touch-icon.png  180×180   iOS home screen
//   icon-192.png, icon-512.png       PWA / Android
// Run: npm run images   (re-run after changing the design below)
import { writeFileSync } from "node:fs"
import { join } from "node:path"
import { Resvg } from "@resvg/resvg-js"

const out = join(import.meta.dirname, "..", "public")
const SITE = "harshilsureja.github.io/open-sign-valid"
const FONT = "Segoe UI, Arial, Helvetica, sans-serif"
const SERIF = "Times New Roman, Times, serif"

// Same shapes as src/components/brand.tsx (solid blue shield).
const shield = `
  <path d="M16 2.2 27 6.4v8.4c0 7-4.6 12.6-11 15-6.4-2.4-11-8-11-15V6.4L16 2.2Z" fill="#2563eb"/>
  <path d="M11 9.5h7l3 3V20a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V10.5a1 1 0 0 1 1-1Z" fill="#fff" opacity=".95"/>
  <path d="M18 9.5v3h3" fill="none" stroke="#c7d2fe" stroke-width="1"/>
  <path d="M12.3 13.4h4M12.3 15.4h2.6" stroke="#a5b4fc" stroke-width="1" stroke-linecap="round"/>
  <circle cx="20.5" cy="20.5" r="4.6" fill="#16a34a" stroke="#fff" stroke-width="1.4"/>
  <path d="m18.5 20.6 1.4 1.4 2.7-2.9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`

// Acrobat-style tick (same proportions as src/lib/stamp.ts).
const tick = (x, y, w, h) => {
  const p = (u, v) => `${x + u * w},${y + v * h}`
  const pts = [p(0, 0.6), p(0.13, 0.48), p(0.33, 0.7), p(0.86, 0), p(1, 0.11), p(0.34, 0.97)].join(" ")
  const e = Math.min(w, h) * 0.07
  return `<polygon points="${pts}" fill="#000" transform="translate(${e} ${e})"/>
          <polygon points="${pts}" fill="#22b33a" stroke="#000" stroke-width="${Math.min(w, h) * 0.024}" stroke-linejoin="round"/>`
}

const chip = (x, label) => {
  const w = label.length * 9.6 + 52
  return {
    w,
    svg: `<g transform="translate(${x} 470)">
      <rect width="${w}" height="44" rx="22" fill="#1e293b" stroke="#334155"/>
      <circle cx="22" cy="22" r="5" fill="#22c55e"/>
      <text x="36" y="29" font-family="${FONT}" font-size="19" fill="#e2e8f0">${label}</text>
    </g>`,
  }
}

function ogImage() {
  let x = 72
  const chips = ["No upload", "Works offline", "Open source"].map((label) => {
    const c = chip(x, label)
    x += c.w + 14
    return c.svg
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <radialGradient id="glow" cx="0.85" cy="0.2" r="0.7">
      <stop offset="0" stop-color="#1d4ed8" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#0b1020" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b1020"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <g transform="translate(72 64) scale(2.6)">${shield}</g>
  <text x="166" y="118" font-family="${FONT}" font-size="40" font-weight="700" fill="#fff">Open Sign Valid</text>

  <text x="72" y="250" font-family="${FONT}" font-size="66" font-weight="800" fill="#fff">Is your e-Aadhaar</text>
  <text x="72" y="330" font-family="${FONT}" font-size="66" font-weight="800" fill="#60a5fa">genuine?</text>
  <text x="72" y="392" font-family="${FONT}" font-size="27" fill="#cbd5e1">Verify the digital signature on e-Aadhaar and any</text>
  <text x="72" y="430" font-family="${FONT}" font-size="27" fill="#cbd5e1">signed PDF — free, private, right in your browser.</text>
  ${chips.join("\n  ")}
  <text x="72" y="580" font-family="${FONT}" font-size="22" fill="#94a3b8">${SITE}</text>

  <g transform="translate(770 180) rotate(-4)">
    <rect x="0" y="0" width="360" height="230" rx="18" fill="#000" opacity="0.35" transform="translate(10 14)"/>
    <rect x="0" y="0" width="360" height="230" rx="18" fill="#fff"/>
    ${tick(140, 46, 140, 160)}
    <text x="24" y="70" font-family="Arial, Helvetica, sans-serif" font-size="40" fill="#000">Signature valid</text>
    <text x="24" y="112" font-family="${SERIF}" font-size="19" fill="#000">Digitally signed by DS Unique</text>
    <text x="24" y="136" font-family="${SERIF}" font-size="19" fill="#000">Identification Authority of India</text>
    <text x="24" y="160" font-family="${SERIF}" font-size="19" fill="#000">Date: 2026.07.25 11:19:18 IST</text>
  </g>
</svg>`
}

/** Square icon: blue shield on white with padding (safe for maskable crops). */
function icon(size) {
  const s = (size * 0.72) / 32
  const o = (size - 32 * s) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  <g transform="translate(${o} ${o}) scale(${s})">${shield}</g>
</svg>`
}

function render(svg, file, width) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    font: { loadSystemFonts: true, defaultFontFamily: "Arial" },
  })
    .render()
    .asPng()
  writeFileSync(join(out, file), png)
  console.log(`${file}  ${(png.length / 1024).toFixed(1)} KB`)
}

render(ogImage(), "og-image.png", 1200)
render(icon(180), "apple-touch-icon.png", 180)
render(icon(192), "icon-192.png", 192)
render(icon(512), "icon-512.png", 512)

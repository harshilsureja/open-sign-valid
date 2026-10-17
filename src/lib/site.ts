/**
 * Public site location, used for canonical URLs and social previews (which
 * need absolute links). Defaults to the GitHub Pages address; set
 * VITE_SITE_URL at build time for a custom domain.
 */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL ?? "https://harshilsureja.github.io/open-sign-valid"
).replace(/\/+$/, "")

/** Path to a file in public/, respecting Vite's base (e.g. /open-sign-valid/). */
export const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`

export const SEO = {
  title: "Open Sign Valid — Verify e-Aadhaar & PDF Digital Signatures Online",
  description:
    "Check if your e-Aadhaar or any digitally signed PDF is genuine. Free, private and open source — verification runs in your browser and your file is never uploaded.",
  keywords: [
    "verify aadhaar signature",
    "e-aadhaar signature validation",
    "aadhaar signature not verified",
    "check e-aadhaar genuine",
    "pdf digital signature verification",
    "verify signed pdf online",
    "uidai digital signature",
    "cca india certificate",
  ].join(", "),
  image: `${SITE_URL}/og-image.png`,
  imageAlt:
    "Open Sign Valid — Is your e-Aadhaar genuine? A signature box showing a green tick and “Signature valid”.",
}

import type { PDFDocumentProxy } from "pdfjs-dist"
import type { PageOverlay } from "@/components/pdf-viewer"
import { drawStamp } from "@/lib/stamp"

const PRINT_DPI = 300

/**
 * Print the document exactly as signed. Pages are rendered locally at
 * 300 DPI (sharp text and scannable QR codes), shown only to the printer,
 * then thrown away. The verification stamp seen on screen is printed too;
 * the PDF file itself is not changed.
 */
export async function printDocument(
  doc: PDFDocumentProxy,
  overlays: PageOverlay[],
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const root = document.createElement("div")
  root.id = "print-root"
  const urls: string[] = []

  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const base = page.getViewport({ scale: 1 })
      const viewport = page.getViewport({ scale: PRINT_DPI / 72 })
      const canvas = document.createElement("canvas")
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      await page.render({ canvas, viewport, intent: "print" }).promise
      const ctx = canvas.getContext("2d")
      for (const o of overlays.filter((o) => o.layered && o.pageIndex === i - 1)) {
        const [x1, y1] = viewport.convertToViewportPoint(o.rect[0], o.rect[1])
        const [x2, y2] = viewport.convertToViewportPoint(o.rect[2], o.rect[3])
        if (ctx) drawStamp(ctx, Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1), o.stamp)
      }

      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("render failed"))), "image/png"),
      )
      const url = URL.createObjectURL(blob)
      urls.push(url)
      canvas.width = canvas.height = 0

      const sheet = document.createElement("div")
      sheet.className = "print-page"
      const img = document.createElement("img")
      img.src = url
      img.alt = `Page ${i}`
      // Physical size in inches keeps the original page scale (100%); the
      // print CSS shrinks it (aspect kept) only if the printer adds margins.
      img.style.width = `${base.width / 72}in`
      img.style.height = `${base.height / 72}in`
      sheet.append(img)
      root.append(sheet)
      onProgress?.(i, doc.numPages)
    }

    document.body.append(root)
    await Promise.all(
      Array.from(root.querySelectorAll("img"), (img) => img.decode().catch(() => undefined)),
    )
    await new Promise<void>((resolve) => {
      const events = ["afterprint", "pointermove", "keydown"] as const
      const done = () => {
        events.forEach((e) => window.removeEventListener(e, done))
        resolve()
      }
      window.addEventListener("afterprint", done)
      window.print()
      // afterprint is the normal signal; user input is a fallback for
      // browsers that don't fire it.
      setTimeout(() => {
        window.addEventListener("pointermove", done)
        window.addEventListener("keydown", done)
      }, 500)
    })
  } finally {
    root.remove()
    urls.forEach((u) => URL.revokeObjectURL(u))
  }
}

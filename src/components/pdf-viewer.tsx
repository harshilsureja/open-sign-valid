import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist"
import { StatusBadge } from "@/components/status"
import { drawStamp, type StampInfo } from "@/lib/stamp"
import { cn } from "@/lib/utils"
import type { SignatureStatus } from "@/lib/verify"

/** 1 PDF point = 1/72 in; CSS assumes 96 px/in. 100% zoom = real paper size. */
export const PDF_TO_CSS = 96 / 72
/** Keep canvases under ~16 MP so mobile browsers don't drop them. */
const MAX_CANVAS_PIXELS = 16_777_216

export interface PageOverlay {
  pageIndex: number
  rect: [number, number, number, number]
  status: SignatureStatus
  signatureIndex: number
  label: string
  stamp: StampInfo
  /** Signature box has Acrobat-style layers we can redraw (else badge only) */
  layered: boolean
}

/** Rectangle of a PDF-space rect in viewport (CSS px) coordinates. */
function viewportBox(viewport: { convertToViewportPoint(x: number, y: number): number[] }, rect: PageOverlay["rect"]) {
  const [x1, y1] = viewport.convertToViewportPoint(rect[0], rect[1])
  const [x2, y2] = viewport.convertToViewportPoint(rect[2], rect[3])
  return { left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
}

interface PageSize {
  width: number
  height: number
}

export function usePageSizes(doc: PDFDocumentProxy | null): PageSize[] {
  const [sizes, setSizes] = useState<PageSize[]>([])
  useEffect(() => {
    if (!doc) return setSizes([])
    let cancelled = false
    ;(async () => {
      const list: PageSize[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const vp = (await doc.getPage(i)).getViewport({ scale: 1 })
        list.push({ width: vp.width, height: vp.height })
      }
      if (!cancelled) setSizes(list)
    })()
    return () => {
      cancelled = true
    }
  }, [doc])
  return sizes
}

/** Current devicePixelRatio; updates on browser zoom or moving to another screen. */
function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() =>
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  )
  useEffect(() => {
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`)
    const update = () => setDpr(window.devicePixelRatio || 1)
    mq.addEventListener("change", update)
    return () => mq.removeEventListener("change", update)
  }, [dpr])
  return dpr
}

export function PdfViewer({
  doc,
  sizes,
  scale,
  overlays,
  activeSignature,
  onOverlayClick,
}: {
  doc: PDFDocumentProxy
  sizes: PageSize[]
  /** 1 = actual size */
  scale: number
  overlays: PageOverlay[]
  activeSignature?: number
  onOverlayClick?: (signatureIndex: number) => void
}) {
  return (
    // w-max lets pages wider than the panel scroll instead of being cut off.
    <div className="flex w-max min-w-full flex-col items-center gap-4 p-4 sm:p-6">
      {sizes.map((size, i) => (
        <PdfPage
          key={i}
          doc={doc}
          pageIndex={i}
          size={size}
          scale={scale}
          overlays={overlays.filter((o) => o.pageIndex === i)}
          activeSignature={activeSignature}
          onOverlayClick={onOverlayClick}
        />
      ))}
    </div>
  )
}

function PdfPage({
  doc,
  pageIndex,
  size,
  scale,
  overlays,
  activeSignature,
  onOverlayClick,
}: {
  doc: PDFDocumentProxy
  pageIndex: number
  size: PageSize
  scale: number
  overlays: PageOverlay[]
  activeSignature?: number
  onOverlayClick?: (signatureIndex: number) => void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const dpr = useDevicePixelRatio()
  const cssScale = scale * PDF_TO_CSS
  // Size the page in whole *device* pixels and give the canvas exactly that
  // many pixels, so the browser never stretches it by a fraction of a pixel
  // (which makes text look blurry, especially on 125%/150% Windows scaling).
  const pixelRatio = Math.min(
    dpr,
    Math.sqrt(MAX_CANVAS_PIXELS / (size.width * cssScale * size.height * cssScale))
  )
  const deviceW = Math.max(1, Math.round(size.width * cssScale * pixelRatio))
  const deviceH = Math.max(1, Math.round(size.height * cssScale * pixelRatio))
  const width = deviceW / pixelRatio
  const height = deviceH / pixelRatio
  const overlayKey = JSON.stringify(overlays)

  useEffect(() => {
    const el = holder.current
    if (!el) return
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: "150% 0px",
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!visible || page) return
    let cancelled = false
    doc.getPage(pageIndex + 1).then((p) => !cancelled && setPage(p))
    return () => {
      cancelled = true
    }
  }, [visible, page, doc, pageIndex])

  // Render into a fresh canvas and swap it in when finished, so zooming
  // never shows a blank page.
  useLayoutEffect(() => {
    if (!visible || !page || !holder.current) return
    const viewport = page.getViewport({ scale: cssScale })
    const sx = deviceW / viewport.width
    const sy = deviceH / viewport.height
    const canvas = document.createElement("canvas")
    canvas.width = deviceW
    canvas.height = deviceH
    canvas.className = "absolute inset-0 size-full"
    let task: RenderTask | null = page.render({
      canvas,
      viewport,
      transform: [sx, 0, 0, sy, 0, 0],
    })
    task.promise
      .then(() => {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.setTransform(sx, 0, 0, sy, 0, 0)
          for (const o of overlays.filter((o) => o.layered)) {
            const b = viewportBox(viewport, o.rect)
            drawStamp(ctx, b.left, b.top, b.width, b.height, o.stamp)
          }
        }
        const host = holder.current?.querySelector("[data-canvas-host]")
        if (!host) return
        host.replaceChildren(canvas)
        task = null
      })
      .catch(() => undefined)
    return () => task?.cancel()
    // overlays are compared by value through overlayKey
  }, [visible, page, cssScale, deviceW, deviceH, overlayKey])

  return (
    <div
      ref={holder}
      className="relative shrink-0 bg-white shadow-md ring-1 ring-black/5"
      style={{ width, height }}
      aria-label={`Page ${pageIndex + 1}`}
    >
      <div data-canvas-host className="absolute inset-0" />
      {page &&
        overlays.map((o, i) => {
          const b = viewportBox(page.getViewport({ scale: cssScale }), o.rect)
          const active = activeSignature === o.signatureIndex
          return (
            <button
              key={i}
              type="button"
              title={o.label}
              onClick={() => onOverlayClick?.(o.signatureIndex)}
              className={cn(
                "absolute cursor-pointer rounded-sm ring-0 transition-shadow outline-none hover:ring-2 focus-visible:ring-2",
                {
                  valid: "ring-emerald-500/70",
                  unknown: "ring-amber-500/70",
                  invalid: "ring-red-500/70",
                }[o.status],
                active && "ring-2"
              )}
              style={b}
            >
              {!o.layered && (
                <span className="absolute -top-3 -left-3">
                  <StatusBadge status={o.status} />
                </span>
              )}
              <span className="sr-only">{o.label}</span>
            </button>
          )
        })}
      {!page && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
          Loading page {pageIndex + 1}…
        </div>
      )}
    </div>
  )
}

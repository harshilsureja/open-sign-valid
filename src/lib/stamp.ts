import type { SignatureStatus } from "@/lib/verify"

/**
 * Acrobat-style verification result for a *layered* signature appearance
 * (see lib/appearance.ts). The signed layers (background and the
 * "Digitally signed by … Date: …" text) are rendered from the PDF exactly
 * as signed; we only paint what Adobe paints itself:
 *  - the status title in the top band, where the n4 layer was
 *  - the validity icon in the centred square, where the n1 layer was
 * Nothing here is written into the PDF — it exists on screen and on paper.
 */
export interface StampInfo {
  status: SignatureStatus
}

const MARK_COLORS: Record<SignatureStatus, string> = {
  valid: "#22b33a",
  unknown: "#f3e55a",
  invalid: "#ee1c24",
}

const TITLES: Record<SignatureStatus, string> = {
  valid: "Signature valid",
  unknown: "Signature Not Verified",
  invalid: "Signature invalid",
}

const FONT = "Helvetica, Arial, sans-serif"
const DETAIL_FONT = '"Times New Roman", Times, serif'

/** iText layout: the title band is the top 30% of the box. */
const TOP_SECTION = 0.3

/**
 * Paint icon + title into the signature box (x, y, w, h) of an already
 * rendered page, in the context's current units.
 */
export function drawStamp(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  info: StampInfo
) {
  if (w < 4 || h < 4) return
  ctx.save()

  // Icon: centred square, 90% of the shorter side (iText's n1 placement).
  // "multiply" keeps the signed text visible on top of it, as in Acrobat
  // where the icon layer is drawn underneath the text layer.
  const side = 0.9 * Math.min(w, h)
  const aspect = { valid: 0.85, invalid: 0.78, unknown: 0.62 }[info.status]
  const markW = side * aspect
  // Draw the finished icon off-screen first, so its fill covers its own
  // shadow, then blend the whole icon onto the page in one step.
  const scale = Math.hypot(ctx.getTransform().a, ctx.getTransform().b) || 1
  const pad = side * 0.1 // room for the drop shadow
  const boxW = markW + pad * 2
  const boxH = side + pad * 2
  const off = document.createElement("canvas")
  off.width = Math.max(1, Math.ceil(boxW * scale))
  off.height = Math.max(1, Math.ceil(boxH * scale))
  const octx = off.getContext("2d")
  if (octx) {
    octx.scale(off.width / boxW, off.height / boxH)
    drawMark(octx, pad, pad, markW, side, info.status)
    ctx.globalCompositeOperation = "multiply"
    ctx.drawImage(off, x + (w - markW) / 2 - pad, y + (h - side) / 2 - pad, boxW, boxH)
    ctx.globalCompositeOperation = "source-over"
  }

  // Title in the top band (iText's n4 placement), sized to fit.
  const margin = h * 0.03
  const bandH = h * TOP_SECTION
  const title = TITLES[info.status]
  ctx.font = `100px ${FONT}`
  const size = Math.min((100 * (w - 2 * margin)) / ctx.measureText(title).width, bandH * 0.8)
  ctx.font = `${size}px ${FONT}`
  ctx.fillStyle = "#000000"
  ctx.textAlign = "start"
  ctx.textBaseline = "alphabetic"
  ctx.fillText(title, x + margin, y + margin + (bandH - margin) * 0.5 + size * 0.35)
  ctx.restore()
}

/**
 * Big validity mark in a (w × h) box: green tick, yellow "?" or red cross,
 * each with a thin black outline and a black drop shadow to the lower
 * right, like Acrobat's.
 */
function drawMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  status: SignatureStatus
) {
  const p = (u: number, v: number) => [x + u * w, y + v * h] as const
  const edge = Math.max(1, Math.min(w, h) * 0.07)
  const outline = Math.max(0.5, Math.min(w, h) * 0.012)

  const shape = (): void => {
    ctx.beginPath()
    if (status === "valid") {
      // Short left arm, long right arm rising to the top-right.
      const pts = [
        p(0.0, 0.6),
        p(0.13, 0.48),
        p(0.33, 0.7),
        p(0.86, 0.0),
        p(1.0, 0.11),
        p(0.34, 0.97),
      ]
      ctx.moveTo(...pts[0])
      for (const pt of pts.slice(1)) ctx.lineTo(...pt)
      ctx.closePath()
    } else if (status === "invalid") {
      // Two square-ended bars, half-thickness 11% of the width.
      const half = 0.11 * w
      for (const [a, b, c, d] of [
        [0.1, 0.06, 0.9, 0.94],
        [0.9, 0.06, 0.1, 0.94],
      ]) {
        const dx = (c - a) * w
        const dy = (d - b) * h
        const len = Math.hypot(dx, dy)
        const nx = ((-dy / len) * half) / w
        const ny = ((dx / len) * half) / h
        ctx.moveTo(...p(a + nx, b + ny))
        ctx.lineTo(...p(c + nx, d + ny))
        ctx.lineTo(...p(c - nx, d - ny))
        ctx.lineTo(...p(a - nx, b - ny))
        ctx.closePath()
      }
    }
  }

  ctx.lineJoin = "miter"
  if (status === "unknown") {
    ctx.font = `bold ${h * 1.15}px ${DETAIL_FONT}`
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    const cx = x + w / 2
    const cy = y + h * 0.55
    ctx.fillStyle = "#000000"
    ctx.fillText("?", cx + edge, cy + edge)
    ctx.lineWidth = outline * 2
    ctx.strokeStyle = "#000000"
    ctx.strokeText("?", cx, cy)
    ctx.fillStyle = MARK_COLORS[status]
    ctx.fillText("?", cx, cy)
    ctx.textAlign = "start"
    return
  }

  // Drop edge, then black outline, then colour fill.
  ctx.save()
  ctx.translate(edge, edge)
  shape()
  ctx.fillStyle = "#000000"
  ctx.fill()
  ctx.restore()

  shape()
  ctx.lineWidth = outline * 2
  ctx.strokeStyle = "#000000"
  ctx.stroke()
  ctx.fillStyle = MARK_COLORS[status]
  ctx.fill()
}

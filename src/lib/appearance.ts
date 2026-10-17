/**
 * Acrobat-style layered signature appearances.
 *
 * Signers such as UIDAI (e-Aadhaar, made with iText) draw the signature box
 * as a form XObject "FRM" made of layers:
 *   n0 background · n1 validity icon ("?") · n2 the signed text
 *   ("Digitally signed by … Date: …") · n3 invalid icon · n4 status title
 *   ("Signature Not Verified").
 * Adobe Reader keeps n0/n2 exactly as signed and only swaps the icon and the
 * title for its verification result. We do the same: for *display only* we
 * build a copy of the PDF in memory where n1, n3 and n4 are empty, then draw
 * our own icon and title in their place. The original bytes (the ones that
 * are verified, and that the user keeps) are never touched.
 */
import { objectBody } from "@/lib/verify/pdf-parse"

interface Ref {
  num: number
  gen: number
}

const refIn = (text: string, name: string): Ref | undefined => {
  const m = new RegExp(`/${name}\\s+(\\d+)\\s+(\\d+)\\s+R`).exec(text)
  return m ? { num: Number(m[1]), gen: Number(m[2]) } : undefined
}

/** Text of an object's dictionary (everything before its stream data). */
function dictOf(raw: string, num: number): string | undefined {
  const body = objectBody(raw, num)
  if (!body) return undefined
  const s = body.indexOf("stream")
  return s === -1 ? body : body.slice(0, s)
}

/** Resolve a /Resources entry that may be inline or an indirect object. */
function resourcesOf(raw: string, dict: string): string {
  const indirect = /\/Resources\s+(\d+)\s+\d+\s+R/.exec(dict)
  return indirect ? (dictOf(raw, Number(indirect[1])) ?? "") : dict
}

interface LayerSet {
  /** Objects whose /XObject resources list the n0–n4 layers */
  container: number
  /** Icon + title layers to blank out for display */
  hide: Ref[]
}

/** Every layer set in the file: resources listing /n2 together with /n1 or /n4. */
export function findLayerSets(raw: string): LayerSet[] {
  const sets = new Map<number, LayerSet>()
  for (const m of raw.matchAll(/\/n2\s+\d+\s+\d+\s+R/g)) {
    const before = raw.slice(Math.max(0, m.index - 4096), m.index)
    const headers = [...before.matchAll(/(\d+)\s+\d+\s+obj\b/g)]
    const header = headers.at(-1)
    if (!header) continue
    const container = Number(header[1])
    if (sets.has(container)) continue
    const dict = dictOf(raw, container) ?? ""
    const hide = ["n1", "n3", "n4"].flatMap((n) => refIn(dict, n) ?? [])
    if (hide.length && (refIn(dict, "n1") || refIn(dict, "n4"))) {
      sets.set(container, { container, hide })
    }
  }
  return [...sets.values()]
}

/**
 * True when this widget annotation (by object number) draws a layered
 * appearance: /AP /N → /FRM → layers.
 */
export function widgetIsLayered(raw: string, widgetObj: number, sets: LayerSet[]): boolean {
  const widget = dictOf(raw, widgetObj)
  if (!widget) return false
  let ap = /\/AP\s*<<([\s\S]*?)>>/.exec(widget)?.[1]
  const apRef = refIn(widget, "AP")
  if (!ap && apRef) ap = dictOf(raw, apRef.num)
  const normal = ap && refIn(ap, "N")
  if (!normal) return false
  const nDict = dictOf(raw, normal.num)
  if (!nDict) return false
  const frm = refIn(resourcesOf(raw, nDict), "FRM")
  const candidates = [normal.num, frm?.num].filter((n): n is number => n != null)
  return candidates.some((c) => {
    const d = dictOf(raw, c)
    const res = d ? resourcesOf(raw, d) : ""
    return sets.some(
      (s) => s.container === c || new RegExp(`/XObject\\s+${s.container}\\s+\\d+\\s+R`).test(res)
    )
  })
}

/**
 * A display-only copy of the PDF with the given layers replaced by empty
 * streams, appended as an incremental update. Returns null if the file's
 * trailer can't be read safely (then the original is shown unchanged).
 */
export function hideLayers(bytes: Uint8Array, raw: string, refs: Ref[]): Uint8Array | null {
  if (!refs.length) return null
  const last = [...raw.matchAll(/startxref\s+(\d+)/g)].at(-1)
  if (!last) return null
  const prev = Number(last[1])

  // Trailer keys live after "trailer" (classic xref) or in the xref stream dict.
  const at = raw.slice(prev, prev + 32).trimStart()
  let trailer: string
  if (at.startsWith("xref")) {
    const t = raw.indexOf("trailer", prev)
    if (t === -1) return null
    trailer = raw.slice(t, raw.indexOf("startxref", t))
  } else {
    const s = raw.indexOf("stream", prev)
    if (s === -1) return null
    trailer = raw.slice(prev, s)
  }
  const size = /\/Size\s+(\d+)/.exec(trailer)?.[1]
  const root = /\/Root\s+\d+\s+\d+\s+R/.exec(trailer)?.[0]
  if (!size || !root) return null
  if (/\/Encrypt\s*<</.test(trailer)) return null // inline encryption dict: not supported
  const info = /\/Info\s+\d+\s+\d+\s+R/.exec(trailer)?.[0] ?? ""
  const encrypt = /\/Encrypt\s+\d+\s+\d+\s+R/.exec(trailer)?.[0] ?? ""
  const id = /\/ID\s*\[[^\]]*\]/.exec(trailer)?.[0] ?? ""

  const unique = [...new Map(refs.map((r) => [r.num, r])).values()].sort((a, b) => a.num - b.num)
  let body = "\n"
  const offsets = new Map<number, number>()
  for (const r of unique) {
    offsets.set(r.num, bytes.length + body.length)
    body += `${r.num} ${r.gen} obj\n<< /Length 0 >>\nstream\nendstream\nendobj\n`
  }
  const xrefAt = bytes.length + body.length
  body += "xref\n"
  for (const r of unique) {
    body += `${r.num} 1\n${String(offsets.get(r.num)).padStart(10, "0")} ${String(r.gen).padStart(5, "0")} n\r\n`
  }
  body += `trailer\n<< /Size ${size} ${root} ${info} ${encrypt} ${id} /Prev ${prev} >>\nstartxref\n${xrefAt}\n%%EOF\n`

  const tail = Uint8Array.from(body, (c) => c.charCodeAt(0))
  const out = new Uint8Array(bytes.length + tail.length)
  out.set(bytes)
  out.set(tail, bytes.length)
  return out
}

/** Bytes to render: the original with icon/title layers blanked, if any. */
export function displayCopy(bytes: Uint8Array, raw: string): Uint8Array {
  const sets = findLayerSets(raw)
  return hideLayers(bytes, raw, sets.flatMap((s) => s.hide)) ?? bytes
}

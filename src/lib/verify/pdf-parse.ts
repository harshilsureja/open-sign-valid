/**
 * Low-level PDF scanning for signature dictionaries.
 *
 * We deliberately work on the raw bytes instead of a full PDF parser: the
 * signature covers raw byte ranges, and the /Contents value of a signature
 * dictionary is never encrypted, so this also works for password-protected
 * PDFs (like e-Aadhaar) without needing the password.
 */

// "latin1" maps every byte to exactly one UTF-16 code unit, so string
// offsets equal byte offsets.
const binaryDecoder = new TextDecoder("latin1")

export function toBinaryString(bytes: Uint8Array): string {
  return binaryDecoder.decode(bytes)
}

export interface SigDictInfo {
  subFilter?: string
  filter?: string
  name?: string
  reason?: string
  location?: string
  contactInfo?: string
  /** Raw /M value, e.g. "D:20240101120000+05'30'" */
  m?: string
}

export interface RawSignature {
  byteRange: [number, number, number, number]
  /** DER-encoded CMS / PKCS#7 blob, or null when malformed */
  contents: Uint8Array | null
  objectNumber?: number
  dict: SigDictInfo
  error?: string
}

const BYTE_RANGE_RE = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/g
const OBJ_HEADER_RE = /(\d+)\s+(\d+)\s+obj\b/g

export function isEncrypted(raw: string): boolean {
  return /\/Encrypt\s*(?:\d+\s+\d+\s+R|<<)/.test(raw)
}

export function findSignatures(bytes: Uint8Array, raw = toBinaryString(bytes)): RawSignature[] {
  const encrypted = isEncrypted(raw)
  const seen = new Set<string>()
  const result: RawSignature[] = []

  for (const match of raw.matchAll(BYTE_RANGE_RE)) {
    const byteRange = match.slice(1, 5).map(Number) as RawSignature["byteRange"]
    const key = byteRange.join(",")
    if (seen.has(key)) continue
    seen.add(key)

    const [a, b, c, d] = byteRange
    const objectNumber = findObjectNumber(raw, match.index)
    const sig: RawSignature = { byteRange, contents: null, objectNumber, dict: {} }
    result.push(sig)

    if (a !== 0 || b <= 0 || c <= a + b || d < 0 || c + d > bytes.length) {
      sig.error = "The signature's byte range is malformed."
      continue
    }

    const dictEnd = raw.indexOf("endobj", c)
    const dictStart = objectStartBefore(raw, match.index)
    const dictText =
      raw.slice(dictStart, a + b) + raw.slice(c, dictEnd === -1 ? c + 4096 : dictEnd)
    sig.dict = parseSigDict(dictText, encrypted)

    const hole = raw.slice(a + b, c).trim()
    if (!hole.startsWith("<") || !hole.endsWith(">")) {
      sig.error = "The signature value is missing or not a hex string."
      continue
    }
    try {
      sig.contents = trimDer(hexToBytes(hole.slice(1, -1)))
    } catch {
      sig.error = "The signature value could not be decoded."
    }
  }

  return result
}

function findObjectNumber(raw: string, index: number): number | undefined {
  const windowStart = Math.max(0, index - 8192)
  let last: RegExpMatchArray | undefined
  for (const m of raw.slice(windowStart, index).matchAll(OBJ_HEADER_RE)) last = m
  return last ? Number(last[1]) : undefined
}

function objectStartBefore(raw: string, index: number): number {
  const windowStart = Math.max(0, index - 8192)
  let lastIndex = windowStart
  for (const m of raw.slice(windowStart, index).matchAll(OBJ_HEADER_RE)) {
    lastIndex = windowStart + m.index
  }
  return lastIndex
}

function parseSigDict(text: string, encrypted: boolean): SigDictInfo {
  const info: SigDictInfo = {
    subFilter: /\/SubFilter\s*\/([^\s/<>[\]()]+)/.exec(text)?.[1],
    filter: /\/Filter\s*\/([^\s/<>[\]()]+)/.exec(text)?.[1],
  }
  // String values are encrypted in password-protected files; skip them.
  if (encrypted) return info
  info.name = readStringValue(text, "Name")
  info.reason = readStringValue(text, "Reason")
  info.location = readStringValue(text, "Location")
  info.contactInfo = readStringValue(text, "ContactInfo")
  info.m = readStringValue(text, "M")
  return info
}

function readStringValue(text: string, key: string): string | undefined {
  const re = new RegExp(`/${key}\\s*([(<])`)
  const m = re.exec(text)
  if (!m) return undefined
  const start = m.index + m[0].length - 1
  const bytes = text[start] === "(" ? readLiteral(text, start) : readHex(text, start)
  if (!bytes) return undefined
  const value = decodePdfText(bytes).trim()
  return value || undefined
}

function readLiteral(text: string, start: number): number[] | null {
  const out: number[] = []
  let depth = 0
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (ch === "\\") {
      const next = text[++i]
      const escapes: Record<string, number> = { n: 10, r: 13, t: 9, b: 8, f: 12 }
      if (next in escapes) out.push(escapes[next])
      else if (/[0-7]/.test(next)) {
        let oct = next
        while (oct.length < 3 && /[0-7]/.test(text[i + 1])) oct += text[++i]
        out.push(parseInt(oct, 8) & 0xff)
      } else if (next === "\r" || next === "\n") {
        if (next === "\r" && text[i + 1] === "\n") i++
      } else out.push(next.charCodeAt(0))
      continue
    }
    if (ch === "(") {
      if (depth++ === 0) continue
    } else if (ch === ")") {
      if (--depth === 0) return out
    }
    out.push(ch.charCodeAt(0) & 0xff)
  }
  return null
}

function readHex(text: string, start: number): number[] | null {
  const end = text.indexOf(">", start)
  if (end === -1) return null
  return Array.from(hexToBytes(text.slice(start + 1, end)))
}

function decodePdfText(bytes: number[]): string {
  const arr = Uint8Array.from(bytes)
  if (arr[0] === 0xfe && arr[1] === 0xff) return new TextDecoder("utf-16be").decode(arr.subarray(2))
  if (arr[0] === 0xef && arr[1] === 0xbb && arr[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(arr.subarray(3))
  }
  return binaryDecoder.decode(arr)
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "")
  if (/[^0-9a-fA-F]/.test(clean)) throw new Error("invalid hex")
  const padded = clean.length % 2 ? clean + "0" : clean
  const out = new Uint8Array(padded.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(padded.substr(i * 2, 2), 16)
  return out
}

/** Signature placeholders are zero-padded; cut the blob to its DER length. */
function trimDer(bytes: Uint8Array): Uint8Array {
  if (bytes[0] !== 0x30) throw new Error("not a DER sequence")
  const first = bytes[1]
  if (first === 0x80) return bytes // indefinite-length BER, let the ASN.1 parser decide
  if (first < 0x80) return bytes.subarray(0, 2 + first)
  const n = first & 0x7f
  let len = 0
  for (let i = 0; i < n; i++) len = len * 256 + bytes[2 + i]
  const total = 2 + n + len
  if (total > bytes.length) throw new Error("truncated DER")
  return bytes.subarray(0, total)
}

/** Parse a PDF date string ("D:YYYYMMDDHHmmSSOHH'mm'") */
export function parsePdfDate(value: string | undefined): Date | undefined {
  if (!value) return undefined
  const m = /^D?:?(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?([Zz+-])?(\d{2})?'?(\d{2})?'?/.exec(
    value.trim(),
  )
  if (!m) return undefined
  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00", tz, tzh = "00", tzm = "00"] = m
  let utc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  if (tz === "+" || tz === "-") {
    const offset = (+tzh * 60 + +tzm) * 60_000
    utc += tz === "+" ? -offset : offset
  }
  const date = new Date(utc)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Given a widget annotation's object number, find the object number of the
 * signature dictionary it points to via /V (directly or through /Parent).
 */
export function signatureObjectForWidget(raw: string, widgetObj: number): number | undefined {
  for (let hop = 0, obj = widgetObj; hop < 3; hop++) {
    const body = objectBody(raw, obj)
    if (!body) return undefined
    const v = /\/V\s+(\d+)\s+\d+\s+R/.exec(body)
    if (v) return Number(v[1])
    const parent = /\/Parent\s+(\d+)\s+\d+\s+R/.exec(body)
    if (!parent) return undefined
    obj = Number(parent[1])
  }
  return undefined
}

/** Body of the newest definition of object `obj` (between "obj" and "endobj"). */
export function objectBody(raw: string, obj: number): string | undefined {
  const re = new RegExp(`(?:^|[^0-9])${obj}\\s+\\d+\\s+obj\\b`, "g")
  let start = -1
  for (const m of raw.matchAll(re)) start = m.index + m[0].length
  if (start === -1) return undefined
  const end = raw.indexOf("endobj", start)
  return raw.slice(start, end === -1 ? start + 4096 : end)
}

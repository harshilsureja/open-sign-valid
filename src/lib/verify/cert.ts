import * as asn1js from "asn1js"
import * as pkijs from "pkijs"
import type { CertInfo } from "./types"

const DN_LABELS: Record<string, string> = {
  "2.5.4.3": "CN",
  "2.5.4.5": "SERIALNUMBER",
  "2.5.4.6": "C",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.9": "STREET",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.12": "T",
  "2.5.4.17": "PostalCode",
  "2.5.4.65": "Pseudonym",
  "1.2.840.113549.1.9.1": "E",
}

function attrs(name: pkijs.RelativeDistinguishedNames): Array<[string, string]> {
  return name.typesAndValues.map((tv) => [
    DN_LABELS[tv.type] ?? tv.type,
    String(tv.value.valueBlock.value ?? ""),
  ])
}

function get(list: Array<[string, string]>, key: string): string | undefined {
  return list.find(([k]) => k === key)?.[1]
}

export function formatDn(name: pkijs.RelativeDistinguishedNames): string {
  return attrs(name)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")
}

export function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function certDer(cert: pkijs.Certificate): Uint8Array {
  return new Uint8Array(cert.toSchema(true).toBER(false))
}

export async function certInfo(cert: pkijs.Certificate): Promise<CertInfo> {
  const subject = attrs(cert.subject)
  const issuer = attrs(cert.issuer)
  const der = certDer(cert)
  const digest = await crypto.subtle.digest("SHA-256", der as BufferSource)
  return {
    der,
    commonName: get(subject, "CN"),
    organization: get(subject, "O"),
    organizationalUnit: get(subject, "OU"),
    country: get(subject, "C"),
    state: get(subject, "ST"),
    locality: get(subject, "L"),
    email: get(subject, "E"),
    subject: formatDn(cert.subject),
    issuer: formatDn(cert.issuer),
    issuerCommonName: get(issuer, "CN"),
    serialNumber: toHex(cert.serialNumber.valueBlock.valueHexView).toUpperCase(),
    notBefore: cert.notBefore.value,
    notAfter: cert.notAfter.value,
    sha256: toHex(digest).toUpperCase(),
    selfSigned: cert.subject.isEqual(cert.issuer),
  }
}

/** Parse a certificate from DER bytes or PEM text (bytes). */
export function parseCertificates(input: Uint8Array): pkijs.Certificate[] {
  const text = new TextDecoder("latin1").decode(input)
  const pemBlocks = [
    ...text.matchAll(/-----BEGIN CERTIFICATE-----([\s\S]*?)-----END CERTIFICATE-----/g),
  ]
  // PEM, bare base64 (as served by cca.gov.in), or raw DER.
  const ders = pemBlocks.length
    ? pemBlocks.map((m) => base64ToBytes(m[1]))
    : /^\s*MII[A-Za-z0-9+/=\s]+$/.test(text)
      ? [base64ToBytes(text)]
      : [input]
  return ders.map((der) => {
    const asn1 = asn1js.fromBER(der as BufferSource)
    if (asn1.offset === -1) throw new Error("Not a valid certificate file")
    return new pkijs.Certificate({ schema: asn1.result })
  })
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ""))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function bytesToBase64(bytes: Uint8Array): string {
  let bin = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(bin)
}

function sameCert(a: pkijs.Certificate, b: pkijs.Certificate): boolean {
  const x = certDer(a)
  const y = certDer(b)
  return x.length === y.length && x.every((v, i) => v === y[i])
}

async function issuedBy(cert: pkijs.Certificate, issuer: pkijs.Certificate): Promise<boolean> {
  if (!cert.issuer.isEqual(issuer.subject)) return false
  try {
    return await cert.verify(issuer)
  } catch {
    return false
  }
}

export interface ChainResult {
  chain: pkijs.Certificate[]
  trusted: boolean
  /** Index in chain of first certificate outside its validity at `at` */
  expiredIndex: number
}

/**
 * Build a chain from the signer certificate up through the supplied pool,
 * stopping at a trusted anchor or a self-signed root.
 */
export async function buildChain(
  signer: pkijs.Certificate,
  pool: pkijs.Certificate[],
  anchors: pkijs.Certificate[],
  at: Date,
): Promise<ChainResult> {
  const chain = [signer]
  let trusted = false
  let current = signer

  for (let depth = 0; depth < 10; depth++) {
    if (anchors.some((a) => sameCert(a, current))) {
      // A self-signed anchor still has to carry a valid self-signature.
      trusted = !current.subject.isEqual(current.issuer) || (await issuedBy(current, current))
      break
    }
    const anchor = await findAsync(anchors, (a) => issuedBy(current, a))
    if (anchor) {
      if (!sameCert(anchor, current)) chain.push(anchor)
      trusted = true
      break
    }
    if (current.subject.isEqual(current.issuer)) break
    const next = await findAsync(
      pool.filter((p) => !chain.some((c) => sameCert(c, p))),
      (p) => issuedBy(current, p),
    )
    if (!next) break
    chain.push(next)
    current = next
  }

  const expiredIndex = chain.findIndex(
    (c) => at < c.notBefore.value || at > c.notAfter.value,
  )
  return { chain, trusted, expiredIndex }
}

async function findAsync<T>(list: T[], pred: (t: T) => Promise<boolean>): Promise<T | undefined> {
  for (const item of list) if (await pred(item)) return item
  return undefined
}

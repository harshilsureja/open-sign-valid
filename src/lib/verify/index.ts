import * as asn1js from "asn1js"
import * as pkijs from "pkijs"
import { buildChain, certInfo, parseCertificates } from "./cert"
import { findSignatures, isEncrypted, parsePdfDate, toBinaryString } from "./pdf-parse"
import type { RawSignature } from "./pdf-parse"
import type { SignatureReport, VerifyOptions, VerifyResult } from "./types"

export type * from "./types"
export { parseCertificates } from "./cert"
export { signatureObjectForWidget, toBinaryString } from "./pdf-parse"

const OID = {
  signedData: "1.2.840.113549.1.7.2",
  messageDigest: "1.2.840.113549.1.9.4",
  signingTime: "1.2.840.113549.1.9.5",
  timeStampToken: "1.2.840.113549.1.9.16.2.14",
}

const DIGESTS: Record<string, string> = {
  "1.3.14.3.2.26": "SHA-1",
  "2.16.840.1.101.3.4.2.1": "SHA-256",
  "2.16.840.1.101.3.4.2.2": "SHA-384",
  "2.16.840.1.101.3.4.2.3": "SHA-512",
}

let engineReady = false
function ensureEngine() {
  if (engineReady) return
  pkijs.setEngine(
    "webcrypto",
    new pkijs.CryptoEngine({ name: "webcrypto", crypto: globalThis.crypto }),
  )
  engineReady = true
}

/**
 * Verify every digital signature in a PDF. Runs entirely locally using
 * WebCrypto — nothing is sent anywhere.
 */
export async function verifyPdf(
  bytes: Uint8Array,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  ensureEngine()
  const raw = toBinaryString(bytes)
  const anchors = (options.trustedCertificates ?? []).flatMap((der) => {
    try {
      return parseCertificates(der)
    } catch {
      return []
    }
  })

  const found = findSignatures(bytes, raw)
  const lastEnd = Math.max(0, ...found.map((s) => s.byteRange[2] + s.byteRange[3]))
  const signatures: SignatureReport[] = []
  for (const [index, sig] of found.entries()) {
    signatures.push(await verifyOne(sig, index, bytes, anchors, lastEnd))
  }

  const overall: VerifyResult["overall"] =
    signatures.length === 0
      ? "unsigned"
      : signatures.some((s) => s.status === "invalid")
        ? "invalid"
        : signatures.every((s) => s.status === "valid")
          ? "valid"
          : "unknown"

  const headline = {
    unsigned: "This document is not digitally signed.",
    valid:
      signatures.length > 1
        ? "Signed and all signatures are valid."
        : "Signed and the signature is valid.",
    unknown: "At least one signature has problems.",
    invalid: "At least one signature is invalid.",
  }[overall]

  return { overall, headline, signatures, encrypted: isEncrypted(raw), fileSize: bytes.length }
}

async function verifyOne(
  sig: RawSignature,
  index: number,
  bytes: Uint8Array,
  anchors: pkijs.Certificate[],
  lastEnd: number,
): Promise<SignatureReport> {
  const report: SignatureReport = {
    index,
    objectNumber: sig.objectNumber,
    status: "invalid",
    headline: "Signature is invalid",
    subFilter: sig.dict.subFilter,
    signer: null,
    chain: [],
    signingTimeSource: "none",
    reason: sig.dict.reason,
    location: sig.dict.location,
    contactInfo: sig.dict.contactInfo,
    name: sig.dict.name,
    byteRange: sig.byteRange,
    checks: { integrity: "skip", signature: "skip", trust: "skip", validity: "skip", coverage: "skip" },
    messages: [],
    isAadhaar: false,
  }
  const fail = (message: string) => {
    report.messages.push(message)
    return report
  }

  if (sig.error || !sig.contents) return fail(sig.error ?? "Signature value missing.")
  if (sig.dict.subFilter === "adbe.x509.rsa_sha1") {
    report.status = "unknown"
    report.headline = "Signature format not supported"
    return fail("This legacy signature format (adbe.x509.rsa_sha1) is not supported yet.")
  }

  // --- Parse CMS -----------------------------------------------------------
  let sd: pkijs.SignedData
  try {
    const asn1 = asn1js.fromBER(sig.contents as BufferSource)
    if (asn1.offset === -1) throw new Error("bad asn1")
    const ci = new pkijs.ContentInfo({ schema: asn1.result })
    if (ci.contentType !== OID.signedData) throw new Error("not signed data")
    sd = new pkijs.SignedData({ schema: ci.content })
  } catch {
    return fail("The signature data is corrupted and could not be read.")
  }
  const si = sd.signerInfos[0]
  if (!si) return fail("The signature contains no signer.")

  const digestName = DIGESTS[si.digestAlgorithm.algorithmId]
  report.digestAlgorithm = digestName ?? si.digestAlgorithm.algorithmId
  if (!digestName) return fail(`Unsupported digest algorithm ${si.digestAlgorithm.algorithmId}.`)

  // --- Integrity: hash the signed byte ranges ------------------------------
  const [a, b, c, d] = sig.byteRange
  const signed = new Uint8Array(b + d)
  signed.set(bytes.subarray(a, a + b), 0)
  signed.set(bytes.subarray(c, c + d), b)

  const isSha1Legacy = sig.dict.subFilter === "adbe.pkcs7.sha1"
  if (isSha1Legacy) {
    const embedded = octets(sd.encapContentInfo?.eContent)
    const actual = await digest("SHA-1", signed)
    report.checks.integrity = embedded && equalBytes(embedded, actual) ? "pass" : "fail"
  } else {
    const md = si.signedAttrs?.attributes.find((attr) => attr.type === OID.messageDigest)
    if (md) {
      const expected = octets(md.values[0] as asn1js.OctetString)
      const actual = await digest(digestName, signed)
      report.checks.integrity = expected && equalBytes(expected, actual) ? "pass" : "fail"
    }
  }

  // --- Cryptographic signature --------------------------------------------
  let signerCert: pkijs.Certificate | null = null
  try {
    const result = await sd.verify({
      signer: 0,
      data: isSha1Legacy ? undefined : (signed.buffer as ArrayBuffer),
      checkChain: false,
      extendedMode: true,
    })
    report.checks.signature = result.signatureVerified ? "pass" : "fail"
    signerCert = result.signerCertificate ?? null
  } catch (e) {
    const err = e as pkijs.SignedDataVerifyError
    report.checks.signature = "fail"
    signerCert = err.signerCertificate ?? null
  }
  // Without signed attributes the signature itself proves integrity.
  if (report.checks.integrity === "skip") report.checks.integrity = report.checks.signature

  const pool = (sd.certificates ?? []).filter(
    (cert): cert is pkijs.Certificate => cert instanceof pkijs.Certificate,
  )
  signerCert ??= pool[0] ?? null
  if (signerCert) {
    report.signer = await certInfo(signerCert)
    report.isAadhaar = isAadhaarSigner(report.signer)
  }

  // --- Signing time ---------------------------------------------------------
  report.timestamp = await readTimestamp(si)
  const attrTime = si.signedAttrs?.attributes.find((attr) => attr.type === OID.signingTime)
  if (report.timestamp?.verified) {
    report.signingTime = report.timestamp.time
    report.signingTimeSource = "timestamp"
  } else if (attrTime) {
    report.signingTime = (attrTime.values[0] as asn1js.UTCTime).toDate()
    report.signingTimeSource = "signer-clock"
  } else if (parsePdfDate(sig.dict.m)) {
    report.signingTime = parsePdfDate(sig.dict.m)
    report.signingTimeSource = "pdf"
  }

  // --- Coverage: anything appended after this signature? -------------------
  const end = c + d
  const tail = bytes.subarray(end)
  if (tail.every((byte) => byte === 0x0a || byte === 0x0d || byte === 0x20 || byte === 0x00)) {
    report.checks.coverage = "pass"
  } else if (lastEnd > end) {
    report.checks.coverage = "warn"
  } else {
    report.checks.coverage = "fail"
  }

  // --- Trust & validity ----------------------------------------------------
  if (signerCert) {
    const at = report.signingTime ?? new Date()
    const chain = await buildChain(signerCert, pool, anchors, at)
    report.chain = await Promise.all(chain.chain.map(certInfo))
    report.checks.trust = chain.trusted ? "pass" : "warn"
    report.checks.validity = chain.expiredIndex === -1 ? "pass" : "warn"
  } else {
    report.checks.trust = "fail"
  }

  finalize(report)
  return report
}

function finalize(r: SignatureReport) {
  const { checks: k, messages: m } = r

  if (k.integrity === "fail") {
    m.push("The document has been altered or corrupted since the signature was applied.")
  } else if (k.integrity === "pass") {
    m.push("The document has not been modified since this signature was applied.")
  }
  if (k.signature === "fail" && k.integrity !== "fail") {
    m.push("The cryptographic signature does not match the signer's certificate.")
  }
  if (k.coverage === "warn") {
    m.push("Later revisions (such as more signatures) were added after this signature.")
  } else if (k.coverage === "fail") {
    m.push("The document was changed after it was signed. Content you see may differ from what was signed.")
  }
  if (k.trust === "pass") {
    m.push("The signer's identity is valid: the certificate chains to a trusted root.")
  } else if (k.trust === "warn") {
    m.push("The signer's identity is unknown: the certificate does not chain to a trusted root.")
  } else if (k.trust === "fail") {
    m.push("The signer's certificate is not embedded in the signature.")
  }
  if (k.validity === "warn") {
    m.push("A certificate in the chain was not within its validity period at signing time.")
  }
  if (r.signingTimeSource === "timestamp") {
    m.push("Signing time is certified by a trusted timestamp.")
  } else if (r.signingTimeSource === "signer-clock") {
    m.push("Signing time is from the clock on the signer's computer.")
  }
  m.push("Revocation status was not checked (offline verification).")

  if (k.integrity === "fail" || k.signature === "fail") {
    r.status = "invalid"
    r.headline = k.integrity === "fail" ? "Document altered — signature invalid" : "Signature is invalid"
  } else if (
    k.trust === "pass" &&
    k.validity === "pass" &&
    (k.coverage === "pass" || k.coverage === "warn")
  ) {
    r.status = "valid"
    r.headline = "Signature is valid"
  } else {
    r.status = "unknown"
    r.headline =
      k.coverage === "fail"
        ? "Document changed after signing"
        : k.trust !== "pass"
          ? "Signer identity unknown"
          : "Signature validity is unknown"
  }
}

async function readTimestamp(si: pkijs.SignerInfo): Promise<SignatureReport["timestamp"]> {
  const attr = si.unsignedAttrs?.attributes.find((a) => a.type === OID.timeStampToken)
  if (!attr) return undefined
  try {
    const ci = new pkijs.ContentInfo({ schema: attr.values[0] })
    const tsd = new pkijs.SignedData({ schema: ci.content })
    const content = octets(tsd.encapContentInfo.eContent)
    if (!content) return undefined
    const tst = new pkijs.TSTInfo({ schema: asn1js.fromBER(content as BufferSource).result })
    const hashName = DIGESTS[tst.messageImprint.hashAlgorithm.algorithmId]
    const imprintOk =
      !!hashName &&
      equalBytes(
        tst.messageImprint.hashedMessage.valueBlock.valueHexView,
        await digest(hashName, si.signature.valueBlock.valueHexView),
      )
    let sigOk = false
    let authority: string | undefined
    try {
      const res = await tsd.verify({ signer: 0, checkChain: false, extendedMode: true })
      sigOk = !!res.signatureVerified
      if (res.signerCertificate) authority = (await certInfo(res.signerCertificate)).commonName
    } catch {
      sigOk = false
    }
    return { time: tst.genTime, authority, verified: imprintOk && sigOk }
  } catch {
    return undefined
  }
}

function isAadhaarSigner(info: { commonName?: string; organization?: string }): boolean {
  const text = `${info.commonName ?? ""} ${info.organization ?? ""}`.toLowerCase()
  return text.includes("unique identification authority of india") || /\buidai\b/.test(text)
}

/** Read an OCTET STRING's bytes, joining constructed (chunked) encodings. */
function octets(os: asn1js.OctetString | undefined): Uint8Array | null {
  if (!os) return null
  if (os.idBlock.isConstructed) {
    const parts = (os.valueBlock.value as asn1js.OctetString[]).map((p) => octets(p) ?? new Uint8Array())
    const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
    let offset = 0
    for (const p of parts) {
      out.set(p, offset)
      offset += p.length
    }
    return out
  }
  return new Uint8Array(os.valueBlock.valueHexView)
}

async function digest(name: string, data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest(name, data as BufferSource))
}

function equalBytes(x: Uint8Array, y: Uint8Array): boolean {
  return x.length === y.length && x.every((v, i) => v === y[i])
}

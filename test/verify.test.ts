import { beforeAll, describe, expect, it } from "vitest"
import { verifyPdf } from "../src/lib/verify"
import { makeSignedPdf, type Fixture } from "./fixtures"

let fx: Fixture
let aadhaar: Fixture

beforeAll(async () => {
  fx = await makeSignedPdf()
  aadhaar = await makeSignedPdf("DS Unique Identification Authority of India 05", "Unique Identification Authority of India")
}, 60_000)

describe("verifyPdf", () => {
  it("reports unsigned documents", async () => {
    const r = await verifyPdf(fx.unsignedPdf)
    expect(r.overall).toBe("unsigned")
    expect(r.signatures).toHaveLength(0)
  })

  it("intact signature from an untrusted root is 'unknown' (yellow)", async () => {
    const r = await verifyPdf(fx.pdf)
    expect(r.signatures).toHaveLength(1)
    const s = r.signatures[0]
    expect(s.checks.integrity).toBe("pass")
    expect(s.checks.signature).toBe("pass")
    expect(s.checks.coverage).toBe("pass")
    expect(s.checks.trust).toBe("warn")
    expect(s.status).toBe("unknown")
    expect(s.signer?.commonName).toBe("DS Test Signer")
    expect(s.reason).toBe("Testing")
    expect(s.location).toBe("Ahmedabad")
    expect(s.chain.map((c) => c.commonName)).toEqual(["DS Test Signer", "Test Root CA"])
  })

  it("trusted root makes it 'valid' (green)", async () => {
    const r = await verifyPdf(fx.pdf, { trustedCertificates: [fx.rootDer] })
    expect(r.overall).toBe("valid")
    expect(r.signatures[0].checks.trust).toBe("pass")
  })

  it("a root from another CA is not trusted", async () => {
    const r = await verifyPdf(fx.pdf, { trustedCertificates: [aadhaar.rootDer] })
    expect(r.signatures[0].checks.trust).toBe("warn")
  })

  it("tampered bytes are 'invalid' (red)", async () => {
    const pdf = fx.pdf.slice()
    const text = new TextDecoder("latin1").decode(pdf)
    const at = text.indexOf("Open Sign Valid")
    // Content stream may be compressed; flip a byte early in the file instead if not found.
    const pos = at > 0 ? at : 20
    pdf[pos] = pdf[pos] ^ 0x01
    const r = await verifyPdf(pdf, { trustedCertificates: [fx.rootDer] })
    expect(r.overall).toBe("invalid")
    expect(r.signatures[0].checks.integrity).toBe("fail")
  })

  it("changes appended after signing are flagged", async () => {
    const extra = new TextEncoder().encode("\n1 0 obj\n<< /Evil true >>\nendobj\n%%EOF\n")
    const pdf = new Uint8Array(fx.pdf.length + extra.length)
    pdf.set(fx.pdf)
    pdf.set(extra, fx.pdf.length)
    const r = await verifyPdf(pdf, { trustedCertificates: [fx.rootDer] })
    expect(r.signatures[0].checks.integrity).toBe("pass")
    expect(r.signatures[0].checks.coverage).toBe("fail")
    expect(r.overall).toBe("unknown")
  })

  it("detects Aadhaar (UIDAI) signers", async () => {
    const r = await verifyPdf(aadhaar.pdf)
    expect(r.signatures[0].isAadhaar).toBe(true)
    const r2 = await verifyPdf(fx.pdf)
    expect(r2.signatures[0].isAadhaar).toBe(false)
  })
})

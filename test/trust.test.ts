import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { bytesToBase64, certDer, certInfo, parseCertificates } from "../src/lib/verify/cert"

const rootsDir = join(import.meta.dirname, "..", "src", "lib", "trust", "roots")
const pems = readdirSync(rootsDir).filter((f) => f.endsWith(".pem"))

describe("bundled trust roots", () => {
  it("ships the CCA India roots used by e-Aadhaar", async () => {
    const names = await Promise.all(
      pems.map(async (f) => {
        const [cert] = parseCertificates(readFileSync(join(rootsDir, f)))
        const info = await certInfo(cert)
        expect(info.selfSigned).toBe(true)
        expect(await cert.verify(cert)).toBe(true)
        return info.commonName
      })
    )
    expect(names).toEqual(
      expect.arrayContaining(["CCA India 2022", "CCA India 2014", "CCA India 2022 SPL"])
    )
  })

  it("parses bare base64 certificate files (as served by cca.gov.in)", () => {
    const [cert] = parseCertificates(readFileSync(join(rootsDir, "cca-india-2022.pem")))
    const bare = new TextEncoder().encode(bytesToBase64(certDer(cert)))
    expect(parseCertificates(bare)).toHaveLength(1)
  })
})

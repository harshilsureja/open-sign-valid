// Writes sample PDFs to samples/ for trying the app by hand:
//   valid-untrusted.pdf  intact, signer not in trust store   -> yellow
//   tampered.pdf         one byte changed after signing        -> red
//   modified.pdf         content appended after signing        -> yellow
//   unsigned.pdf         no signature                          -> grey
//   test-root-ca.cer     import this in "Trusted certificates" to turn valid-untrusted green
//   layered-aadhaar-like.pdf  Acrobat/iText layered box like e-Aadhaar (trust layered-root-ca.cer)
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { makeSignedPdf } from "../test/fixtures.ts"

const out = join(import.meta.dirname, "..", "samples")
mkdirSync(out, { recursive: true })

const fx = await makeSignedPdf()
writeFileSync(join(out, "valid-untrusted.pdf"), fx.pdf)
writeFileSync(join(out, "unsigned.pdf"), fx.unsignedPdf)
writeFileSync(join(out, "test-root-ca.cer"), fx.rootDer)

// e-Aadhaar style layered signature box ("?" icon + "Signature Not Verified").
const layered = await makeSignedPdf(
  "DS Unique Identification Authority of India 05",
  "Unique Identification Authority of India",
  { layered: true }
)
writeFileSync(join(out, "layered-aadhaar-like.pdf"), layered.pdf)
writeFileSync(join(out, "layered-root-ca.cer"), layered.rootDer)

const tampered = fx.pdf.slice()
tampered[20] ^= 0x01
writeFileSync(join(out, "tampered.pdf"), tampered)

const extra = new TextEncoder().encode("\n%% appended after signing\n%%EOF\n")
const modified = new Uint8Array(fx.pdf.length + extra.length)
modified.set(fx.pdf)
modified.set(extra, fx.pdf.length)
writeFileSync(join(out, "modified.pdf"), modified)

console.log(`Samples written to ${out}`)

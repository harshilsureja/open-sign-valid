/**
 * Generates signed test PDFs in memory: a throw-away root CA, a signer
 * certificate issued by it, and a PDF signed with that certificate.
 */
import forge from "node-forge"
import { PDFArray, PDFDict, PDFDocument, PDFName, StandardFonts, rgb } from "pdf-lib"
import { SignPdf } from "@signpdf/signpdf"
import { P12Signer } from "@signpdf/signer-p12"
import { pdflibAddPlaceholder } from "@signpdf/placeholder-pdf-lib"

const pki = forge.pki

function makeCert(opts: {
  subjectCN: string
  org: string
  keys: forge.pki.rsa.KeyPair
  issuer?: { cert: forge.pki.Certificate; key: forge.pki.rsa.PrivateKey }
  ca: boolean
  notBefore?: Date
  notAfter?: Date
}) {
  const cert = pki.createCertificate()
  cert.publicKey = opts.keys.publicKey
  cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(8)).replace(/^[89a-f]/, "1")
  cert.validity.notBefore = opts.notBefore ?? new Date(Date.now() - 86_400_000)
  cert.validity.notAfter = opts.notAfter ?? new Date(Date.now() + 365 * 86_400_000)
  const attrs = [
    { name: "commonName", value: opts.subjectCN },
    { name: "organizationName", value: opts.org },
    { name: "countryName", value: "IN" },
  ]
  cert.setSubject(attrs)
  cert.setIssuer(opts.issuer ? opts.issuer.cert.subject.attributes : attrs)
  cert.setExtensions([
    { name: "basicConstraints", cA: opts.ca },
    { name: "keyUsage", keyCertSign: opts.ca, digitalSignature: true, nonRepudiation: true },
  ])
  cert.sign(opts.issuer?.key ?? opts.keys.privateKey, forge.md.sha256.create())
  return cert
}

export interface Fixture {
  pdf: Uint8Array
  rootDer: Uint8Array
  unsignedPdf: Uint8Array
}

/** A throw-away root CA and a signer certificate it issued, as a PKCS#12. */
export function makeIdentity(signerCN: string, signerOrg: string) {
  const rootKeys = pki.rsa.generateKeyPair(2048)
  const root = makeCert({ subjectCN: "Test Root CA", org: "Open Sign Valid Tests", keys: rootKeys, ca: true })
  const signerKeys = pki.rsa.generateKeyPair(2048)
  const signer = makeCert({
    subjectCN: signerCN,
    org: signerOrg,
    keys: signerKeys,
    issuer: { cert: root, key: rootKeys.privateKey },
    ca: false,
  })

  const p12 = forge.pkcs12.toPkcs12Asn1(signerKeys.privateKey, [signer, root], "", {
    algorithm: "3des",
  })
  const p12Buffer = Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary")
  const rootDer = Buffer.from(forge.asn1.toDer(pki.certificateToAsn1(root)).getBytes(), "binary")
  return { p12Buffer, rootDer: new Uint8Array(rootDer) }
}

const WIDGET_RECT: [number, number, number, number] = [330, 80, 550, 160]

/**
 * Give the signature widget an Acrobat-6/iText style layered appearance,
 * like e-Aadhaar: n1 = "?" icon, n2 = signed details, n4 = status title.
 */
function addLayeredAppearance(doc: PDFDocument, signerCN: string) {
  const ctx = doc.context
  const W = WIDGET_RECT[2] - WIDGET_RECT[0]
  const H = WIDGET_RECT[3] - WIDGET_RECT[1]
  const font = (base: string) =>
    ctx.obj({ Type: "Font", Subtype: "Type1", BaseFont: base, Encoding: "WinAnsiEncoding" })
  const form = (content: string, bbox: number[], resources: Record<string, unknown> = {}) =>
    ctx.register(
      ctx.stream(content, {
        Type: "XObject",
        Subtype: "Form",
        BBox: bbox,
        Resources: ctx.obj(resources as never),
      })
    )

  const n0 = form("% DSBlank\n", [0, 0, 100, 100])
  const n1 = form("q 0.95 0.85 0.1 rg BT /F1 110 Tf 20 8 Td (?) Tj ET Q\n", [0, 0, 100, 100], {
    Font: ctx.obj({ F1: font("Helvetica-Bold") }),
  })
  const n2 = form(
    `BT /F1 9 Tf 2 ${H * 0.7 - 12} Td (Digitally signed by ${signerCN}) Tj 0 -11 Td (Date: 2026.07.25 11:19:18 IST) Tj ET\n`,
    [0, 0, W, H * 0.7],
    { Font: ctx.obj({ F1: font("Times-Roman") }) }
  )
  const n3 = form("% DSBlank\n", [0, 0, 100, 100])
  const n4 = form("BT /F1 14 Tf 2 6 Td (Signature Not Verified) Tj ET\n", [0, 0, W, H * 0.3], {
    Font: ctx.obj({ F1: font("Helvetica") }),
  })
  const s = (0.9 * Math.min(W, H)) / 100
  const ix = (W - 100 * s) / 2
  const iy = (H - 100 * s) / 2
  const frm = form(
    `q /n0 Do Q q ${s} 0 0 ${s} ${ix} ${iy} cm /n1 Do Q q /n2 Do Q q ${s} 0 0 ${s} ${ix} ${iy} cm /n3 Do Q q 1 0 0 1 0 ${H * 0.7} cm /n4 Do Q\n`,
    [0, 0, W, H],
    { XObject: ctx.obj({ n0, n1, n2, n3, n4 }) }
  )
  const normal = form("q /FRM Do Q\n", [0, 0, W, H], { XObject: ctx.obj({ FRM: frm }) })

  const acroForm = doc.catalog.lookup(PDFName.of("AcroForm"), PDFDict)
  const fields = acroForm.lookup(PDFName.of("Fields"), PDFArray)
  const widget = ctx.lookup(fields.get(fields.size() - 1), PDFDict)
  widget.set(PDFName.of("AP"), ctx.obj({ N: normal }))
}

export async function makeSignedPdf(
  signerCN = "DS Test Signer",
  signerOrg = "Test Org",
  { layered = false }: { layered?: boolean } = {}
): Promise<Fixture> {
  const { p12Buffer, rootDer } = makeIdentity(signerCN, signerOrg)

  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText("Open Sign Valid test document", { x: 50, y: 780, size: 20, font })
  if (!layered) {
    // Plain signature box drawn in the page content (no appearance stream).
    page.drawRectangle({ x: 330, y: 80, width: 220, height: 60, borderWidth: 1, borderColor: rgb(0.6, 0.6, 0.6) })
    page.drawText(`Digitally signed by ${signerCN}`, { x: 338, y: 118, size: 8, font })
    page.drawText("Signature box for testing", { x: 338, y: 104, size: 8, font })
  }
  const unsignedPdf = await doc.save({ useObjectStreams: false })

  pdflibAddPlaceholder({
    pdfDoc: doc,
    widgetRect: layered ? WIDGET_RECT : [330, 80, 550, 140],
    reason: "Testing",
    contactInfo: "test@example.com",
    name: signerCN,
    location: "Ahmedabad",
  })
  if (layered) addLayeredAppearance(doc, signerCN)
  const withPlaceholder = Buffer.from(await doc.save({ useObjectStreams: false }))
  const signed = await new SignPdf().sign(withPlaceholder, new P12Signer(p12Buffer))

  return { pdf: new Uint8Array(signed), rootDer, unsignedPdf }
}

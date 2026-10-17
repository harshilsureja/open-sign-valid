# Open Sign Valid — verify Aadhaar & signed PDFs, privately

**Open Sign Valid** checks the digital signature on an
e-Aadhaar or any other digitally signed PDF and shows an Adobe-style result:

| | Meaning |
|---|---|
| ✅ **Valid** | Document is exactly as signed, and the signer chains to a trusted root |
| ⚠️ **Needs attention** | Document intact, but signer not trusted / content added after signing |
| ❌ **Invalid** | Document altered after signing, or signature broken |

Everything runs **in your browser**. The PDF is never uploaded. In production a
Content-Security-Policy (`connect-src 'self'`) blocks the page from contacting
any other host.

> Open Sign Valid is an independent open-source project, not affiliated with UIDAI or
> the Government of India.

## Features

- Verifies PAdES / PKCS#7 signatures (`adbe.pkcs7.detached`, `ETSI.CAdES.detached`, `adbe.pkcs7.sha1`)
- Detects tampering, changes appended after signing, and multiple signatures
- Certificate chain, validity period, and RFC 3161 timestamp checks
- e-Aadhaar detection (UIDAI signer); works on password-protected files —
  the signature is checked without the password
- Sharp PDF viewer (pdf.js) with actual-size (100%) and fit-width zoom
- Adobe-style result on the signature box: like Acrobat, only the validity
  icon and the status title are swapped (tick / ? / cross, "Signature valid");
  the signed "Digitally signed by … Date: …" text is rendered exactly as in
  the PDF. This happens on screen and in print only — the file is never modified
- Password-protected PDFs: password entered inline, never leaves the device
- Print at 300 DPI and true paper size (prints the original pages only)
- Trust store: CCA India roots bundled (e-Aadhaar validates automatically)
  + certificates you add (kept in your browser)

## Getting started

```bash
git clone https://github.com/harshil-at/open-sign-valid.git
cd open-sign-valid
npm install
npm run dev        # http://localhost:3000
npm test           # verification tests (generates signed PDFs on the fly)
npm run samples    # writes sample PDFs to samples/ for manual testing
npm run build      # static site in dist/client — host anywhere
```

## Trusted roots (important for e-Aadhaar)

A signature is green only when its chain ends at a trusted root. e-Aadhaar is
signed under the **CCA India** root. The official CCA India roots from
https://cca.gov.in/root_certificate.html are bundled in `src/lib/trust/roots/`
(fingerprints listed in the README there), so a genuine e-Aadhaar shows ✅
without any setup.

## How verification works

1. Find every `/ByteRange` + `/Contents` pair in the raw PDF bytes.
2. Hash the signed byte ranges and compare with the CMS `messageDigest`.
3. Verify the CMS signature with WebCrypto (via [PKI.js](https://github.com/PeculiarVentures/PKI.js)).
4. Build the certificate chain from the embedded certificates to a trusted root,
   checking validity at signing time (timestamp time when present).
5. Check whether bytes were added after the signature.

Code: [`src/lib/verify`](src/lib/verify). Revocation (OCSP/CRL) is not checked yet
because browsers block those requests (CORS); a self-hostable proxy is planned.

## Tech

TanStack Start (SPA mode) · React · shadcn/ui · Tailwind · pdf.js · PKI.js · Vitest

## Contributing

Issues and pull requests are welcome at
https://github.com/harshil-at/open-sign-valid.

## License

[Apache-2.0](LICENSE)

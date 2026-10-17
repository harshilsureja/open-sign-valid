# Changelog

## v1.0.1

- Fix GitHub links (header, footer, FAQ, README, package.json) to point to
  https://github.com/harshilsureja/open-sign-verify

## v1.0.0 — first release

Open Sign Valid checks the digital signature on an e-Aadhaar or any other
digitally signed PDF — privately, entirely in the browser.

### Verification
- PAdES / PKCS#7 signatures (`adbe.pkcs7.detached`, `ETSI.CAdES.detached`,
  `adbe.pkcs7.sha1`): document integrity, cryptographic signature,
  certificate chain, validity at signing time, RFC 3161 timestamps
- Detects tampering and content added after signing
- Official CCA India root certificates bundled, so a genuine e-Aadhaar
  shows green automatically; users can trust extra roots in their browser
- Works on password-protected PDFs — the signature is checked without the
  password

### Viewer
- Sharp pdf.js viewer rendered at exact screen resolution, with fit-width
  and actual-size zoom
- Adobe-style result on the signature box: only the validity icon and
  status title are swapped; the signed text is shown exactly as signed
- Inline password entry (autofill blocked, auto-focus)
- Print at 300 DPI and true paper size; Ctrl+P prints the document

### Experience
- Plain-language result for first-time users, mobile-first layout with
  a bottom Print bar, Back button returns to the start page
- How-it-works steps, standards & privacy section, and FAQ
- Light and dark mode

### Privacy
- No uploads, no cookies, no analytics; a strict Content-Security-Policy
  blocks requests to other hosts in production

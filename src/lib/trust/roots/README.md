# Built-in trusted roots

Every `*.pem` file in this folder is bundled into the app as a trusted root.
A signature shows green only when its certificate chain ends at one of these
(or at a certificate the user added in the browser).

## CCA India (Root Certifying Authority of India)

Downloaded from the official page https://cca.gov.in/root_certificate.html.
All Indian DSCs, including the UIDAI certificate that signs e-Aadhaar, chain
to one of these. Expired roots are kept because signatures are validated at
signing time (older e-Aadhaar PDFs chain to CCA India 2014).

| File | Subject | Valid until | SHA-256 |
|---|---|---|---|
| `cca-india-2022.pem` | CN=CCA India 2022 | 2042-02-02 | `9A:3F:D3:17:67:98:E8:42:DD:CB:12:C2:62:F1:1C:FA:CC:A7:0A:8B:84:C6:EA:6F:DA:30:84:2A:95:A9:4C:D8` |
| `cca-india-2022-spl.pem` | CN=CCA India 2022 SPL | 2042-09-20 | `B7:24:68:9B:79:B2:EF:94:21:EF:8F:5C:C7:33:EB:09:38:51:B1:70:EE:71:51:77:00:5A:09:F2:26:D8:C9:1A` |
| `cca-india-2014.pem` | CN=CCA India 2014 | 2024-03-05 | `60:10:9B:C6:C3:83:28:59:8A:11:2C:7A:25:E3:8B:0F:23:E5:A7:51:1C:B8:15:FB:64:E0:C4:FF:05:DB:7D:F7` |
| `cca-india-2011.pem` | CN=CCA India 2011 | 2016-03-11 | `2D:66:A7:02:AE:81:BA:03:AF:8C:FF:55:AB:31:8A:FA:91:90:39:D9:F3:1B:4D:64:38:86:80:F8:13:11:B6:5A` |

CCA offers out-of-band fingerprint confirmation by email (verifyroot at
cca.gov.in). Confirm fingerprints that way before a public release.

## Adding a root

Drop a PEM file here. Convert a DER `.cer` with:

    openssl x509 -inform der -in root.cer -out root.pem

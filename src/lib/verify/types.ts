/**
 * Result types for PDF signature verification.
 *
 * Status follows the Adobe Acrobat convention:
 *  - valid   (green tick)   document intact, signature valid, signer trusted
 *  - unknown (yellow mark)  document intact but identity / later changes can't be confirmed
 *  - invalid (red cross)    document altered or signature cryptographically broken
 */
export type SignatureStatus = "valid" | "unknown" | "invalid"

export type OverallStatus = SignatureStatus | "unsigned"

export interface CertInfo {
  /** DER encoding of the certificate */
  der: Uint8Array
  commonName?: string
  organization?: string
  organizationalUnit?: string
  country?: string
  state?: string
  locality?: string
  email?: string
  /** Full subject DN, e.g. "CN=..., O=..., C=IN" */
  subject: string
  issuer: string
  issuerCommonName?: string
  serialNumber: string
  notBefore: Date
  notAfter: Date
  sha256: string
  selfSigned: boolean
}

export type Check = "pass" | "fail" | "warn" | "skip"

export interface SignatureReport {
  index: number
  /** PDF object number of the signature dictionary, when found */
  objectNumber?: number
  status: SignatureStatus
  /** One-line headline, e.g. "Signature is valid" */
  headline: string

  subFilter?: string
  signer: CertInfo | null
  /** Signer certificate first, root last */
  chain: CertInfo[]

  signingTime?: Date
  signingTimeSource: "timestamp" | "signer-clock" | "pdf" | "none"
  timestamp?: { time: Date; authority?: string; verified: boolean }

  reason?: string
  location?: string
  contactInfo?: string
  name?: string

  digestAlgorithm?: string
  byteRange: [number, number, number, number]

  checks: {
    /** Bytes covered by the signature hash to the value inside the signature */
    integrity: Check
    /** Cryptographic signature over the signed attributes */
    signature: Check
    /** Signer certificate chains to a trusted root */
    trust: Check
    /** Certificate validity period at signing time */
    validity: Check
    /** No changes after signing (or only later signatures) */
    coverage: Check
  }
  /** Human readable explanation lines, in display order */
  messages: string[]

  isAadhaar: boolean
}

export interface VerifyResult {
  overall: OverallStatus
  headline: string
  signatures: SignatureReport[]
  encrypted: boolean
  fileSize: number
}

export interface VerifyOptions {
  /** DER-encoded trusted root (or intermediate) certificates */
  trustedCertificates?: Uint8Array[]
}

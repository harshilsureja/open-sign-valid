import {
  base64ToBytes,
  bytesToBase64,
  certDer,
  certInfo,
  parseCertificates,
} from "@/lib/verify/cert"
import type { CertInfo } from "@/lib/verify"

/**
 * Trust store = bundled roots (PEM files in ./roots, shipped with the app)
 * + certificates the user chose to trust (kept in this browser only).
 */
const bundledPem = import.meta.glob("./roots/*.pem", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

const STORAGE_KEY = "open-sign-valid.trusted-certs"

export interface TrustedCert {
  der: Uint8Array
  info: CertInfo
  source: "bundled" | "user"
}

function bundledDers(): Uint8Array[] {
  return Object.values(bundledPem).flatMap((pem) =>
    parseCertificates(new TextEncoder().encode(pem)).map(certDer)
  )
}

function userDers(): Uint8Array[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]
    return list.map(base64ToBytes)
  } catch {
    return []
  }
}

function saveUserDers(ders: Uint8Array[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ders.map(bytesToBase64)))
  } catch {
    // storage blocked (private mode) — trust lasts for this session only
  }
}

export function trustedDers(): Uint8Array[] {
  return [...bundledDers(), ...userDers()]
}

export async function listTrusted(): Promise<TrustedCert[]> {
  const make = (source: TrustedCert["source"]) => async (der: Uint8Array) => ({
    der,
    source,
    info: await certInfo(parseCertificates(der)[0]),
  })
  return [
    ...(await Promise.all(bundledDers().map(make("bundled")))),
    ...(await Promise.all(userDers().map(make("user")))),
  ]
}

/** Add certificates from a .cer/.crt/.pem file. Returns how many were new. */
export async function addTrusted(file: Uint8Array): Promise<number> {
  const incoming = parseCertificates(file).map(certDer)
  const existing = userDers()
  const known = new Set([...bundledDers(), ...existing].map(bytesToBase64))
  const fresh = incoming.filter((der) => !known.has(bytesToBase64(der)))
  saveUserDers([...existing, ...fresh])
  return fresh.length
}

export function removeTrusted(der: Uint8Array) {
  const key = bytesToBase64(der)
  saveUserDers(userDers().filter((d) => bytesToBase64(d) !== key))
}

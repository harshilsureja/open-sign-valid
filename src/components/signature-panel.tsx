import { useEffect, useRef } from "react"
import {
  BadgeCheck,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  CircleX,
  Fingerprint,
  ShieldPlus,
  TriangleAlert,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { StatusIcon, statusStyles } from "@/components/status"
import { cn } from "@/lib/utils"
import type { Check, CertInfo, SignatureReport, VerifyResult } from "@/lib/verify"

export function formatDate(d?: Date) {
  if (!d) return "—"
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "long" })
}

const CHECK_LABELS: Record<keyof SignatureReport["checks"], string> = {
  integrity: "Document not altered",
  signature: "Signature is mathematically valid",
  trust: "Signer identity verified",
  validity: "Certificate valid at signing time",
  coverage: "No changes after signing",
}

function CheckIcon({ value }: { value: Check }) {
  if (value === "pass") return <CircleCheck className="size-4 text-emerald-600" />
  if (value === "warn") return <TriangleAlert className="size-4 text-amber-500" />
  if (value === "fail") return <CircleX className="size-4 text-red-600" />
  return <CircleMinus className="size-4 text-muted-foreground" />
}

export function SignaturePanel({
  result,
  active,
  onSelect,
  onTrustCertificate,
}: {
  result: VerifyResult
  active?: number
  onSelect: (index: number) => void
  onTrustCertificate: (cert: CertInfo) => void
}) {
  if (result.signatures.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        This PDF contains no digital signatures. A scanned or printed signature image is not a
        digital signature and cannot be verified.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-3 p-3">
      {result.signatures.map((s) => (
        <SignatureCard
          key={s.index}
          sig={s}
          active={active === s.index}
          onSelect={() => onSelect(s.index)}
          onTrustCertificate={onTrustCertificate}
        />
      ))}
    </div>
  )
}

function SignatureCard({
  sig,
  active,
  onSelect,
  onTrustCertificate,
}: {
  sig: SignatureReport
  active: boolean
  onSelect: () => void
  onTrustCertificate: (cert: CertInfo) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const style = statusStyles[sig.status]
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [active])

  const root = sig.chain.at(-1)
  const showTrust = sig.checks.trust === "warn" && root

  return (
    <div
      ref={ref}
      onClick={onSelect}
      className={cn(
        "rounded-xl border bg-card text-sm shadow-xs transition-shadow",
        active && cn("ring-2", style.ring)
      )}
    >
      <div className={cn("flex items-start gap-3 rounded-t-xl border-b p-3", style.bg, style.border)}>
        <StatusIcon status={sig.status} className="mt-0.5 size-6" />
        <div className="min-w-0 flex-1">
          <div className={cn("font-semibold", style.text)}>{sig.headline}</div>
          <div className="truncate text-foreground">
            {sig.signer?.commonName ?? sig.name ?? "Unknown signer"}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge variant="outline">Signature {sig.index + 1}</Badge>
            {sig.isAadhaar && (
              <Badge variant="secondary">
                <Fingerprint /> e-Aadhaar · UIDAI
              </Badge>
            )}
            {sig.timestamp?.verified && (
              <Badge variant="secondary">
                <BadgeCheck /> Timestamped
              </Badge>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 p-3">
        <Fact label="Signed by" value={sig.signer?.commonName} />
        <Fact label="Organisation" value={sig.signer?.organization} />
        <Fact
          label="Signed on"
          value={
            sig.signingTime && (
              <>
                {formatDate(sig.signingTime)}
                <span className="block text-xs text-muted-foreground">
                  {sig.signingTimeSource === "timestamp"
                    ? `Certified by ${sig.timestamp?.authority ?? "timestamp authority"}`
                    : "From the signer's computer clock"}
                </span>
              </>
            )
          }
        />
        <Fact label="Reason" value={sig.reason} />
        <Fact label="Location" value={sig.location} />
        <Fact label="Issued by" value={sig.signer?.issuerCommonName} />
      </dl>

      <ul className="flex flex-col gap-1.5 border-t p-3">
        {(Object.keys(CHECK_LABELS) as Array<keyof typeof CHECK_LABELS>).map((key) => (
          <li key={key} className="flex items-center gap-2">
            <CheckIcon value={sig.checks[key]} />
            <span className={cn(sig.checks[key] === "skip" && "text-muted-foreground")}>
              {CHECK_LABELS[key]}
            </span>
          </li>
        ))}
      </ul>

      {showTrust && (
        <div className="border-t p-3">
          <p className="mb-2 text-xs text-muted-foreground">
            The signature is intact, but the signer's root certificate isn't in your trusted list.
            {sig.isAadhaar &&
              " For e-Aadhaar, the root should be issued by the Controller of Certifying Authorities (CCA India)."}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onTrustCertificate(root)
            }}
          >
            <ShieldPlus /> Trust “{root.commonName ?? "root"}”…
          </Button>
        </div>
      )}

      <Collapsible className="border-t">
        <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-left font-medium hover:bg-muted/50">
          Details &amp; certificates
          <ChevronDown className="size-4 transition-transform group-data-[panel-open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-3 px-3 pb-3">
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {sig.messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <div className="flex flex-col gap-2">
            {sig.chain.map((cert, i) => (
              <CertBlock
                key={cert.sha256}
                cert={cert}
                role={i === 0 ? "Signer" : i === sig.chain.length - 1 ? "Root" : "Intermediate"}
              />
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Format: {sig.subFilter ?? "unknown"} · Hash: {sig.digestAlgorithm ?? "unknown"}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function Fact({ label, value }: { label: string; value?: React.ReactNode }) {
  if (!value) return null
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{value}</dd>
    </>
  )
}

function CertBlock({ cert, role }: { cert: CertInfo; role: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-2 text-xs">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">{cert.commonName ?? cert.subject}</span>
        <Badge variant="outline">{role}</Badge>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-muted-foreground">
        <dt>Subject</dt>
        <dd className="break-all">{cert.subject}</dd>
        <dt>Issuer</dt>
        <dd className="break-all">{cert.issuer}</dd>
        <dt>Valid</dt>
        <dd>
          {cert.notBefore.toLocaleDateString("en-IN")} – {cert.notAfter.toLocaleDateString("en-IN")}
        </dd>
        <dt>Serial</dt>
        <dd className="font-mono break-all">{cert.serialNumber}</dd>
        <dt>SHA-256</dt>
        <dd className="font-mono break-all">{cert.sha256.match(/.{2}/g)?.join(":")}</dd>
      </dl>
    </div>
  )
}

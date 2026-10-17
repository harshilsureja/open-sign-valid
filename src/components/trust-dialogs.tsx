import { useEffect, useRef, useState } from "react"
import { ShieldCheck, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { addTrusted, listTrusted, removeTrusted, type TrustedCert } from "@/lib/trust"
import type { CertInfo } from "@/lib/verify"

function fingerprint(sha256: string) {
  return sha256.match(/.{2}/g)?.join(":")
}

/** Confirm before trusting a root certificate taken from a signature. */
export function TrustConfirmDialog({
  cert,
  onClose,
  onTrusted,
}: {
  cert: CertInfo | null
  onClose: () => void
  onTrusted: () => void
}) {
  return (
    <Dialog open={!!cert} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Trust this certificate?</DialogTitle>
          <DialogDescription>
            Every signature that chains to this certificate will show as valid in this browser.
            Only continue if you have confirmed the fingerprint with an official source (for
            e-Aadhaar: the CCA India website, cca.gov.in).
          </DialogDescription>
        </DialogHeader>
        {cert && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-lg border bg-muted/30 p-3 text-xs">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{cert.commonName ?? cert.subject}</dd>
            <dt className="text-muted-foreground">Subject</dt>
            <dd className="break-all">{cert.subject}</dd>
            <dt className="text-muted-foreground">Valid</dt>
            <dd>
              {cert.notBefore.toLocaleDateString("en-IN")} –{" "}
              {cert.notAfter.toLocaleDateString("en-IN")}
            </dd>
            <dt className="text-muted-foreground">SHA-256</dt>
            <dd className="font-mono break-all">{fingerprint(cert.sha256)}</dd>
          </dl>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!cert) return
              await addTrusted(cert.der)
              toast.success(`Now trusting ${cert.commonName ?? "certificate"}`)
              onTrusted()
              onClose()
            }}
          >
            <ShieldCheck /> Trust certificate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** List, import and remove trusted root certificates. */
export function TrustManagerDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}) {
  const [certs, setCerts] = useState<TrustedCert[]>([])
  const input = useRef<HTMLInputElement>(null)
  const refresh = () => listTrusted().then(setCerts)

  useEffect(() => {
    if (open) refresh()
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Trusted certificates</DialogTitle>
          <DialogDescription>
            Signatures are shown as valid (green) only when they chain to one of these roots.
            Certificates you add are stored in this browser only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {certs.length === 0 && (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              No trusted certificates yet.
            </p>
          )}
          {certs.map((c) => (
            <div key={c.info.sha256} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-medium">
                  <span className="truncate">{c.info.commonName ?? c.info.subject}</span>
                  <Badge variant="outline">{c.source === "bundled" ? "Built-in" : "Added by you"}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Valid until {c.info.notAfter.toLocaleDateString("en-IN")}
                </div>
                <div className="font-mono text-[10px] break-all text-muted-foreground">
                  {fingerprint(c.info.sha256)}
                </div>
              </div>
              {c.source === "user" && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  onClick={() => {
                    removeTrusted(c.der)
                    refresh()
                    onChanged()
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <input
            ref={input}
            type="file"
            accept=".cer,.crt,.pem,.der"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (!file) return
              try {
                const added = await addTrusted(new Uint8Array(await file.arrayBuffer()))
                toast.success(added ? `Added ${added} certificate(s)` : "Already trusted")
                refresh()
                onChanged()
              } catch {
                toast.error("That file is not a valid certificate (.cer, .crt or .pem).")
              }
            }}
          />
          <Button variant="outline" onClick={() => input.current?.click()}>
            <Upload /> Import certificate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

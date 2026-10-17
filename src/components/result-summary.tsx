import { ChevronDown } from "lucide-react"
import { StatusIcon, statusStyles } from "@/components/status"
import { formatDate } from "@/components/signature-panel"
import { cn } from "@/lib/utils"
import type { VerifyResult } from "@/lib/verify"

/** The result in everyday words: what it means and what to do. */
function explain(result: VerifyResult): { title: string; body: string } {
  const sigs = result.signatures
  const aadhaar = sigs.some((s) => s.isAadhaar)
  const doc = aadhaar ? "e-Aadhaar" : "document"

  switch (result.overall) {
    case "valid":
      return {
        title: aadhaar ? "Genuine e-Aadhaar" : "Genuine document",
        body: aadhaar
          ? "This e-Aadhaar was digitally signed by UIDAI and has not been changed since."
          : `Signed by ${sigs[0]?.signer?.commonName ?? "the signer"}. Nothing has been changed since it was signed.`,
      }
    case "invalid":
      return {
        title: "Not genuine — the document was changed",
        body: `This ${doc} was edited after it was signed, so its contents can't be trusted. Get a fresh copy from the official source${aadhaar ? " (myaadhaar.uidai.gov.in)" : ""}.`,
      }
    case "unsigned":
      return {
        title: "No digital signature found",
        body: "This PDF isn't digitally signed, so it can't be checked. A printed or scanned signature can't be verified.",
      }
    default: {
      if (sigs.some((s) => s.checks.coverage === "fail")) {
        return {
          title: "Changed after signing",
          body: `The signature is real, but something was added to this ${doc} after it was signed. Compare it with the original.`,
        }
      }
      return {
        title: "Signer could not be confirmed",
        body: `The ${doc} hasn't been changed, but the signer isn't on the trusted list, so we can't confirm it's official.`,
      }
    }
  }
}

export function ResultSummary({
  result,
  onShowDetails,
}: {
  result: VerifyResult
  onShowDetails?: () => void
}) {
  const style = statusStyles[result.overall]
  const { title, body } = explain(result)
  const first = result.signatures[0]

  return (
    <section
      aria-live="polite"
      className={cn("flex items-start gap-3 border-b px-4 py-3", style.bg, style.border)}
    >
      <StatusIcon status={result.overall} className="mt-0.5 size-7 sm:size-8" />
      <div className="min-w-0 flex-1">
        <h2 className={cn("text-base font-semibold sm:text-lg", style.text)}>{title}</h2>
        <p className="text-sm text-foreground/80">{body}</p>
        {first?.signingTime && result.overall !== "unsigned" && (
          <p className="mt-1 text-xs text-muted-foreground">
            Signed by {first.signer?.commonName ?? "unknown"} on {formatDate(first.signingTime)}
          </p>
        )}
      </div>
      {onShowDetails && result.signatures.length > 0 && (
        <button
          type="button"
          onClick={onShowDetails}
          className="hidden shrink-0 items-center gap-1 self-center rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-background/60 hover:text-foreground md:flex"
        >
          Details <ChevronDown className="size-3.5 -rotate-90" />
        </button>
      )}
    </section>
  )
}

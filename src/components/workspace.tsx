import { useEffect, useMemo, useRef, useState } from "react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import {
  ArrowLeft,
  Loader2,
  Maximize,
  PanelRight,
  Printer,
  RectangleHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PDF_TO_CSS, PdfViewer, usePageSizes, type PageOverlay } from "@/components/pdf-viewer"
import { PasswordForm } from "@/components/password-form"
import { SignaturePanel } from "@/components/signature-panel"
import { ResultSummary } from "@/components/result-summary"
import { findLayerSets, widgetIsLayered } from "@/lib/appearance"
import { canPrint, findSignatureWidgets, type SignatureWidget } from "@/lib/pdf"
import { printDocument } from "@/lib/print"
import { cn } from "@/lib/utils"
import { signatureObjectForWidget, type CertInfo, type VerifyResult } from "@/lib/verify"

const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]

export interface LoadedFile {
  name: string
  bytes: Uint8Array
  /** What is rendered: `bytes` with icon/title layers blanked (see lib/appearance) */
  display: Uint8Array
  raw: string
  result: VerifyResult
  doc: PDFDocumentProxy | null
  /** Set while the pages are waiting for a password */
  locked?: "needed" | "incorrect"
}

export function Workspace({
  file,
  onClose,
  onUnlock,
  onTrustCertificate,
}: {
  file: LoadedFile
  onClose: () => void
  onUnlock: (password: string) => Promise<void>
  onTrustCertificate: (cert: CertInfo) => void
}) {
  const { result, doc } = file
  const sizes = usePageSizes(doc)
  const scroller = useRef<HTMLDivElement>(null)
  const details = useRef<HTMLElement>(null)
  const [zoom, setZoom] = useState<number | "fit">("fit")
  const [containerWidth, setContainerWidth] = useState(0)
  const [active, setActive] = useState<number | undefined>()
  const [panelOpen, setPanelOpen] = useState(true)
  const [printing, setPrinting] = useState<string | null>(null)
  const [printAllowed, setPrintAllowed] = useState(true)
  const [widgets, setWidgets] = useState<SignatureWidget[]>([])

  useEffect(() => {
    const el = scroller.current
    if (!el) return
    // Measure now too: ResizeObserver can be delayed (e.g. background tabs).
    setContainerWidth(el.clientWidth)
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!doc) return
    canPrint(doc).then(setPrintAllowed)
    findSignatureWidgets(doc).then(setWidgets)
  }, [doc])

  const fitScale = useMemo(() => {
    const widest = Math.max(1, ...sizes.map((s) => s.width))
    // Matches the viewer's p-4 / sm:p-6 (sm = 640px viewport width).
    const padding = typeof window !== "undefined" && window.innerWidth >= 640 ? 48 : 32
    return Math.max(0.25, Math.min(3, (containerWidth - padding) / (widest * PDF_TO_CSS)))
  }, [sizes, containerWidth])
  const scale = zoom === "fit" ? fitScale : zoom

  const overlays = useMemo(
    () => matchOverlays(widgets, result, file.raw),
    [widgets, result, file.raw]
  )

  const step = (dir: 1 | -1) => {
    const next =
      dir === 1 ? ZOOM_STEPS.find((z) => z > scale + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < scale - 0.001)
    if (next) setZoom(next)
  }

  const print = async () => {
    if (!doc) return
    setPrinting("Preparing…")
    try {
      await printDocument(doc, overlays, (done, total) => setPrinting(`Preparing page ${done}/${total}…`))
    } catch {
      toast.error("Could not prepare the document for printing.")
    } finally {
      setPrinting(null)
    }
  }

  // Ctrl+P / ⌘+P prints the document, not this web page.
  const printRef = useRef(print)
  printRef.current = print
  useEffect(() => {
    if (!doc || !printAllowed) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault()
        printRef.current()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [doc, printAllowed])

  // On phones the whole result is one scroll, so jump down to the details.
  const showDetails = () => {
    setPanelOpen(true)
    requestAnimationFrame(() =>
      details.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b bg-background px-2 py-1.5 sm:px-4">
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Check another file">
          <ArrowLeft /> <span className="hidden sm:inline">Check another file</span>
        </Button>
        <span
          className="min-w-0 flex-1 truncate px-1 text-sm text-muted-foreground"
          title={file.name}
        >
          {file.name}
        </span>

        {doc && (
          <div className="hidden items-center gap-0.5 md:flex">
            <ToolButton label="Zoom out" onClick={() => step(-1)}>
              <ZoomOut />
            </ToolButton>
            <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
            <ToolButton label="Zoom in" onClick={() => step(1)}>
              <ZoomIn />
            </ToolButton>
            <ToolButton label="Actual size (100%)" onClick={() => setZoom(1)} active={zoom === 1}>
              <RectangleHorizontal />
            </ToolButton>
            <ToolButton label="Fit to width" onClick={() => setZoom("fit")} active={zoom === "fit"}>
              <Maximize />
            </ToolButton>
            <div className="mx-1 h-5 w-px bg-border" />
          </div>
        )}
        {doc && (
          // Phones get the big Print button in the bottom bar instead.
          <Button
            className="hidden px-4 md:inline-flex"
            onClick={print}
            disabled={!printAllowed || !!printing}
            title={printAllowed ? "Print this document (Ctrl+P)" : "This PDF does not allow printing"}
          >
            {printing ? <Loader2 className="animate-spin" /> : <Printer />} Print
          </Button>
        )}
        <span className="hidden md:inline-flex">
          <ToolButton
            label="Signature details"
            onClick={() => setPanelOpen((o) => !o)}
            active={panelOpen}
          >
            <PanelRight />
          </ToolButton>
        </span>
      </div>

      {printing && (
        <div className="border-b bg-muted px-4 py-1 text-xs text-muted-foreground">{printing}</div>
      )}

      {/* Phones: one scroll (result, document, details). Larger screens: side-by-side panes. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:overflow-hidden">
        <ResultSummary result={result} onShowDetails={showDetails} />

        <div className="flex flex-col md:min-h-0 md:flex-1 md:flex-row">
          <div
            ref={scroller}
            className="min-w-0 overflow-x-auto bg-zinc-200/70 md:flex-1 md:overflow-auto md:[scrollbar-gutter:stable] dark:bg-zinc-900"
          >
            {doc ? (
              <PdfViewer
                doc={doc}
                sizes={sizes}
                scale={scale}
                overlays={overlays}
                activeSignature={active}
                onOverlayClick={(i) => {
                  setActive(i)
                  showDetails()
                }}
              />
            ) : file.locked ? (
              <div className="flex items-center justify-center p-4 sm:p-6 md:min-h-full">
                <PasswordForm incorrect={file.locked === "incorrect"} onSubmit={onUnlock} />
              </div>
            ) : (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground md:min-h-full">
                The pages of this PDF could not be displayed.
              </div>
            )}
          </div>

          <aside
            ref={details}
            className={cn(
              "flex w-full shrink-0 scroll-mt-2 flex-col border-t bg-background md:w-[380px] md:border-t-0 md:border-l",
              !panelOpen && "md:hidden"
            )}
          >
            <div className="flex items-center justify-between border-b px-4 py-2">
              <h2 className="text-sm font-semibold">
                Signature details{" "}
                <span className="font-normal text-muted-foreground">({result.signatures.length})</span>
              </h2>
            </div>
            <div className="md:min-h-0 md:flex-1 md:overflow-y-auto">
              <SignaturePanel
                result={result}
                active={active}
                onSelect={setActive}
                onTrustCertificate={onTrustCertificate}
              />
            </div>
          </aside>
        </div>
      </div>

      {/* Phones: big, always-visible actions at the bottom of the screen. */}
      {doc && (
        <div className="flex gap-2 border-t bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <Button variant="outline" size="lg" className="h-11 flex-1" onClick={onClose}>
            <ArrowLeft /> Check another
          </Button>
          <Button
            size="lg"
            className="h-11 flex-[1.4] text-base"
            onClick={print}
            disabled={!printAllowed || !!printing}
          >
            {printing ? <Loader2 className="animate-spin" /> : <Printer />}
            {printAllowed ? "Print" : "Printing not allowed"}
          </Button>
        </div>
      )}
    </div>
  )
}

function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant={active ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Attach each visible signature widget to the signature it displays. */
function matchOverlays(widgets: SignatureWidget[], result: VerifyResult, raw: string): PageOverlay[] {
  const sigs = result.signatures
  if (!sigs.length) return []
  const sets = findLayerSets(raw)
  return widgets.flatMap((w, i) => {
    const sigObj = w.objectNumber != null ? signatureObjectForWidget(raw, w.objectNumber) : undefined
    const sig =
      sigs.find((s) => sigObj != null && s.objectNumber === sigObj) ??
      (sigs.length === 1 ? sigs[0] : widgets.length === sigs.length ? sigs[i] : undefined)
    if (!sig) return []
    return [
      {
        pageIndex: w.pageIndex,
        rect: w.rect,
        status: sig.status,
        signatureIndex: sig.index,
        label: `${sig.headline} — ${sig.signer?.commonName ?? "signer"}`,
        stamp: { status: sig.status },
        // Only layered appearances get an Adobe-style icon + title; anything
        // else is left exactly as signed.
        layered:
          (w.objectNumber != null && widgetIsLayered(raw, w.objectNumber, sets)) ||
          (sets.length === 1 && widgets.length === 1),
      },
    ]
  })
}

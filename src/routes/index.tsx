import { useCallback, useEffect, useRef, useState } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import { ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { GitHubIcon, REPO_URL, Wordmark } from "@/components/brand"
import { Landing } from "@/components/landing"
import { ThemeToggle } from "@/components/theme-toggle"
import { TrustConfirmDialog, TrustManagerDialog } from "@/components/trust-dialogs"
import { Button } from "@/components/ui/button"
import { Workspace, type LoadedFile } from "@/components/workspace"
import { displayCopy } from "@/lib/appearance"
import { openPdf } from "@/lib/pdf"
import { trustedDers } from "@/lib/trust"
import { toBinaryString, verifyPdf, type CertInfo } from "@/lib/verify"

export const Route = createFileRoute("/")({ component: App })

declare module "@tanstack/react-router" {
  interface HistoryState {
    /** Set on the history entry pushed when a file is opened (same URL). */
    viewer?: boolean
  }
}

const MAX_SIZE = 100 * 1024 * 1024

function App() {
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [loading, setLoading] = useState(false)
  const [trustCandidate, setTrustCandidate] = useState<CertInfo | null>(null)
  const [trustManagerOpen, setTrustManagerOpen] = useState(false)

  // Opening a file adds a history entry (same URL, flagged "viewer"), so the
  // phone/browser Back button closes the viewer instead of leaving the site.
  const router = useRouter()
  const onViewerEntry = () => !!(window.history.state as { viewer?: boolean } | null)?.viewer
  const fileRef = useRef(file)
  fileRef.current = file

  const handleFile = useCallback(async (f: File) => {
    if (f.size > MAX_SIZE) return toast.error("That file is larger than 100 MB.")
    setLoading(true)
    try {
      const bytes = new Uint8Array(await f.arrayBuffer())
      const raw = toBinaryString(bytes)
      if (!raw.slice(0, 1024).includes("%PDF-")) {
        toast.error("That doesn't look like a PDF file.")
        return
      }
      const result = await verifyPdf(bytes, { trustedCertificates: trustedDers() })
      // Verify the original; render a copy with only the icon/title layers blanked.
      const display = displayCopy(bytes, raw)
      const opened = await openPdf(display)
      if (opened.kind === "error") toast.error(`The pages could not be displayed: ${opened.message}`)
      setFile({
        name: f.name,
        bytes,
        display,
        raw,
        result,
        doc: opened.kind === "ok" ? opened.doc : null,
        locked: opened.kind === "password" ? "needed" : undefined,
      })
      if (!onViewerEntry()) {
        const { pathname, search, hash } = router.history.location
        router.history.push(pathname + search + hash, { viewer: true })
      }
    } catch (e) {
      console.error(e)
      toast.error("Something went wrong while reading this file.")
    } finally {
      setLoading(false)
    }
  }, [router])

  const unlock = async (pw: string) => {
    if (!file) return
    const opened = await openPdf(file.display, pw)
    if (opened.kind === "ok") {
      setFile({ ...file, doc: opened.doc, locked: undefined })
    } else if (opened.kind === "password") {
      setFile({ ...file, locked: "incorrect" })
    } else {
      toast.error(opened.message)
    }
  }

  const reverify = async () => {
    if (!file) return
    const result = await verifyPdf(file.bytes, { trustedCertificates: trustedDers() })
    setFile((f) => (f ? { ...f, result } : f))
  }

  const closeNow = () => {
    fileRef.current?.doc?.loadingTask.destroy()
    setFile(null)
  }

  // Closing goes "back", so the history stays in step with what is shown.
  const close = () => (onViewerEntry() ? router.history.back() : closeNow())

  // Back (or close above) left the viewer entry: return to the landing page.
  const hasFile = !!file
  useEffect(() => {
    if (!hasFile) return
    const onPop = () => {
      if (!onViewerEntry()) closeNow()
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [hasFile])

  return (
    <div
      className="flex h-svh flex-col"
      onDragOver={(e) => file && e.preventDefault()}
      onDrop={(e) => {
        if (!file) return
        e.preventDefault()
        const dropped = e.dataTransfer.files[0]
        if (dropped) {
          // Replace the file but keep the viewer history entry.
          closeNow()
          handleFile(dropped)
        }
      }}
    >
      <header className="flex items-center gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
        <button type="button" onClick={close} aria-label="Home">
          <Wordmark />
        </button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTrustManagerOpen(true)}
          aria-label="Trusted certificates"
        >
          <ShieldCheck /> <span className="hidden sm:inline">Trusted certificates</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="hidden sm:inline-flex"
          aria-label="Source code on GitHub"
          title="Source code on GitHub"
          nativeButton={false}
          render={<a href={REPO_URL} target="_blank" rel="noreferrer" />}
        >
          <GitHubIcon />
        </Button>
        <ThemeToggle />
      </header>

      {file ? (
        <Workspace
          file={file}
          onClose={close}
          onUnlock={unlock}
          onTrustCertificate={setTrustCandidate}
        />
      ) : (
        <main className="flex-1 overflow-y-auto">
          <Landing loading={loading} onFile={handleFile} />
        </main>
      )}

      <TrustConfirmDialog
        cert={trustCandidate}
        onClose={() => setTrustCandidate(null)}
        onTrusted={reverify}
      />
      <TrustManagerDialog
        open={trustManagerOpen}
        onOpenChange={setTrustManagerOpen}
        onChanged={reverify}
      />
    </div>
  )
}

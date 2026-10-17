import { useRef, useState } from "react"
import {
  CircleCheck,
  CircleX,
  Code,
  FileUp,
  KeyRound,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  WifiOff,
} from "lucide-react"
import { APP_NAME, GitHubIcon, REPO_URL } from "@/components/brand"
import { FaqSection, StandardsSection } from "@/components/standards-faq"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function Landing({
  loading,
  onFile,
}: {
  loading: boolean
  onFile: (file: File) => void
}) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-8 sm:gap-16 sm:py-14">
      <section className="flex flex-col items-center gap-5 text-center sm:gap-6">
        <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Free · Private · Secure
        </span>
        <h1 className="max-w-3xl text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          Is your <span className="whitespace-nowrap">e-Aadhaar</span>{" "}
          <span className="text-indigo-600 dark:text-indigo-400">genuine</span>?
        </h1>
        <p className="max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
          Open your e-Aadhaar PDF and see in seconds if it is real and unchanged — the same check
          Adobe Reader does, with a green tick or a red cross.
        </p>
        <DropZone loading={loading} onFile={onFile} />
        <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-1.5">
            <ShieldCheck className="size-4" /> No upload, no sign-up
          </li>
          <li className="flex items-center gap-1.5">
            <WifiOff className="size-4" /> Works offline
          </li>
          <li className="flex items-center gap-1.5">
            <Code className="size-4" /> Open source
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-center text-xl font-semibold">How it works</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          <Step
            n={1}
            icon={<FileUp className="size-5" />}
            title="Choose your PDF"
            text="Pick the e-Aadhaar PDF you downloaded from myaadhaar.uidai.gov.in, or any signed PDF."
          />
          <Step
            n={2}
            icon={<KeyRound className="size-5" />}
            title="Enter the password"
            text="Only if asked. For e-Aadhaar: first 4 letters of the name in CAPITALS + year of birth."
          />
          <Step
            n={3}
            icon={<CircleCheck className="size-5" />}
            title="Read the result"
            text="Green tick means genuine. A red cross means the file was changed — don't trust it."
          />
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-center text-xl font-semibold">What the result means</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Legend
            icon={<CircleCheck className="size-6 text-emerald-600" />}
            title="Green tick — genuine"
            text="Signed by a trusted authority (like UIDAI) and not changed since."
          />
          <Legend
            icon={<TriangleAlert className="size-6 text-amber-500" />}
            title="Yellow — be careful"
            text="Not changed, but we couldn't confirm who signed it, or something was added later."
          />
          <Legend
            icon={<CircleX className="size-6 text-red-600" />}
            title="Red cross — not genuine"
            text="The file was edited after signing. Get a fresh copy from the official source."
          />
        </div>
      </section>

      <StandardsSection />

      <FaqSection />

      <footer className="flex flex-col items-center gap-2 border-t pt-6 text-center text-xs text-muted-foreground">
        <p>
          {APP_NAME} is an independent open-source project and is not affiliated with UIDAI or
          the Government of India. Results are informational; revocation status is not checked
          offline.
        </p>
        <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
          <span>Licensed under Apache-2.0</span>
          <a
            className="inline-flex items-center gap-1 underline"
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon className="size-3.5" /> Source code on GitHub
          </a>
          <a className="underline" href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
            Report a problem
          </a>
        </p>
      </footer>
    </div>
  )
}

function Legend({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-5">
      {icon}
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  )
}

function Step({
  n,
  icon,
  title,
  text,
}: {
  n: number
  icon: React.ReactNode
  title: string
  text: string
}) {
  return (
    <li className="flex gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold">
          <span className="text-muted-foreground">{n}.</span> {title}
        </h3>
        <p className="text-sm text-muted-foreground">{text}</p>
      </div>
    </li>
  )
}

export function DropZone({
  loading,
  onFile,
}: {
  loading: boolean
  onFile: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !loading && input.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !loading) {
          e.preventDefault()
          input.current?.click()
        }
      }}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const file = e.dataTransfer.files[0]
        if (file && !loading) onFile(file)
      }}
      className={cn(
        "flex w-full max-w-2xl cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-card px-6 py-8 transition-colors outline-none hover:border-primary/60 focus-visible:border-primary sm:py-12",
        over && "border-primary bg-primary/5"
      )}
    >
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (file) onFile(file)
        }}
      />
      {loading ? (
        <Loader2 className="size-10 animate-spin text-primary" />
      ) : (
        <FileUp className="size-10 text-primary" />
      )}
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium">
          {loading ? (
            "Checking signature…"
          ) : (
            <>
              <span className="sm:hidden">Tap to choose your e-Aadhaar PDF</span>
              <span className="hidden sm:inline">Drop your e-Aadhaar or signed PDF here</span>
            </>
          )}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="hidden sm:inline">or click to choose a file — </span>it stays on this
          device and is never uploaded
        </p>
      </div>
      <Button size="lg" disabled={loading} tabIndex={-1} className="h-11 px-6 text-base">
        <FileUp /> Choose PDF
      </Button>
    </div>
  )
}

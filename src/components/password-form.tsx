import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Shown in place of the pages when the PDF needs a password to open. */
export function PasswordForm({
  incorrect,
  onSubmit,
}: {
  incorrect: boolean
  onSubmit: (password: string) => Promise<void>
}) {
  const [value, setValue] = useState("")
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  // Read-only until mounted so the browser can't pre-fill a saved password.
  const [ready, setReady] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const id = setTimeout(() => setReady(true), 50)
    return () => clearTimeout(id)
  }, [])

  // Focus the field when it becomes editable, and again after a wrong password.
  useEffect(() => {
    if (!ready) return
    input.current?.focus()
    if (incorrect) input.current?.select()
  }, [ready, incorrect])

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!value || busy) return
        setBusy(true)
        try {
          await onSubmit(value)
        } finally {
          setBusy(false)
          // Still mounted means the password was wrong: ready it for retyping.
          input.current?.focus()
          input.current?.select()
        }
      }}
      className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 text-left shadow-sm"
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <LockKeyhole className="size-6 text-muted-foreground" />
        </span>
        <h2 className="text-lg font-semibold">This PDF is password protected</h2>
        <p className="text-sm text-muted-foreground">
          The signature is already verified. Enter the password to view and print the pages —
          it never leaves this device.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <Input
            ref={input}
            readOnly={!ready}
            name="pdf-open-password"
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="PDF password"
            aria-label="PDF password"
            aria-invalid={incorrect || undefined}
            autoComplete="new-password"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            spellCheck={false}
            className="h-10 pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="absolute inset-y-0 right-1.5 my-auto"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff /> : <Eye />}
          </Button>
        </div>
        {incorrect && (
          <p className="text-sm text-destructive">Incorrect password, please try again.</p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={!value || busy}>
        {busy && <Loader2 className="animate-spin" />} Open document
      </Button>

      <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">e-Aadhaar:</span> first 4 letters of the
        name in CAPITALS + year of birth, e.g.{" "}
        <code className="font-mono text-foreground">ABCD1990</code>
      </p>
    </form>
  )
}

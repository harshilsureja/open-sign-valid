import { cn } from "@/lib/utils"

export const APP_NAME = "Open Sign Valid"
export const APP_TAGLINE = "Verify Aadhaar & signed PDFs — privately"
export const REPO_URL = "https://github.com/harshil-at/open-sign-valid"

/** GitHub mark (lucide no longer ships brand icons). */
export function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden="true" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

/** Shield + signed page + check mark. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 2.2 27 6.4v8.4c0 7-4.6 12.6-11 15-6.4-2.4-11-8-11-15V6.4L16 2.2Z"
        fill="#2563eb"
      />
      <path d="M11 9.5h7l3 3V20a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V10.5a1 1 0 0 1 1-1Z" fill="#fff" opacity=".95" />
      <path d="M18 9.5v3h3" fill="none" stroke="#c7d2fe" strokeWidth="1" />
      <path d="M12.3 13.4h4M12.3 15.4h2.6" stroke="#a5b4fc" strokeWidth="1" strokeLinecap="round" />
      <circle cx="20.5" cy="20.5" r="4.6" fill="#16a34a" stroke="#fff" strokeWidth="1.4" />
      <path
        d="m18.5 20.6 1.4 1.4 2.7-2.9"
        fill="none"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <Logo className="size-7" />
      <span className="text-base font-semibold tracking-tight">{APP_NAME}</span>
    </span>
  )
}

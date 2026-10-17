import { CircleCheck, CircleHelp, CircleX, FileQuestion, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import type { OverallStatus } from "@/lib/verify"

export const statusStyles: Record<
  OverallStatus,
  { text: string; bg: string; border: string; ring: string; label: string }
> = {
  valid: {
    text: "text-emerald-700 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-900",
    ring: "ring-emerald-500",
    label: "Valid",
  },
  unknown: {
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900",
    ring: "ring-amber-500",
    label: "Needs attention",
  },
  invalid: {
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    border: "border-red-200 dark:border-red-900",
    ring: "ring-red-500",
    label: "Invalid",
  },
  unsigned: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    ring: "ring-border",
    label: "Not signed",
  },
}

/** Adobe-style green tick / yellow warning / red cross. */
export function StatusIcon({
  status,
  className,
}: {
  status: OverallStatus
  className?: string
}) {
  const cls = cn("shrink-0", statusStyles[status].text, className)
  switch (status) {
    case "valid":
      return <CircleCheck className={cls} aria-label="Valid" />
    case "unknown":
      return <TriangleAlert className={cls} aria-label="Needs attention" />
    case "invalid":
      return <CircleX className={cls} aria-label="Invalid" />
    default:
      return <FileQuestion className={cls} aria-label="Not signed" />
  }
}

/** Solid round badge drawn over signature fields on the page. */
export function StatusBadge({ status }: { status: OverallStatus }) {
  const bg = {
    valid: "bg-emerald-600",
    unknown: "bg-amber-500",
    invalid: "bg-red-600",
    unsigned: "bg-zinc-500",
  }[status]
  const Icon = { valid: CircleCheck, unknown: CircleHelp, invalid: CircleX, unsigned: CircleHelp }[
    status
  ]
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full text-white shadow-md ring-2 ring-white",
        bg
      )}
    >
      <Icon className="size-4" strokeWidth={2.5} />
    </span>
  )
}

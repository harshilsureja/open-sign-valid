import {
  BadgeCheck,
  ChevronDown,
  Clock,
  Code,
  FileBadge,
  Gavel,
  GlobeLock,
  Landmark,
  LockKeyhole,
} from "lucide-react"
import { APP_NAME, REPO_URL } from "@/components/brand"

interface Badge {
  icon: React.ReactNode
  title: string
  text: string
}

const INDIA: Badge[] = [
  {
    icon: <Gavel className="size-5" />,
    title: "IT Act, 2000",
    text: "Checks digital signatures as recognised under India's Information Technology Act.",
  },
  {
    icon: <Landmark className="size-5" />,
    title: "CCA India root",
    text: "Signers are traced back to the official Root Certifying Authority of India (CCA).",
  },
  {
    icon: <LockKeyhole className="size-5" />,
    title: "DPDP Act, 2023",
    text: "Privacy by design: no personal data is collected, stored or shared.",
  },
]

const WORLDWIDE: Badge[] = [
  {
    icon: <FileBadge className="size-5" />,
    title: "PAdES · ISO 32000",
    text: "Reads PDF signatures the standard way (ETSI EN 319 142, ISO 32000).",
  },
  {
    icon: <BadgeCheck className="size-5" />,
    title: "CMS · X.509",
    text: "Cryptographic checks follow RFC 5652 (PKCS#7) and RFC 5280 certificates.",
  },
  {
    icon: <Clock className="size-5" />,
    title: "RFC 3161 timestamps",
    text: "Trusted timestamps are verified whenever the signature includes one.",
  },
  {
    icon: <GlobeLock className="size-5" />,
    title: "GDPR friendly",
    text: "No cookies, tracking or analytics. Your file never leaves the browser.",
  },
  {
    icon: <Code className="size-5" />,
    title: "Open source",
    text: "Apache-2.0 licensed — anyone can read and audit the code.",
  },
]

function BadgeCard({ badge }: { badge: Badge }) {
  return (
    <li className="flex gap-3 rounded-xl border bg-card p-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {badge.icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h4 className="font-semibold">{badge.title}</h4>
        <p className="text-sm text-muted-foreground">{badge.text}</p>
      </div>
    </li>
  )
}

export function StandardsSection() {
  return (
    <section className="flex flex-col gap-6" aria-labelledby="standards-heading">
      <div className="flex flex-col gap-2 text-center">
        <h2 id="standards-heading" className="text-xl font-semibold">
          Built on trusted standards
        </h2>
        <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
          The laws and open standards {APP_NAME}'s verification follows, in India and worldwide.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          India
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INDIA.map((b) => (
            <BadgeCard key={b.title} badge={b} />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          Worldwide
        </h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {WORLDWIDE.map((b) => (
            <BadgeCard key={b.title} badge={b} />
          ))}
        </ul>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        These are standards the tool implements, not certifications. {APP_NAME} is not certified
        by, or affiliated with, UIDAI, CCA or any government body.
      </p>
    </section>
  )
}

/** `text` is the plain version used for search-engine structured data. */
export const FAQS: Array<{ q: string; a: React.ReactNode; text: string }> = [
  {
    q: "Is my e‑Aadhaar uploaded anywhere?",
    text: "No. The file is read and checked entirely inside your browser on your own device. Nothing is sent to any server — the site even works offline once it has loaded.",
    a: (
      <>
        No. The file is read and checked entirely inside your browser on your own device. Nothing
        is sent to any server — the site even works with the internet switched off once it has
        loaded.
      </>
    ),
  },
  {
    q: "What is the password of my e‑Aadhaar PDF?",
    text: "The first 4 letters of your name (as printed on the Aadhaar) in CAPITAL letters, followed by your year of birth — for example SURE1990. The password is only needed to view the pages; the signature is checked without it.",
    a: (
      <>
        The first 4 letters of your name (as printed on the Aadhaar) in CAPITAL letters, followed
        by your year of birth. For example, name <em>Suresh Kumar</em> born in 1990 →{" "}
        <code className="font-mono text-foreground">SURE1990</code>. The password is only needed
        to view the pages; the signature is checked without it.
      </>
    ),
  },
  {
    q: "What do the green, yellow and red results mean?",
    text: "Green tick: genuine — signed by a trusted authority like UIDAI and not changed since. Yellow: the file is unchanged but the signer could not be confirmed, or something was added after signing. Red cross: not genuine — the file was edited after it was signed.",
    a: (
      <>
        <strong>Green tick</strong>: genuine — signed by a trusted authority (like UIDAI) and not
        changed since. <strong>Yellow</strong>: be careful — the file is unchanged but the signer
        couldn't be confirmed, or something was added after signing. <strong>Red cross</strong>:
        not genuine — the file was edited after it was signed.
      </>
    ),
  },
  {
    q: "Why does my e‑Aadhaar say “Signature Not Verified” in other apps?",
    text: "That text and question mark are a picture stored inside the PDF. Most phone and browser PDF viewers cannot check signatures, so they show that picture. Open Sign Valid checks the signature and shows the real result, like Adobe Reader.",
    a: (
      <>
        That text and question mark are a picture stored inside the PDF. Most phone and browser
        PDF viewers can't check signatures, so they just show that picture. {APP_NAME} actually
        checks the signature and shows the real result, like Adobe Reader does.
      </>
    ),
  },
  {
    q: "Is a verified e‑Aadhaar valid like the original?",
    text: "UIDAI states that an e-Aadhaar downloaded from its website is as valid as the physical Aadhaar letter. A green tick confirms the file is the one UIDAI signed and has not been edited.",
    a: (
      <>
        UIDAI states that an e-Aadhaar downloaded from its website is as valid as the physical
        Aadhaar letter. A green tick here confirms the file is the one UIDAI signed and has not
        been edited.
      </>
    ),
  },
  {
    q: "Which other documents can I check?",
    text: "Any PDF with a standard digital signature: DigiLocker documents, eSign agreements, GST and income-tax certificates, invoices and contracts. A scanned signature image is not a digital signature and cannot be verified.",
    a: (
      <>
        Any PDF with a standard digital signature: DigiLocker documents, eSign agreements, GST
        and income-tax certificates, invoices and contracts. A scanned or hand-drawn signature
        image is not a digital signature and can't be verified.
      </>
    ),
  },
  {
    q: "Does it work on mobile?",
    text: "Yes. Open the site on your phone, tap Choose PDF and pick your e-Aadhaar from Downloads or Files. You can also print from your phone.",
    a: (
      <>
        Yes. Open this site on your phone, tap <strong>Choose PDF</strong> and pick your
        e-Aadhaar from Downloads or Files. You can also print from your phone.
      </>
    ),
  },
  {
    q: "Is this an official UIDAI or government website?",
    text: "No. Open Sign Valid is an independent, free, open-source project. It uses the official CCA India root certificates published at cca.gov.in to confirm signers.",
    a: (
      <>
        No. {APP_NAME} is an independent, free, open-source project. It uses the official
        CCA India root certificates published at cca.gov.in to confirm signers.
      </>
    ),
  },
  {
    q: "Does it check if a certificate was revoked?",
    text: "Not yet. Revocation lists (OCSP/CRL) need a request to the issuing authority, which browsers usually block. This is planned as an optional feature.",
    a: (
      <>
        Not yet. Revocation lists (OCSP/CRL) need an internet request to the issuing authority,
        which browsers usually block. This is planned as an optional feature.
      </>
    ),
  },
  {
    q: "Is it free? Can I see the code?",
    text: "Yes, it is completely free and open source under the Apache-2.0 licence, and the code is on GitHub.",
    a: (
      <>
        Yes, it's completely free and open source under the Apache-2.0 licence. The code is on{" "}
        <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        .
      </>
    ),
  },
]

export function FaqSection() {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-center text-xl font-semibold">
        Frequently asked questions
      </h2>
      <div className="mx-auto flex w-full max-w-3xl flex-col divide-y rounded-xl border bg-card">
        {FAQS.map(({ q, a }) => (
          <details key={q} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 font-medium select-none hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
              {q}
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground">{a}</div>
          </details>
        ))}
      </div>
    </section>
  )
}

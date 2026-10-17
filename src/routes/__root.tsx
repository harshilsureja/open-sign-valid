import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router"
import { ThemeProvider } from "next-themes"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { APP_NAME, REPO_URL } from "@/components/brand"
import { FAQS } from "@/components/standards-faq"
import { SEO, SITE_URL, asset } from "@/lib/site"

import appCss from "../styles.css?url"

// In production nothing may be fetched from, or sent to, any other host.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join("; ")

const CANONICAL = `${SITE_URL}/`

// Structured data: lets search engines show the app and its FAQ as rich results.
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: APP_NAME,
    url: CANONICAL,
    description: SEO.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (web browser)",
    browserRequirements: "Requires a modern web browser with JavaScript",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
    image: SEO.image,
    inLanguage: "en-IN",
    license: "https://www.apache.org/licenses/LICENSE-2.0",
    codeRepository: REPO_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.text },
    })),
  },
]

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: SEO.title },
      { name: "description", content: SEO.description },
      { name: "keywords", content: SEO.keywords },
      { name: "robots", content: "index, follow" },
      { name: "application-name", content: APP_NAME },
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "theme-color", content: "#2563eb" },

      // Open Graph (WhatsApp, Facebook, LinkedIn, Slack, Telegram…)
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: APP_NAME },
      { property: "og:locale", content: "en_IN" },
      { property: "og:url", content: CANONICAL },
      { property: "og:title", content: SEO.title },
      { property: "og:description", content: SEO.description },
      { property: "og:image", content: SEO.image },
      { property: "og:image:secure_url", content: SEO.image },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: SEO.imageAlt },

      // X / Twitter
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: SEO.title },
      { name: "twitter:description", content: SEO.description },
      { name: "twitter:image", content: SEO.image },
      { name: "twitter:image:alt", content: SEO.imageAlt },

      ...(import.meta.env.PROD ? [{ httpEquiv: "Content-Security-Policy", content: CSP }] : []),
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "canonical", href: CANONICAL },
      { rel: "icon", href: asset("favicon.svg"), type: "image/svg+xml" },
      { rel: "apple-touch-icon", href: asset("apple-touch-icon.png") },
      { rel: "manifest", href: asset("manifest.json") },
    ],
    scripts: JSON_LD.map((data) => ({
      type: "application/ld+json",
      children: JSON.stringify(data),
    })),
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1 className="text-xl font-semibold">404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="bottom-center" />
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  )
}

import type { PDFDocumentProxy } from "pdfjs-dist"

type Pdfjs = typeof import("pdfjs-dist")

let pdfjsPromise: Promise<Pdfjs> | null = null

/** pdf.js touches browser globals, so it is only ever loaded on the client. */
export function loadPdfjs(): Promise<Pdfjs> {
  pdfjsPromise ??= (async () => {
    const pdfjs = await import("pdfjs-dist")
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    return pdfjs
  })()
  return pdfjsPromise
}

export type OpenResult =
  | { kind: "ok"; doc: PDFDocumentProxy }
  | { kind: "password"; incorrect: boolean }
  | { kind: "error"; message: string }

export async function openPdf(bytes: Uint8Array, password?: string): Promise<OpenResult> {
  const pdfjs = await loadPdfjs()
  const base = `${import.meta.env.BASE_URL}pdfjs/`
  const task = pdfjs.getDocument({
    // pdf.js transfers the buffer to its worker; keep our copy intact.
    data: bytes.slice(),
    password,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
    iccUrl: `${base}iccs/`,
    enableXfa: false,
  })
  try {
    return { kind: "ok", doc: await task.promise }
  } catch (e) {
    if (e instanceof pdfjs.PasswordException) {
      return {
        kind: "password",
        incorrect: e.code === pdfjs.PasswordResponses.INCORRECT_PASSWORD,
      }
    }
    return { kind: "error", message: e instanceof Error ? e.message : String(e) }
  }
}

export async function canPrint(doc: PDFDocumentProxy): Promise<boolean> {
  const pdfjs = await loadPdfjs()
  const perms = await doc.getPermissions()
  return !perms || perms.has(pdfjs.PermissionFlag.PRINT)
}

export interface SignatureWidget {
  pageIndex: number
  /** PDF user-space rectangle [x1, y1, x2, y2] */
  rect: [number, number, number, number]
  /** Object number of the widget annotation, e.g. 12 for "12R" */
  objectNumber?: number
  fieldName?: string
}

/** Collect visible signature-field widgets from every page. */
export async function findSignatureWidgets(doc: PDFDocumentProxy): Promise<SignatureWidget[]> {
  const widgets: SignatureWidget[] = []
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const annotations = await page.getAnnotations()
    for (const a of annotations) {
      if (a.fieldType !== "Sig" || !Array.isArray(a.rect)) continue
      const [x1, y1, x2, y2] = a.rect as number[]
      if (Math.abs(x2 - x1) < 1 || Math.abs(y2 - y1) < 1) continue
      const obj = /^(\d+)R$/.exec(String(a.id ?? ""))
      widgets.push({
        pageIndex: i,
        rect: [x1, y1, x2, y2],
        objectNumber: obj ? Number(obj[1]) : undefined,
        fieldName: a.fieldName,
      })
    }
  }
  return widgets
}

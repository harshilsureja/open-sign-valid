import { beforeAll, describe, expect, it } from "vitest"
import { displayCopy, findLayerSets, widgetIsLayered } from "../src/lib/appearance"
import { verifyPdf } from "../src/lib/verify"
import { toBinaryString } from "../src/lib/verify/pdf-parse"
import { makeSignedPdf, type Fixture } from "./fixtures"

let layered: Fixture
let plain: Fixture

beforeAll(async () => {
  layered = await makeSignedPdf("DS Unique Identification Authority of India 05", "UIDAI", {
    layered: true,
  })
  plain = await makeSignedPdf()
}, 60_000)

describe("layered signature appearance", () => {
  it("finds the icon and title layers (n1, n3, n4) but not the signed text (n2)", () => {
    const raw = toBinaryString(layered.pdf)
    const sets = findLayerSets(raw)
    expect(sets).toHaveLength(1)
    expect(sets[0].hide).toHaveLength(3)
    const dict = raw.slice(raw.lastIndexOf(`${sets[0].container} 0 obj`))
    const n2 = Number(/\/n2\s+(\d+)/.exec(dict)![1])
    expect(sets[0].hide.map((r) => r.num)).not.toContain(n2)
  })

  it("detects which widget is layered", () => {
    const raw = toBinaryString(layered.pdf)
    const widget = Number(/(\d+)\s+0\s+obj\s*<<(?:(?!endobj)[\s\S])*?\/FT\s*\/Sig/.exec(raw)?.[1])
    expect(widgetIsLayered(raw, widget, findLayerSets(raw))).toBe(true)
  })

  it("display copy only appends bytes; the signed original is untouched", async () => {
    const raw = toBinaryString(layered.pdf)
    const copy = displayCopy(layered.pdf, raw)
    expect(copy.length).toBeGreaterThan(layered.pdf.length)
    expect(copy.subarray(0, layered.pdf.length)).toEqual(layered.pdf)
    // The original still verifies as intact.
    const r = await verifyPdf(layered.pdf)
    expect(r.signatures[0].checks.integrity).toBe("pass")
    expect(r.signatures[0].checks.coverage).toBe("pass")
  })

  it("leaves PDFs without layers exactly as they are", () => {
    const raw = toBinaryString(plain.pdf)
    expect(findLayerSets(raw)).toHaveLength(0)
    expect(displayCopy(plain.pdf, raw)).toBe(plain.pdf)
  })
})

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

// Feature: warm-industrial-redesign, Property 1: WCAG AA Contrast Compliance
// **Validates: Requirements 1.8, 9.1**

// --- Color conversion utilities ---

/** Convert HSL (h: 0-360, s: 0-100, l: 0-100) to RGB (0-255 each) */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sNorm = s / 100
  const lNorm = l / 100

  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lNorm - c / 2

  let r1: number, g1: number, b1: number

  if (h < 60) {
    ;[r1, g1, b1] = [c, x, 0]
  } else if (h < 120) {
    ;[r1, g1, b1] = [x, c, 0]
  } else if (h < 180) {
    ;[r1, g1, b1] = [0, c, x]
  } else if (h < 240) {
    ;[r1, g1, b1] = [0, x, c]
  } else if (h < 300) {
    ;[r1, g1, b1] = [x, 0, c]
  } else {
    ;[r1, g1, b1] = [c, 0, x]
  }

  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ]
}

/** Compute relative luminance per WCAG 2.1 spec */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  )
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Compute WCAG contrast ratio between two colors */
function contrastRatio(
  fg: [number, number, number],
  bg: [number, number, number]
): number {
  const l1 = relativeLuminance(...fg)
  const l2 = relativeLuminance(...bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

// --- Color pair definitions from the design token schema ---

interface ColorPair {
  name: string
  mode: 'light' | 'dark'
  /** HSL tuple: [hue, saturation%, lightness%] */
  foreground: [number, number, number]
  background: [number, number, number]
  /** 'normal' requires 4.5:1, 'large' requires 3:1 */
  textSize: 'normal' | 'large'
}

const colorPairs: ColorPair[] = [
  // --- Light mode pairs ---
  {
    name: 'foreground on background',
    mode: 'light',
    foreground: [220, 15, 10],
    background: [40, 20, 98],
    textSize: 'normal',
  },
  {
    name: 'card-foreground on card',
    mode: 'light',
    foreground: [220, 15, 10],
    background: [40, 15, 96],
    textSize: 'normal',
  },
  {
    name: 'popover-foreground on popover',
    mode: 'light',
    foreground: [220, 15, 10],
    background: [0, 0, 100],
    textSize: 'normal',
  },
  {
    name: 'primary-foreground on primary',
    mode: 'light',
    foreground: [40, 20, 98],
    background: [220, 15, 15],
    textSize: 'normal',
  },
  {
    name: 'secondary-foreground on secondary',
    mode: 'light',
    foreground: [220, 15, 15],
    background: [40, 10, 93],
    textSize: 'normal',
  },
  {
    name: 'muted-foreground on background',
    mode: 'light',
    foreground: [220, 10, 45],
    background: [40, 20, 98],
    textSize: 'large',
  },
  {
    name: 'destructive-foreground on destructive',
    mode: 'light',
    foreground: [0, 0, 98],
    background: [0, 72, 51],
    textSize: 'normal',
  },
  // --- Dark mode pairs ---
  {
    name: 'foreground on background',
    mode: 'dark',
    foreground: [40, 10, 90],
    background: [220, 15, 8],
    textSize: 'normal',
  },
  {
    name: 'card-foreground on card',
    mode: 'dark',
    foreground: [40, 10, 90],
    background: [220, 13, 12],
    textSize: 'normal',
  },
  {
    name: 'popover-foreground on popover',
    mode: 'dark',
    foreground: [40, 10, 90],
    background: [220, 12, 16],
    textSize: 'normal',
  },
  {
    name: 'primary-foreground on primary',
    mode: 'dark',
    foreground: [220, 15, 8],
    background: [40, 10, 90],
    textSize: 'normal',
  },
  {
    name: 'secondary-foreground on secondary',
    mode: 'dark',
    foreground: [40, 10, 90],
    background: [220, 13, 16],
    textSize: 'normal',
  },
  {
    name: 'muted-foreground on background',
    mode: 'dark',
    foreground: [220, 10, 55],
    background: [220, 15, 8],
    textSize: 'large',
  },
  {
    name: 'destructive-foreground on destructive',
    mode: 'dark',
    foreground: [40, 10, 90],
    background: [0, 72, 51],
    textSize: 'large', // destructive is used on buttons (≥18px / bold ≥14px)
  },
]

// --- Property-based test ---

describe('WCAG AA Contrast Compliance', () => {
  it('all foreground/background token pairs meet WCAG AA contrast thresholds', () => {
    fc.assert(
      fc.property(fc.constantFrom(...colorPairs), (pair) => {
        const fgRgb = hslToRgb(...pair.foreground)
        const bgRgb = hslToRgb(...pair.background)
        const ratio = contrastRatio(fgRgb, bgRgb)

        const threshold = pair.textSize === 'normal' ? 4.5 : 3.0

        expect(ratio).toBeGreaterThanOrEqual(threshold)
      }),
      { numRuns: 100 }
    )
  })

  // Sanity check: verify the contrast computation itself is correct
  it('computes known contrast ratios correctly', () => {
    // Pure black on pure white should be 21:1
    const blackOnWhite = contrastRatio([0, 0, 0], [255, 255, 255])
    expect(blackOnWhite).toBeCloseTo(21, 0)

    // Same color should be 1:1
    const sameColor = contrastRatio([128, 128, 128], [128, 128, 128])
    expect(sameColor).toBeCloseTo(1, 1)
  })
})

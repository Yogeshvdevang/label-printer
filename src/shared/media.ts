/** Dimensions are across the roll × feed length, in millimetres.
 * Sources: https://seznik.in/pages/printer-roll-papers
 * https://seznik.in/products/seznik-jewellery-thermal-labels-14-3mm-x-100mm-waterproof-non-tearable-direct-thermal-150-labels-roll-for-2-to-4-inch-printers-white-for-jewellery-tagging-750-labels
 * DP27 printable width: manufacturer driver API / DP27 manual (48mm, 203dpi).
 * Stock colour/coating does not change geometry. Cable die-cut geometry must
 * be measured; do not invent printable regions for special stock.
 */
export interface MediaPreset {
  id: string
  label: string
  kind: 'label' | 'receipt'
  widthMm: number
  defaultHeightMm: number
  shape?: 'rectangle' | 'round'
  columns?: number
  note?: string
}

export const PAGE_PRESETS: MediaPreset[] = [
  ...[[50, 30], [25, 15], [25, 25], [50, 15], [50, 25], [50, 50], [50, 75]].map(([w, h]) => ({
    id: `label-${w}x${h}`, label: `Rectangle / square · ${w} × ${h} mm`,
    kind: 'label' as const, widthMm: w, defaultHeightMm: h
  })),
  { id: 'round-50', label: 'Round · 50 mm diameter', kind: 'label', widthMm: 50, defaultHeightMm: 50, shape: 'round' },
  { id: 'jewellery-3up', label: 'SEZNIK jewellery · 3 tags · two 32 mm faces + 36 mm tail', kind: 'label', widthMm: 45, defaultHeightMm: 100, columns: 3,
    note: 'Sized from the product dimension diagram: 64 mm body (two 32 mm fold-over faces) + 36 mm attachment tail = 100 mm. Diagram width is 15 mm; title specifies 14.3 mm. Uses 15 mm column pitch and conservative 14.3 mm bodies, centred in each column. Tails and spaces between tags never print. Fine backing offsets are not specified by the seller.' },
  { id: 'jewellery', label: 'Jewellery · single tag · 14.3 × 100 mm (not a 3-across roll)', kind: 'label', widthMm: 14.3, defaultHeightMm: 100,
    note: 'For a single-column roll only. For the SEZNIK three-across jewellery roll, choose Jewellery · 3 across.' },
  { id: 'cable', label: 'Cable / special die-cut · custom dimensions', kind: 'label', widthMm: 50, defaultHeightMm: 30,
    note: 'Starting dimensions only. Measure the label across the roll and in the feed direction, including any non-printable sections.' },
  { id: 'continuous-label', label: 'Continuous adhesive · custom cut length', kind: 'label', widthMm: 50, defaultHeightMm: 100,
    note: 'Set the measured width and desired cut length. Configure continuous media in the printer driver.' },
  { id: 'custom-label', label: 'Custom rectangle / oval / black-mark label', kind: 'label', widthMm: 40, defaultHeightMm: 30,
    note: 'Enter measured dimensions. Match gap / black-mark sensing to the loaded roll in the printer driver.' },
  { id: 'custom-round', label: 'Custom round label', kind: 'label', widthMm: 30, defaultHeightMm: 30, shape: 'round' },
  { id: 'receipt-57', label: 'Receipt · 57 mm continuous', kind: 'receipt', widthMm: 57, defaultHeightMm: 150 },
  { id: 'label-76', label: 'Other printer · 76 × 130 mm label', kind: 'label', widthMm: 76, defaultHeightMm: 130 },
  { id: 'receipt-80', label: 'Other printer · 80 mm receipt', kind: 'receipt', widthMm: 80, defaultHeightMm: 150 }
]

/** Column guides divide the configured row width; they are not die-cut masks.
 * The seller does not publish the panel/neck geometry or backing margins. */
export function mediaColumns(presetId: string | undefined, widthMm: number): { leftMm: number; widthMm: number }[] {
  const count = PAGE_PRESETS.find(p => p.id === presetId)?.columns ?? 1
  return Array.from({ length: count }, (_, index) => ({ leftMm: index * widthMm / count, widthMm: widthMm / count }))
}

export const JEWELLERY = { tagWidthMm: 14.3, pitchMm: 15, faceLengthMm: 32, bodyLengthMm: 64, tailLengthMm: 36, lengthMm: 100 }

export function jewelleryPanels(widthMm = 45): { leftMm: number; topMm: number; widthMm: number; heightMm: number }[] {
  const pitch = widthMm / 3
  return Array.from({ length: 3 }, (_, i) => ({
    leftMm: i * pitch + (pitch - JEWELLERY.tagWidthMm) / 2,
    topMm: 0, widthMm: JEWELLERY.tagWidthMm, heightMm: JEWELLERY.bodyLengthMm
  }))
}

export const PRINTER_MEDIA = {
  josh: { label: 'SEZNIK Josh / DeTong DP27 · 203 dpi', maxWidthMm: 57, printableWidthMm: 48 },
  other: { label: 'Other printer / unrestricted sizes', maxWidthMm: 300, printableWidthMm: 300 }
}

export function validateMedia(width: number, height: number, profile: keyof typeof PRINTER_MEDIA, round = false): string | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 5 || height < 5 || height > 2000) {
    return 'Enter a width of at least 5 mm and a length between 5 and 2000 mm.'
  }
  if (width > PRINTER_MEDIA[profile].maxWidthMm) return `This printer supports rolls up to ${PRINTER_MEDIA[profile].maxWidthMm} mm wide.`
  if (round && width !== height) return 'Round labels need equal width and height (the diameter).'
}

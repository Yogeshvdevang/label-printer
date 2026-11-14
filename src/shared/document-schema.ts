import { z } from 'zod'
import { PAGE_PRESETS as MEDIA_PRESETS } from './media.js'

/**
 * A "document" is a Canva-style multi-page file. Each page is either a
 * fixed-size gap-fed label (printed via TSPL2, printer must be in EZD mode)
 * or a continuous receipt strip (printed via ESC/POS raster, printer must
 * be in ESC mode) — these two printer modes are mutually exclusive and can
 * only be switched via the printer's own physical menu, so each page is
 * tagged with which mode it requires.
 */
export const PageKind = z.enum(['label', 'receipt'])
export type PageKind = z.infer<typeof PageKind>

const baseElement = {
  id: z.string(),
  xMm: z.number(),
  yMm: z.number(),
  wMm: z.number(),
  hMm: z.number(),
  rotationDeg: z.number().default(0)
}

export const TextElement = z.object({
  ...baseElement,
  type: z.literal('text'),
  text: z.string(), // may contain {{placeholder}} tokens
  fontSizePt: z.number().default(10),
  bold: z.boolean().default(false),
  align: z.enum(['left', 'center', 'right']).default('left')
})

export const BarcodeElement = z.object({
  ...baseElement,
  type: z.literal('barcode'),
  symbology: z.enum(['code128', 'ean13', 'upca']).default('code128'),
  valueTemplate: z.string(),
  showText: z.boolean().default(true)
})

export const QrElement = z.object({
  ...baseElement,
  type: z.literal('qrcode'),
  valueTemplate: z.string(),
  eccLevel: z.enum(['L', 'M', 'Q', 'H']).default('M')
})

export const RectElement = z.object({
  ...baseElement,
  type: z.literal('rect'),
  strokeMm: z.number().default(0.3),
  filled: z.boolean().default(false)
})

export const LineElement = z.object({
  ...baseElement,
  type: z.literal('line'),
  strokeMm: z.number().default(0.3)
})

export const PageElement = z.discriminatedUnion('type', [
  TextElement,
  BarcodeElement,
  QrElement,
  RectElement,
  LineElement
])
export type PageElement = z.infer<typeof PageElement>

export const Page = z.object({
  id: z.string(),
  name: z.string(),
  kind: PageKind,
  widthMm: z.number(),
  /** For receipt pages this is the current design length; the physical
   *  strip is continuous, so this just controls canvas/preview height and
   *  how much gets rasterized — it can be extended as content grows. */
  heightMm: z.number(),
  elements: z.array(PageElement).default([])
})
export type Page = z.infer<typeof Page>

export const LabelDocument = z.object({
  id: z.string(),
  name: z.string(),
  pages: z.array(Page).default([])
})
export type LabelDocument = z.infer<typeof LabelDocument>

/** Shared roll catalogue, also used by the designer. */
export const PAGE_PRESETS = MEDIA_PRESETS.map(preset => ({ ...preset, heightMm: preset.defaultHeightMm }))

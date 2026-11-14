import { describe, expect, it } from 'vitest'
import { PAGE_PRESETS, validateMedia, mediaColumns, jewelleryPanels, JEWELLERY } from '../src/shared/media.js'
import { DesignerState } from '../src/renderer/designer/state.js'

describe('roll sizing', () => {
  it('lays out three jewellery tags across and keeps single-tag documents unchanged', () => {
    const preset = PAGE_PRESETS.find(p => p.id === 'jewellery-3up')!
    expect(preset.widthMm).toBe(45)
    expect(preset.defaultHeightMm).toBe(100)
    const columns = mediaColumns(preset.id, preset.widthMm)
    expect(columns).toHaveLength(3)
    columns.forEach((column, index) => {
      expect(column.widthMm).toBeCloseTo(15)
      expect(column.leftMm).toBeCloseTo(index * 15)
    })
    expect(mediaColumns('jewellery', 14.3)).toEqual([{ leftMm: 0, widthMm: 14.3 }])
    expect(mediaColumns(preset.id, 48)[2]).toEqual({ leftMm: 32, widthMm: 16 })
  })
  it('uses the dimension diagram body and fold, keeping the attachment tail outside printable panels', () => {
    expect(JEWELLERY.faceLengthMm * 2).toBe(JEWELLERY.bodyLengthMm)
    expect(JEWELLERY.bodyLengthMm + JEWELLERY.tailLengthMm).toBe(100)
    const panels = jewelleryPanels()
    expect(panels).toHaveLength(3)
    panels.forEach((p, i) => {
      expect(p.leftMm).toBeCloseTo(i * 15 + 0.35)
      expect(p.widthMm).toBe(14.3)
      expect(p.heightMm).toBe(64)
      expect(p.topMm).toBe(0)
    })
  })
  it('supports fractional jewellery dimensions and rejects oversized Josh media', () => {
    expect(validateMedia(14.3, 100, 'josh')).toBeUndefined()
    expect(validateMedia(50, 75, 'josh')).toBeUndefined()
    expect(validateMedia(76, 130, 'josh')).toBeTruthy()
    expect(validateMedia(76, 130, 'other')).toBeUndefined()
    for (const width of [NaN, Infinity, 0, -20]) expect(validateMedia(width, 30, 'josh')).toBeTruthy()
    expect(validateMedia(30, 40, 'josh', true)).toBeTruthy()
  })
  it('preserves media settings and artwork when duplicating and resizing', () => {
    const state = new DesignerState()
    const preset = PAGE_PRESETS.find(p => p.id === 'round-50')!
    const page = state.addPage(preset.kind, preset.widthMm, preset.defaultHeightMm)
    Object.assign(page, { shape: preset.shape, mediaPresetId: preset.id, printerProfile: 'josh', fabricJSON: { objects: [] } })
    const copy = state.duplicatePage(page.id)!
    expect(copy.shape).toBe('round')
    expect(copy.mediaPresetId).toBe('round-50')
    expect(copy.printerProfile).toBe('josh')
    state.resizePage(copy.id, 30, 30)
    expect(copy.fabricJSON).toEqual({ objects: [] })
    expect(page.widthMm).toBe(50)
  })
})

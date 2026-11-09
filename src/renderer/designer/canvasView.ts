import * as fabric from 'fabric'
import bwipjs from 'bwip-js/browser'
import type { DesignPage, PageElementData } from './state.js'
import { makeElementId } from './state.js'

/** On-screen editing zoom: comfortable pixel density, independent of print DPI. */
export const UI_PX_PER_MM = 4

/** Reads back the custom metadata stashed on a Fabric object via `data`. */
export function getElementData(obj: fabric.FabricObject): PageElementData | undefined {
  return (obj as unknown as { data?: PageElementData }).data
}

export class CanvasView {
  readonly canvas: fabric.Canvas
  private clipboard: fabric.FabricObject | null = null

  constructor(canvasEl: HTMLCanvasElement) {
    this.canvas = new fabric.Canvas(canvasEl, {
      backgroundColor: '#ffffff',
      selection: true,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true
    })
  }

  /** Registers a callback fired whenever the layer list / thumbnail should be
   *  redrawn (objects added/removed/reordered/edited, selection changed). */
  onChange(fn: () => void): void {
    this.canvas.on('object:added', fn)
    this.canvas.on('object:removed', fn)
    this.canvas.on('object:modified', fn) // move/resize/rotate finished
    this.canvas.on('selection:created', fn)
    this.canvas.on('selection:updated', fn)
    this.canvas.on('selection:cleared', fn)
  }

  async setPage(page: DesignPage): Promise<void> {
    this.canvas.clear()
    this.canvas.setDimensions({
      width: page.widthMm * UI_PX_PER_MM,
      height: page.heightMm * UI_PX_PER_MM
    })
    if (page.fabricJSON) {
      await this.canvas.loadFromJSON(page.fabricJSON)
    }
    this.canvas.requestRenderAll()
  }

  /** Captures the current canvas state back onto the page object. */
  saveInto(page: DesignPage): void {
    page.fabricJSON = this.canvas.toObject(['data'])
  }

  addText(text = 'Text'): void {
    const box = new fabric.Textbox(text, {
      left: 10,
      top: 10,
      width: 100,
      fontSize: 16,
      data: { id: makeElementId(), type: 'text' } satisfies PageElementData
    })
    this.canvas.add(box)
    this.canvas.setActiveObject(box)
    this.canvas.requestRenderAll()
  }

  addRect(): void {
    const rect = new fabric.Rect({
      left: 10,
      top: 10,
      width: 80,
      height: 40,
      fill: 'transparent',
      stroke: '#000000',
      strokeWidth: 2,
      data: { id: makeElementId(), type: 'rect' } satisfies PageElementData
    })
    this.canvas.add(rect)
    this.canvas.setActiveObject(rect)
    this.canvas.requestRenderAll()
  }

  addLine(): void {
    const line = new fabric.Line([10, 10, 100, 10], {
      stroke: '#000000',
      strokeWidth: 2,
      data: { id: makeElementId(), type: 'line' } satisfies PageElementData
    })
    this.canvas.add(line)
    this.canvas.setActiveObject(line)
    this.canvas.requestRenderAll()
  }

  // ---- Ruler graphic: an actual tick-marked mm ruler (matching the fixed
  // top/left ruler bars), inserted as a normal image you can freely move,
  // resize, and rotate. It prints/thumbnails normally when visible — the 👁
  // layer toggle is what controls that, same as every other element. ----

  isGuide(obj: fabric.FabricObject): boolean {
    return getElementData(obj)?.type === 'guide'
  }

  private renderRulerDataUrl(orientation: 'horizontal' | 'vertical', lengthMm: number): string {
    const thickness = 24
    const lengthPx = Math.round(lengthMm * UI_PX_PER_MM)
    const tmp = document.createElement('canvas')
    tmp.width = orientation === 'horizontal' ? lengthPx : thickness
    tmp.height = orientation === 'horizontal' ? thickness : lengthPx
    const ctx = tmp.getContext('2d')!

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tmp.width, tmp.height)
    ctx.strokeStyle = '#334155'
    ctx.fillStyle = '#334155'
    ctx.font = '10px sans-serif'
    ctx.lineWidth = 1

    for (let mm = 0; mm <= lengthMm; mm++) {
      const pos = mm * UI_PX_PER_MM
      const major = mm % 10 === 0
      const tickLen = major ? 12 : mm % 5 === 0 ? 8 : 5
      ctx.beginPath()
      if (orientation === 'horizontal') {
        ctx.moveTo(pos + 0.5, thickness)
        ctx.lineTo(pos + 0.5, thickness - tickLen)
      } else {
        ctx.moveTo(thickness, pos + 0.5)
        ctx.lineTo(thickness - tickLen, pos + 0.5)
      }
      ctx.stroke()
      if (major) {
        if (orientation === 'horizontal') {
          ctx.fillText(String(mm), pos + 2, 10)
        } else {
          ctx.save()
          ctx.translate(10, pos + 2)
          ctx.rotate(Math.PI / 2)
          ctx.fillText(String(mm), 0, 0)
          ctx.restore()
        }
      }
    }

    ctx.beginPath()
    if (orientation === 'horizontal') {
      ctx.moveTo(0, thickness - 0.5)
      ctx.lineTo(lengthPx, thickness - 0.5)
    } else {
      ctx.moveTo(thickness - 0.5, 0)
      ctx.lineTo(thickness - 0.5, lengthPx)
    }
    ctx.stroke()

    return tmp.toDataURL('image/png')
  }

  async addGuide(orientation: 'horizontal' | 'vertical'): Promise<void> {
    const lengthMm =
      orientation === 'horizontal' ? this.canvas.getWidth() / UI_PX_PER_MM : this.canvas.getHeight() / UI_PX_PER_MM
    const dataUrl = this.renderRulerDataUrl(orientation, lengthMm)
    const img = await fabric.FabricImage.fromURL(dataUrl)
    img.set({
      left: 10,
      top: 10,
      lockScalingX: true,
      lockScalingY: true,
      data: { id: makeElementId(), type: 'guide', guideOrientation: orientation } satisfies PageElementData
    })
    // Move + rotate only — hide every resize handle, keep just the rotate handle (mtr).
    img.setControlsVisibility({
      mt: false,
      mb: false,
      ml: false,
      mr: false,
      tl: false,
      tr: false,
      bl: false,
      br: false,
      mtr: true
    })
    this.canvas.add(img)
    this.canvas.setActiveObject(img)
    this.canvas.requestRenderAll()
  }

  // ---- Reference lines: pure on-screen alignment aids, dragged out from
  // the top/left ruler bars (like Word/Illustrator). Move along one axis
  // only, never resize/rotate, and never appear in print or thumbnails
  // regardless of the 👁 toggle — purely a design-time aid. ----

  isRefLine(obj: fabric.FabricObject): boolean {
    return getElementData(obj)?.type === 'refline'
  }

  addRefLine(orientation: 'horizontal' | 'vertical', posPx: number): fabric.Line {
    const w = this.canvas.getWidth()
    const h = this.canvas.getHeight()
    const points: [number, number, number, number] =
      orientation === 'horizontal' ? [0, posPx, w, posPx] : [posPx, 0, posPx, h]

    const line = new fabric.Line(points, {
      stroke: '#ec4899',
      strokeWidth: 1,
      strokeDashArray: [5, 4],
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      lockMovementX: orientation === 'horizontal',
      lockMovementY: orientation === 'vertical',
      hoverCursor: orientation === 'horizontal' ? 'ns-resize' : 'ew-resize',
      data: { id: makeElementId(), type: 'refline', guideOrientation: orientation } satisfies PageElementData
    })
    this.canvas.add(line)
    this.canvas.setActiveObject(line)
    this.canvas.requestRenderAll()
    return line
  }

  /** Repositions a ref line while it's being dragged out from the ruler. */
  setRefLinePosition(line: fabric.Line, orientation: 'horizontal' | 'vertical', posPx: number): void {
    const w = this.canvas.getWidth()
    const h = this.canvas.getHeight()
    if (orientation === 'horizontal') {
      line.set({ y1: posPx, y2: posPx, x1: 0, x2: w })
    } else {
      line.set({ x1: posPx, x2: posPx, y1: 0, y2: h })
    }
    line.setCoords()
    this.canvas.requestRenderAll()
  }

  /** Hides all ref lines for the duration of `fn`, then restores them. */
  private withRefLinesHidden<T>(fn: () => T): T {
    const lines = this.canvas.getObjects().filter((o) => this.isRefLine(o))
    for (const l of lines) l.visible = false
    try {
      return fn()
    } finally {
      for (const l of lines) l.visible = true
      this.canvas.requestRenderAll()
    }
  }

  private renderBarcodeDataUrl(value: string, symbology: 'code128' | 'ean13' | 'upca'): string {
    const tmp = document.createElement('canvas')
    bwipjs.toCanvas(tmp, {
      bcid: symbology,
      text: value,
      scale: 2,
      height: 12,
      includetext: true,
      textxalign: 'center'
    })
    return tmp.toDataURL('image/png')
  }

  private renderQrDataUrl(value: string, eccLevel: 'L' | 'M' | 'Q' | 'H'): string {
    const tmp = document.createElement('canvas')
    bwipjs.toCanvas(tmp, {
      bcid: 'qrcode',
      text: value,
      scale: 4,
      eclevel: eccLevel
    } as bwipjs.RenderOptions)
    return tmp.toDataURL('image/png')
  }

  async addBarcode(value: string, symbology: 'code128' | 'ean13' | 'upca'): Promise<void> {
    const dataUrl = this.renderBarcodeDataUrl(value, symbology)
    const img = await fabric.FabricImage.fromURL(dataUrl)
    img.set({
      left: 10,
      top: 10,
      data: { id: makeElementId(), type: 'barcode', valueTemplate: value, symbology } satisfies PageElementData
    })
    this.canvas.add(img)
    this.canvas.setActiveObject(img)
    this.canvas.requestRenderAll()
  }

  async addQr(value: string, eccLevel: 'L' | 'M' | 'Q' | 'H'): Promise<void> {
    const dataUrl = this.renderQrDataUrl(value, eccLevel)
    const img = await fabric.FabricImage.fromURL(dataUrl)
    img.set({
      left: 10,
      top: 10,
      data: { id: makeElementId(), type: 'qrcode', valueTemplate: value, eccLevel } satisfies PageElementData
    })
    this.canvas.add(img)
    this.canvas.setActiveObject(img)
    this.canvas.requestRenderAll()
  }

  /** Regenerates a barcode's bitmap in place, keeping its position/size/rotation. */
  async updateBarcode(img: fabric.FabricImage, value: string, symbology: 'code128' | 'ean13' | 'upca'): Promise<void> {
    const existingId = getElementData(img)?.id ?? makeElementId()
    const dataUrl = this.renderBarcodeDataUrl(value, symbology)
    await img.setSrc(dataUrl)
    img.set({ data: { id: existingId, type: 'barcode', valueTemplate: value, symbology } satisfies PageElementData })
    this.canvas.requestRenderAll()
  }

  /** Regenerates a QR code's bitmap in place, keeping its position/size/rotation. */
  async updateQr(img: fabric.FabricImage, value: string, eccLevel: 'L' | 'M' | 'Q' | 'H'): Promise<void> {
    const existingId = getElementData(img)?.id ?? makeElementId()
    const dataUrl = this.renderQrDataUrl(value, eccLevel)
    await img.setSrc(dataUrl)
    img.set({ data: { id: existingId, type: 'qrcode', valueTemplate: value, eccLevel } satisfies PageElementData })
    this.canvas.requestRenderAll()
  }

  /** Inserts a picture from a data: URL (read from a user-picked file), scaled to fit the page. */
  async addImage(dataUrl: string): Promise<void> {
    const img = await fabric.FabricImage.fromURL(dataUrl)
    const maxDim = Math.min(this.canvas.getWidth(), this.canvas.getHeight()) * 0.6
    const scale = Math.min(1, maxDim / Math.max(img.width ?? 1, img.height ?? 1))
    img.set({
      left: 10,
      top: 10,
      scaleX: scale,
      scaleY: scale,
      data: { id: makeElementId(), type: 'image' } satisfies PageElementData
    })
    this.canvas.add(img)
    this.canvas.setActiveObject(img)
    this.canvas.requestRenderAll()
  }

  deleteSelected(): void {
    const active = this.canvas.getActiveObjects()
    if (active.length === 0) return
    this.canvas.discardActiveObject()
    this.canvas.remove(...active)
    this.canvas.requestRenderAll()
  }

  deleteObject(obj: fabric.FabricObject): void {
    if (this.canvas.getActiveObject() === obj) this.canvas.discardActiveObject()
    this.canvas.remove(obj)
    this.canvas.requestRenderAll()
  }

  // ---- Select all / copy / paste / duplicate ----

  selectAll(): void {
    this.canvas.discardActiveObject()
    const objects = this.canvas.getObjects()
    if (objects.length === 0) return
    if (objects.length === 1) {
      this.canvas.setActiveObject(objects[0])
    } else {
      const selection = new fabric.ActiveSelection(objects, { canvas: this.canvas })
      this.canvas.setActiveObject(selection)
    }
    this.canvas.requestRenderAll()
  }

  hasClipboard(): boolean {
    return this.clipboard !== null
  }

  /** Copies the current selection into an in-memory clipboard (Ctrl+C). */
  async copySelection(): Promise<boolean> {
    const active = this.canvas.getActiveObject()
    if (!active) return false
    this.clipboard = await active.clone()
    return true
  }

  /** Pastes whatever was last copied, offset slightly so it's visible (Ctrl+V). */
  async pasteClipboard(): Promise<boolean> {
    if (!this.clipboard) return false
    const cloned = await this.clipboard.clone()
    this.canvas.discardActiveObject()
    cloned.set({ left: (cloned.left ?? 0) + 12, top: (cloned.top ?? 0) + 12 })

    if (cloned instanceof fabric.ActiveSelection) {
      cloned.canvas = this.canvas
      cloned.forEachObject((obj) => {
        const data = getElementData(obj)
        if (data) obj.set('data', { ...data, id: makeElementId() })
        this.canvas.add(obj)
      })
      cloned.setCoords()
    } else {
      const data = getElementData(cloned)
      if (data) cloned.set('data', { ...data, id: makeElementId() })
      this.canvas.add(cloned)
    }
    this.canvas.setActiveObject(cloned)
    this.canvas.requestRenderAll()
    return true
  }

  /** Copy + paste in one step (Ctrl+D), independent of whatever's in the clipboard. */
  async duplicateSelection(): Promise<boolean> {
    const active = this.canvas.getActiveObject()
    if (!active) return false
    const savedClipboard = this.clipboard
    this.clipboard = await active.clone()
    const ok = await this.pasteClipboard()
    this.clipboard = savedClipboard
    return ok
  }

  // ---- Layers ----

  /** Front-most object first, matching how a layers panel is conventionally read top-to-bottom. */
  getLayers(): fabric.FabricObject[] {
    return [...this.canvas.getObjects()].reverse()
  }

  selectObject(obj: fabric.FabricObject): void {
    this.canvas.setActiveObject(obj)
    this.canvas.requestRenderAll()
  }

  bringForward(obj: fabric.FabricObject): void {
    this.canvas.bringObjectForward(obj)
    this.canvas.requestRenderAll()
  }

  sendBackward(obj: fabric.FabricObject): void {
    this.canvas.sendObjectBackwards(obj)
    this.canvas.requestRenderAll()
  }

  bringToFront(obj: fabric.FabricObject): void {
    this.canvas.bringObjectToFront(obj)
    this.canvas.requestRenderAll()
  }

  sendToBack(obj: fabric.FabricObject): void {
    this.canvas.sendObjectToBack(obj)
    this.canvas.requestRenderAll()
  }

  async duplicateObject(obj: fabric.FabricObject): Promise<fabric.FabricObject> {
    const clone = await obj.clone()
    const sourceData = getElementData(obj)
    clone.set({
      left: (obj.left ?? 0) + 12,
      top: (obj.top ?? 0) + 12,
      data: sourceData ? { ...sourceData, id: makeElementId() } : { id: makeElementId(), type: 'rect' }
    })
    this.canvas.add(clone)
    this.canvas.setActiveObject(clone)
    this.canvas.requestRenderAll()
    return clone
  }

  toggleVisibility(obj: fabric.FabricObject): void {
    obj.set('visible', !obj.visible)
    this.canvas.requestRenderAll()
  }

  isImageObject(obj: fabric.FabricObject): obj is fabric.FabricImage {
    return obj instanceof fabric.FabricImage
  }

  isInverted(img: fabric.FabricImage): boolean {
    return (img.filters ?? []).some((f) => f instanceof fabric.filters.Invert)
  }

  /** Toggles a black/white invert filter on an image, barcode, or QR code. */
  toggleInvert(img: fabric.FabricImage): void {
    img.filters = img.filters ?? []
    const idx = img.filters.findIndex((f) => f instanceof fabric.filters.Invert)
    if (idx >= 0) {
      img.filters.splice(idx, 1)
    } else {
      img.filters.push(new fabric.filters.Invert())
    }
    img.applyFilters()
    this.canvas.requestRenderAll()
  }

  /** Renders the current canvas at print resolution and returns raw RGBA pixels.
   *  Anything hidden via the 👁 layer toggle (ruler graphics included) is
   *  naturally skipped by Fabric's own rendering. Ref lines are pure design
   *  aids and are always excluded here regardless of their visibility flag. */
  rasterizeForPrint(page: DesignPage, dotsPerMm: number): { widthDots: number; heightDots: number; rgba: Uint8ClampedArray } {
    const widthDots = Math.round(page.widthMm * dotsPerMm)
    const heightDots = Math.round(page.heightMm * dotsPerMm)
    const multiplier = dotsPerMm / UI_PX_PER_MM

    return this.withRefLinesHidden(() => {
      const highResCanvas = this.canvas.toCanvasElement(multiplier)
      const ctx = highResCanvas.getContext('2d')!
      const imageData = ctx.getImageData(0, 0, widthDots, heightDots)
      return { widthDots, heightDots, rgba: imageData.data }
    })
  }

  renderThumbnail(page: DesignPage, target: HTMLCanvasElement): void {
    const multiplier = Math.min(1, 120 / (page.widthMm * UI_PX_PER_MM))
    this.withRefLinesHidden(() => {
      const thumbSrc = this.canvas.toCanvasElement(multiplier)
      target.width = thumbSrc.width
      target.height = thumbSrc.height
      const ctx = target.getContext('2d')!
      ctx.drawImage(thumbSrc, 0, 0)
    })
  }
}

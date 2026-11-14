export { PAGE_PRESETS } from '../../shared/media.js'
export type PageKind = 'label' | 'receipt'

export interface PageElementData {
  id: string
  type: 'text' | 'barcode' | 'qrcode' | 'rect' | 'line' | 'image' | 'guide' | 'refline'
  guideOrientation?: 'horizontal' | 'vertical'
  // text
  text?: string
  fontSizePt?: number
  bold?: boolean
  // barcode/qr
  symbology?: 'code128' | 'ean13' | 'upca'
  valueTemplate?: string
  eccLevel?: 'L' | 'M' | 'Q' | 'H'
  showText?: boolean
}

export interface DesignPage {
  id: string
  name: string
  kind: PageKind
  widthMm: number
  heightMm: number
  mediaPresetId?: string
  shape?: 'rectangle' | 'round'
  printerProfile?: 'josh' | 'other'
  /** Serialized Fabric.js canvas state for this page (fabric Canvas#toJSON output). */
  fabricJSON?: object
}

export interface DesignDocument {
  id: string
  name: string
  pages: DesignPage[]
}


function makeId(): string {
  return Math.random().toString(36).slice(2, 10)
}

type Listener = () => void

export class DesignerState {
  document: DesignDocument = { id: makeId(), name: 'Untitled', pages: [] }
  currentPageId: string | null = null
  private listeners: Listener[] = []

  subscribe(fn: Listener): void {
    this.listeners.push(fn)
  }

  private notify(): void {
    for (const fn of this.listeners) fn()
  }

  get currentPage(): DesignPage | undefined {
    return this.document.pages.find((p) => p.id === this.currentPageId)
  }

  addPage(kind: PageKind, widthMm: number, heightMm: number): DesignPage {
    const page: DesignPage = {
      id: makeId(),
      name: `Page ${this.document.pages.length + 1}`,
      kind,
      widthMm,
      heightMm
    }
    this.document.pages.push(page)
    this.currentPageId = page.id
    this.notify()
    return page
  }

  /** Clones a page (including its element layout) and inserts the copy right after it. */
  duplicatePage(pageId: string): DesignPage | undefined {
    const source = this.document.pages.find((p) => p.id === pageId)
    if (!source) return undefined

    const clonedJSON = source.fabricJSON
      ? (JSON.parse(JSON.stringify(source.fabricJSON)) as { objects?: { data?: { id?: string } }[] })
      : undefined
    if (clonedJSON?.objects) {
      for (const obj of clonedJSON.objects) {
        if (obj.data) obj.data.id = makeId()
      }
    }

    const copy: DesignPage = {
      id: makeId(),
      name: `${source.name} copy`,
      kind: source.kind,
      widthMm: source.widthMm,
      heightMm: source.heightMm,
      mediaPresetId: source.mediaPresetId,
      shape: source.shape,
      printerProfile: source.printerProfile,
      fabricJSON: clonedJSON
    }
    const idx = this.document.pages.findIndex((p) => p.id === pageId)
    this.document.pages.splice(idx + 1, 0, copy)
    this.currentPageId = copy.id
    this.notify()
    return copy
  }

  deletePage(pageId: string): void {
    this.document.pages = this.document.pages.filter((p) => p.id !== pageId)
    if (this.currentPageId === pageId) {
      this.currentPageId = this.document.pages[0]?.id ?? null
    }
    this.notify()
  }

  resizePage(pageId: string, widthMm: number, heightMm: number): void {
    const page = this.document.pages.find((p) => p.id === pageId)
    if (!page) return
    page.widthMm = widthMm
    page.heightMm = heightMm
    this.notify()
  }

  selectPage(pageId: string): void {
    this.currentPageId = pageId
    this.notify()
  }

  refresh(): void {
    this.notify()
  }

  replaceDocument(doc: DesignDocument): void {
    this.document = doc
    this.currentPageId = doc.pages[0]?.id ?? null
    this.notify()
  }
}

export const makeElementId = makeId

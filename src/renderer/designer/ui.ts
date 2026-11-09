import { DesignerState, PAGE_PRESETS, type DesignDocument, type DesignPage } from './state.js'
import { CanvasView, getElementData, UI_PX_PER_MM } from './canvasView.js'
import type * as fabric from 'fabric'

interface PrinterInfo {
  Name: string
  DriverName: string
  PortName: string
}

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T

export function initDesigner(): void {
  const state = new DesignerState()
  const canvasEl = $<HTMLCanvasElement>('fabricCanvas')
  const view = new CanvasView(canvasEl)

  const status = $<HTMLDivElement>('status')
  const setStatus = (msg: string): void => {
    status.textContent = msg
  }

  const printerSelect = $<HTMLSelectElement>('printerSelect')
  const pageSidebar = $<HTMLDivElement>('pageSidebar')

  // ---- New Page / Resize Page modal (same dialog, two modes) ----
  const modal = $<HTMLDivElement>('newPageModal')
  const modalTitle = $<HTMLHeadingElement>('newPageModalTitle')
  const createPageBtn = $<HTMLButtonElement>('createPageBtn')
  const presetSelect = $<HTMLSelectElement>('presetSelect')
  const widthInput = $<HTMLInputElement>('widthInput')
  const heightInput = $<HTMLInputElement>('heightInput')
  let resizingPageId: string | null = null

  for (const preset of PAGE_PRESETS) {
    const opt = document.createElement('option')
    opt.value = preset.id
    opt.textContent = preset.label
    presetSelect.appendChild(opt)
  }
  const syncDefaultsFromPreset = (): void => {
    const preset = PAGE_PRESETS.find((p) => p.id === presetSelect.value)
    if (preset) {
      widthInput.value = String(preset.widthMm)
      heightInput.value = String(preset.defaultHeightMm)
    }
  }
  presetSelect.addEventListener('change', syncDefaultsFromPreset)
  syncDefaultsFromPreset()

  function openNewPageModal(): void {
    resizingPageId = null
    modalTitle.textContent = 'New Page'
    createPageBtn.textContent = 'Create'
    presetSelect.disabled = false
    syncDefaultsFromPreset()
    modal.classList.remove('hidden')
  }
  function openResizeModal(page: DesignPage): void {
    resizingPageId = page.id
    modalTitle.textContent = 'Resize Page'
    createPageBtn.textContent = 'Apply'
    presetSelect.disabled = true
    widthInput.value = String(page.widthMm)
    heightInput.value = String(page.heightMm)
    modal.classList.remove('hidden')
  }

  $('newPageBtn').addEventListener('click', openNewPageModal)
  $('cancelNewPageBtn').addEventListener('click', () => modal.classList.add('hidden'))
  createPageBtn.addEventListener('click', () => {
    const preset = PAGE_PRESETS.find((p) => p.id === presetSelect.value)!
    const widthMm = Number(widthInput.value) || preset.widthMm
    const heightMm = Number(heightInput.value) || preset.defaultHeightMm
    modal.classList.add('hidden')

    if (resizingPageId) {
      state.resizePage(resizingPageId, widthMm, heightMm)
    } else {
      persistCurrentPage()
      state.addPage(preset.kind, widthMm, heightMm)
    }
    renderAll()
  })

  // ---- Page persistence between switches ----
  function persistCurrentPage(): void {
    const page = state.currentPage
    if (page) view.saveInto(page)
  }

  // ---- Sidebar ----
  function renderSidebar(): void {
    pageSidebar.innerHTML = ''
    for (const page of state.document.pages) {
      const el = document.createElement('div')
      el.className = 'pageThumb' + (page.id === state.currentPageId ? ' active' : '')
      const thumbCanvas = document.createElement('canvas')
      el.appendChild(thumbCanvas)
      const label = document.createElement('div')
      label.textContent = `${page.name} (${page.kind}, ${page.widthMm}x${page.heightMm}mm)`
      el.appendChild(label)
      const btnRow = document.createElement('div')
      btnRow.style.display = 'flex'
      btnRow.style.gap = '0.3rem'
      btnRow.style.justifyContent = 'center'

      const dupBtn = document.createElement('button')
      dupBtn.textContent = 'Duplicate'
      dupBtn.className = 'btn-indigo btn-small'
      dupBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        persistCurrentPage()
        state.duplicatePage(page.id)
        renderAll()
      })
      btnRow.appendChild(dupBtn)

      const resizeBtn = document.createElement('button')
      resizeBtn.textContent = 'Resize'
      resizeBtn.className = 'btn-blue btn-small'
      resizeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        openResizeModal(page)
      })
      btnRow.appendChild(resizeBtn)

      const delBtn = document.createElement('button')
      delBtn.textContent = 'Delete'
      delBtn.className = 'btn-rose btn-small'
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        state.deletePage(page.id)
        renderAll()
      })
      btnRow.appendChild(delBtn)
      el.appendChild(btnRow)

      el.addEventListener('click', () => {
        persistCurrentPage()
        state.selectPage(page.id)
        renderAll()
      })
      pageSidebar.appendChild(el)
    }
  }

  /** Redraws just the current page's thumbnail (cheap; called on every edit). */
  function refreshCurrentThumbnail(): void {
    const idx = state.document.pages.findIndex((p) => p.id === state.currentPageId)
    const thumbs = pageSidebar.querySelectorAll<HTMLCanvasElement>('.pageThumb canvas')
    if (idx >= 0 && thumbs[idx] && state.currentPage) {
      view.renderThumbnail(state.currentPage, thumbs[idx])
    }
  }

  // ---- Rulers (mm scale along the top/left of the canvas) ----
  const topRuler = $<HTMLCanvasElement>('topRuler')
  const leftRuler = $<HTMLCanvasElement>('leftRuler')

  function drawRulers(page: DesignPage): void {
    const widthPx = page.widthMm * UI_PX_PER_MM
    const heightPx = page.heightMm * UI_PX_PER_MM

    topRuler.width = widthPx
    topRuler.height = 22
    const tctx = topRuler.getContext('2d')!
    tctx.clearRect(0, 0, widthPx, 22)
    tctx.font = '9px sans-serif'
    tctx.fillStyle = '#6b6880'
    tctx.strokeStyle = '#c9c4e6'
    for (let mm = 0; mm <= page.widthMm; mm++) {
      const x = mm * UI_PX_PER_MM
      const major = mm % 10 === 0
      const tickLen = major ? 10 : mm % 5 === 0 ? 7 : 4
      tctx.beginPath()
      tctx.moveTo(x + 0.5, 22)
      tctx.lineTo(x + 0.5, 22 - tickLen)
      tctx.stroke()
      if (major) tctx.fillText(String(mm), x + 2, 10)
    }

    leftRuler.width = 22
    leftRuler.height = heightPx
    const lctx = leftRuler.getContext('2d')!
    lctx.clearRect(0, 0, 22, heightPx)
    lctx.font = '9px sans-serif'
    lctx.fillStyle = '#6b6880'
    lctx.strokeStyle = '#c9c4e6'
    for (let mm = 0; mm <= page.heightMm; mm++) {
      const y = mm * UI_PX_PER_MM
      const major = mm % 10 === 0
      const tickLen = major ? 10 : mm % 5 === 0 ? 7 : 4
      lctx.beginPath()
      lctx.moveTo(22, y + 0.5)
      lctx.lineTo(22 - tickLen, y + 0.5)
      lctx.stroke()
      if (major) {
        lctx.save()
        lctx.translate(9, y + 2)
        lctx.rotate(Math.PI / 2)
        lctx.fillText(String(mm), 0, 0)
        lctx.restore()
      }
    }
  }

  // ---- Drag a reference line out from the ruler bars (Word/Illustrator-style) ----
  function canvasLocalPoint(clientX: number, clientY: number): { x: number; y: number } {
    const rect = canvasEl.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  topRuler.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const start = canvasLocalPoint(e.clientX, e.clientY)
    const line = view.addRefLine('horizontal', Math.max(0, start.y))
    const onMove = (moveEvent: MouseEvent): void => {
      const p = canvasLocalPoint(moveEvent.clientX, moveEvent.clientY)
      view.setRefLinePosition(line, 'horizontal', p.y)
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      renderLayers()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  leftRuler.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const start = canvasLocalPoint(e.clientX, e.clientY)
    const line = view.addRefLine('vertical', Math.max(0, start.x))
    const onMove = (moveEvent: MouseEvent): void => {
      const p = canvasLocalPoint(moveEvent.clientX, moveEvent.clientY)
      view.setRefLinePosition(line, 'vertical', p.x)
    }
    const onUp = (): void => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      renderLayers()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  })

  async function renderCanvasAndThumbs(): Promise<void> {
    const page = state.currentPage
    if (page) {
      await view.setPage(page)
      drawRulers(page)
    }
    refreshCurrentThumbnail()
  }

  async function renderAll(): Promise<void> {
    renderSidebar()
    await renderCanvasAndThumbs()
    renderLayers()
  }

  // ---- Toolbar: add elements ----
  $('addTextBtn').addEventListener('click', () => view.addText())
  $('addRectBtn').addEventListener('click', () => view.addRect())
  $('addLineBtn').addEventListener('click', () => view.addLine())
  $('addHGuideBtn').addEventListener('click', () => {
    view.addGuide('horizontal').catch((err) => setStatus(`Error: ${err.message}`))
  })
  $('addVGuideBtn').addEventListener('click', () => {
    view.addGuide('vertical').catch((err) => setStatus(`Error: ${err.message}`))
  })

  const rulerGrid = $<HTMLDivElement>('rulerGrid')
  const toggleRulerBtn = $<HTMLButtonElement>('toggleRulerBtn')
  toggleRulerBtn.addEventListener('click', () => {
    const hidden = rulerGrid.classList.toggle('rulers-hidden')
    toggleRulerBtn.textContent = hidden ? '📐 Show Ruler' : '📐 Hide Ruler'
  })
  $('deleteSelectedBtn').addEventListener('click', () => view.deleteSelected())

  // Delete/Backspace/Escape, and Ctrl+A/C/D for select-all/copy/duplicate.
  // Skipped while the user is mid-edit inside a text box (Fabric's text
  // editing uses a hidden <textarea> to capture keystrokes) or a modal field.
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName
    if (tag === 'TEXTAREA' || tag === 'INPUT') return

    if (e.key === 'Escape') {
      view.canvas.discardActiveObject()
      view.canvas.requestRenderAll()
      return
    }

    const cmd = e.ctrlKey || e.metaKey
    if (cmd && e.key.toLowerCase() === 'a') {
      e.preventDefault()
      view.selectAll()
      return
    }
    if (cmd && e.key.toLowerCase() === 'c') {
      view.copySelection().catch((err) => setStatus(`Copy error: ${err.message}`))
      return
    }
    if (cmd && e.key.toLowerCase() === 'd') {
      e.preventDefault()
      view.duplicateSelection().catch((err) => setStatus(`Duplicate error: ${err.message}`))
      return
    }
    if (e.key !== 'Delete' && e.key !== 'Backspace') return
    view.deleteSelected()
  })

  // ---- Barcode modal (handles both "insert new" and "edit existing in place") ----
  const barcodeModal = $<HTMLDivElement>('barcodeModal')
  const barcodeModalTitle = barcodeModal.querySelector('h3')!
  const barcodeValueInput = $<HTMLInputElement>('barcodeValueInput')
  const barcodeSymbologySelect = $<HTMLSelectElement>('barcodeSymbologySelect')
  const insertBarcodeBtn = $<HTMLButtonElement>('insertBarcodeBtn')
  let editingBarcode: fabric.FabricImage | null = null

  function openBarcodeModalForInsert(): void {
    editingBarcode = null
    barcodeModalTitle.textContent = 'Insert Barcode'
    insertBarcodeBtn.textContent = 'Insert'
    barcodeValueInput.value = '123456789012'
    barcodeSymbologySelect.value = 'code128'
    barcodeModal.classList.remove('hidden')
    barcodeValueInput.focus()
  }
  function openBarcodeModalForEdit(img: fabric.FabricImage): void {
    editingBarcode = img
    const data = getElementData(img)
    barcodeModalTitle.textContent = 'Edit Barcode'
    insertBarcodeBtn.textContent = 'Update'
    barcodeValueInput.value = data?.valueTemplate ?? ''
    barcodeSymbologySelect.value = data?.symbology ?? 'code128'
    barcodeModal.classList.remove('hidden')
    barcodeValueInput.focus()
  }
  $('addBarcodeBtn').addEventListener('click', openBarcodeModalForInsert)
  $('cancelBarcodeBtn').addEventListener('click', () => barcodeModal.classList.add('hidden'))
  insertBarcodeBtn.addEventListener('click', async () => {
    const value = barcodeValueInput.value.trim()
    if (!value) return
    const symbology = barcodeSymbologySelect.value as 'code128' | 'ean13' | 'upca'
    barcodeModal.classList.add('hidden')
    if (editingBarcode) {
      await view.updateBarcode(editingBarcode, value, symbology)
    } else {
      await view.addBarcode(value, symbology)
    }
  })

  // ---- QR modal (handles both "insert new" and "edit existing in place") ----
  const qrModal = $<HTMLDivElement>('qrModal')
  const qrModalTitle = qrModal.querySelector('h3')!
  const qrValueInput = $<HTMLInputElement>('qrValueInput')
  const qrEccSelect = $<HTMLSelectElement>('qrEccSelect')
  const insertQrBtn = $<HTMLButtonElement>('insertQrBtn')
  let editingQr: fabric.FabricImage | null = null

  function openQrModalForInsert(): void {
    editingQr = null
    qrModalTitle.textContent = 'Insert QR Code'
    insertQrBtn.textContent = 'Insert'
    qrValueInput.value = 'https://example.com'
    qrEccSelect.value = 'M'
    qrModal.classList.remove('hidden')
    qrValueInput.focus()
  }
  function openQrModalForEdit(img: fabric.FabricImage): void {
    editingQr = img
    const data = getElementData(img)
    qrModalTitle.textContent = 'Edit QR Code'
    insertQrBtn.textContent = 'Update'
    qrValueInput.value = data?.valueTemplate ?? ''
    qrEccSelect.value = data?.eccLevel ?? 'M'
    qrModal.classList.remove('hidden')
    qrValueInput.focus()
  }
  $('addQrBtn').addEventListener('click', openQrModalForInsert)
  $('cancelQrBtn').addEventListener('click', () => qrModal.classList.add('hidden'))
  insertQrBtn.addEventListener('click', async () => {
    const value = qrValueInput.value.trim()
    if (!value) return
    const eccLevel = qrEccSelect.value as 'L' | 'M' | 'Q' | 'H'
    qrModal.classList.add('hidden')
    if (editingQr) {
      await view.updateQr(editingQr, value, eccLevel)
    } else {
      await view.addQr(value, eccLevel)
    }
  })

  // Double-click a barcode/QR on the canvas to edit its value in place
  // (position/size stay put — only the encoded value/settings change).
  view.canvas.on('mouse:dblclick', (e) => {
    const target = e.target
    if (!target) return
    const data = getElementData(target)
    if (data?.type === 'barcode') openBarcodeModalForEdit(target as fabric.FabricImage)
    else if (data?.type === 'qrcode') openQrModalForEdit(target as fabric.FabricImage)
  })

  // ---- Clipboard paste (Ctrl+V) ----
  // Priority: whatever was last copied with Ctrl+C inside the app, then an
  // image on the OS clipboard, then plain text.
  document.addEventListener('paste', (e) => {
    // Let normal paste behavior happen inside real text inputs (our modal
    // fields, and Fabric's own hidden <textarea> used while editing a
    // Textbox) — only hijack Ctrl+V when the canvas itself has focus.
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return

    if (view.hasClipboard()) {
      e.preventDefault()
      view.pasteClipboard().catch((err) => setStatus(`Paste error: ${err.message}`))
      return
    }

    const items = e.clipboardData?.items
    if (!items) return

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        const reader = new FileReader()
        reader.onload = () => {
          view.addImage(reader.result as string).catch((err) => setStatus(`Paste error: ${err.message}`))
        }
        reader.readAsDataURL(file)
        e.preventDefault()
        return
      }
    }

    const text = e.clipboardData?.getData('text/plain')
    if (text) {
      view.addText(text)
      e.preventDefault()
    }
  })

  // ---- Right-click context menu ----
  const contextMenu = $<HTMLDivElement>('contextMenu')

  function hideContextMenu(): void {
    contextMenu.classList.add('hidden')
    contextMenu.innerHTML = ''
  }

  function addMenuItem(label: string, onClick: () => void, danger = false): void {
    const btn = document.createElement('button')
    btn.textContent = label
    if (danger) btn.className = 'danger'
    btn.addEventListener('click', () => {
      hideContextMenu()
      onClick()
      // Some canvas ops (z-order, visibility, filters) don't fire the events
      // view.onChange listens to, so refresh explicitly here too.
      renderLayers()
      refreshCurrentThumbnail()
    })
    contextMenu.appendChild(btn)
  }

  function addMenuDivider(): void {
    contextMenu.appendChild(document.createElement('hr'))
  }

  async function pasteImageFromClipboard(): Promise<void> {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith('image/'))
        if (!imageType) continue
        const blob = await item.getType(imageType)
        const reader = new FileReader()
        reader.onload = () => {
          view.addImage(reader.result as string).catch((err) => setStatus(`Paste error: ${err.message}`))
        }
        reader.readAsDataURL(blob)
        return
      }
      setStatus('No image found on the clipboard.')
    } catch (err) {
      setStatus(`Clipboard read failed: ${(err as Error).message}`)
    }
  }

  view.canvas.on('mouse:down', (opt) => {
    const mouseEvent = opt.e as MouseEvent
    if (mouseEvent.button !== 2) return
    mouseEvent.preventDefault()
    hideContextMenu()

    const target = opt.target
    if (target) view.selectObject(target)

    if (target) {
      addMenuItem('⤴ Bring to Front', () => view.bringToFront(target))
      addMenuItem('↑ Bring Forward', () => view.bringForward(target))
      addMenuItem('↓ Send Backward', () => view.sendBackward(target))
      addMenuItem('⤵ Send to Back', () => view.sendToBack(target))
      addMenuDivider()
      addMenuItem('⧉ Duplicate', () => {
        view.duplicateObject(target).catch((err) => setStatus(`Error: ${err.message}`))
      })
      addMenuItem('👁 Toggle Visibility', () => view.toggleVisibility(target))
      if (view.isImageObject(target)) {
        addMenuItem('🌓 Invert Colors', () => view.toggleInvert(target))
      }
      addMenuDivider()
      addMenuItem('🗑 Delete', () => view.deleteObject(target), true)
    } else {
      addMenuItem('🔤 Add Text', () => view.addText())
      addMenuItem('▭ Add Rect', () => view.addRect())
      addMenuItem('↔ Add H Ruler', () => {
        view.addGuide('horizontal').catch((err) => setStatus(`Error: ${err.message}`))
      })
      addMenuItem('↕ Add V Ruler', () => {
        view.addGuide('vertical').catch((err) => setStatus(`Error: ${err.message}`))
      })
      addMenuDivider()
      addMenuItem('┄ Add H Guide Line', () => {
        const p = canvasLocalPoint(mouseEvent.clientX, mouseEvent.clientY)
        view.addRefLine('horizontal', p.y)
      })
      addMenuItem('┆ Add V Guide Line', () => {
        const p = canvasLocalPoint(mouseEvent.clientX, mouseEvent.clientY)
        view.addRefLine('vertical', p.x)
      })
      addMenuDivider()
      addMenuItem('🖼 Paste Image', () => pasteImageFromClipboard())
    }

    const { clientX, clientY } = opt.e as MouseEvent
    contextMenu.style.left = `${clientX}px`
    contextMenu.style.top = `${clientY}px`
    contextMenu.classList.remove('hidden')
  })

  document.addEventListener('click', hideContextMenu)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideContextMenu()
  })

  // ---- Image insert ----
  const imageFileInput = $<HTMLInputElement>('imageFileInput')
  $('addImageBtn').addEventListener('click', () => imageFileInput.click())
  imageFileInput.addEventListener('change', async () => {
    const file = imageFileInput.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      await view.addImage(reader.result as string)
    }
    reader.readAsDataURL(file)
    imageFileInput.value = ''
  })

  // ---- Layers panel ----
  const layerList = $<HTMLDivElement>('layerList')
  const layerTypeMeta: Record<string, { icon: string; label: string }> = {
    text: { icon: '🔤', label: 'Text' },
    rect: { icon: '▭', label: 'Rectangle' },
    line: { icon: '📏', label: 'Line' },
    barcode: { icon: '▥', label: 'Barcode' },
    qrcode: { icon: '⬛', label: 'QR Code' },
    image: { icon: '🖼', label: 'Image' },
    guide: { icon: '📐', label: 'Ruler' },
    refline: { icon: '📏', label: 'Guide Line' }
  }

  function renderLayers(): void {
    layerList.innerHTML = ''
    const active = view.canvas.getActiveObject()
    for (const obj of view.getLayers()) {
      const data = getElementData(obj)
      const meta = layerTypeMeta[data?.type ?? ''] ?? { icon: '◆', label: 'Object' }
      const row = document.createElement('div')
      row.className = 'layerRow' + (obj === active ? ' active' : '')

      const icon = document.createElement('span')
      icon.className = 'layerIcon'
      icon.textContent = meta.icon
      row.appendChild(icon)

      const name = document.createElement('span')
      name.className = 'layerName'
      name.textContent = meta.label
      row.appendChild(name)

      const upBtn = document.createElement('button')
      upBtn.textContent = '↑'
      upBtn.title = 'Bring forward'
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        view.bringForward(obj)
        renderLayers()
      })
      row.appendChild(upBtn)

      const downBtn = document.createElement('button')
      downBtn.textContent = '↓'
      downBtn.title = 'Send backward'
      downBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        view.sendBackward(obj)
        renderLayers()
      })
      row.appendChild(downBtn)

      const eyeBtn = document.createElement('button')
      eyeBtn.textContent = obj.visible === false ? '🚫' : '👁'
      eyeBtn.title = 'Toggle visibility'
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        view.toggleVisibility(obj)
        renderLayers()
      })
      row.appendChild(eyeBtn)

      if (view.isImageObject(obj)) {
        const invertBtn = document.createElement('button')
        invertBtn.textContent = '🌓'
        invertBtn.title = 'Invert colors (black ↔ white)'
        if (view.isInverted(obj)) invertBtn.style.background = '#ddd6fe'
        invertBtn.addEventListener('click', (e) => {
          e.stopPropagation()
          view.toggleInvert(obj)
          renderLayers()
        })
        row.appendChild(invertBtn)
      }

      const delBtn = document.createElement('button')
      delBtn.textContent = '🗑'
      delBtn.title = 'Delete layer'
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        view.deleteObject(obj)
        renderLayers()
      })
      row.appendChild(delBtn)

      row.addEventListener('click', () => {
        view.selectObject(obj)
        renderLayers()
      })

      layerList.appendChild(row)
    }
  }

  view.onChange(() => {
    renderLayers()
    refreshCurrentThumbnail()
  })

  // ---- Save document modal ----
  const saveDocModal = $<HTMLDivElement>('saveDocModal')
  const saveDocNameInput = $<HTMLInputElement>('saveDocNameInput')

  $('saveDocBtn').addEventListener('click', () => {
    saveDocNameInput.value = state.document.name === 'Untitled' ? '' : state.document.name
    saveDocModal.classList.remove('hidden')
    saveDocNameInput.focus()
  })
  $('cancelSaveDocBtn').addEventListener('click', () => saveDocModal.classList.add('hidden'))
  $('confirmSaveDocBtn').addEventListener('click', async () => {
    const name = saveDocNameInput.value.trim()
    if (!name) return
    persistCurrentPage()
    state.document.name = name
    const filename = `${name.replace(/[^\w.-]+/g, '_')}.json`
    const doc: DesignDocument = state.document
    saveDocModal.classList.add('hidden')
    try {
      await window.api.saveDocument(filename, doc)
      setStatus(`Saved "${filename}".`)
    } catch (err) {
      setStatus(`Save error: ${(err as Error).message}`)
    }
  })

  // ---- Load document modal ----
  const loadDocModal = $<HTMLDivElement>('loadDocModal')
  const loadDocList = $<HTMLDivElement>('loadDocList')

  $('loadDocBtn').addEventListener('click', async () => {
    loadDocList.innerHTML = '<div class="emptyNote">Loading…</div>'
    loadDocModal.classList.remove('hidden')
    try {
      const files = await window.api.listDocuments()
      loadDocList.innerHTML = ''
      if (files.length === 0) {
        loadDocList.innerHTML = '<div class="emptyNote">No saved documents yet.</div>'
        return
      }
      for (const file of files) {
        const row = document.createElement('div')
        row.className = 'fileRow'

        const name = document.createElement('span')
        name.textContent = file
        row.appendChild(name)

        const delBtn = document.createElement('button')
        delBtn.className = 'btn-rose btn-small'
        delBtn.textContent = 'Delete'
        delBtn.addEventListener('click', async (e) => {
          e.stopPropagation()
          await window.api.deleteDocument(file)
          row.remove()
        })
        row.appendChild(delBtn)

        row.addEventListener('click', async () => {
          const doc = (await window.api.loadDocument(file)) as DesignDocument
          state.replaceDocument(doc)
          loadDocModal.classList.add('hidden')
          renderAll()
          setStatus(`Loaded "${file}".`)
        })
        loadDocList.appendChild(row)
      }
    } catch (err) {
      loadDocList.innerHTML = `<div class="emptyNote">Error: ${(err as Error).message}</div>`
    }
  })
  $('cancelLoadDocBtn').addEventListener('click', () => loadDocModal.classList.add('hidden'))

  // ---- Printers ----
  async function refreshPrinters(): Promise<void> {
    const printers = (await window.api.listPrinters()) as PrinterInfo[]
    printerSelect.innerHTML = ''
    for (const p of printers) {
      const opt = document.createElement('option')
      opt.value = p.Name
      opt.textContent = p.Name
      printerSelect.appendChild(opt)
    }
    const preferred = printers.find((p) => p.Name === '4BARCODE 4B-2034PA')
    if (preferred) printerSelect.value = preferred.Name
  }
  $('refreshPrintersBtn').addEventListener('click', () => {
    refreshPrinters().catch((err) => setStatus(`Error: ${err.message}`))
  })

  const DOTS_PER_MM = 8 // ~203 DPI, confirmed against physical printer for label mode

  async function printPage(page: DesignPage | undefined): Promise<void> {
    if (!page) {
      setStatus('No page to print.')
      return
    }
    if (!printerSelect.value) {
      setStatus('No printer selected.')
      return
    }
    const { widthDots, heightDots, rgba } = view.rasterizeForPrint(page, DOTS_PER_MM)
    setStatus(`Printing "${page.name}" (${page.kind}) to "${printerSelect.value}"…`)
    try {
      await window.api.printPage({
        kind: page.kind,
        widthMm: page.widthMm,
        heightMm: page.heightMm,
        widthDots,
        heightDots,
        rgba: Array.from(rgba),
        printerName: printerSelect.value
      })
      setStatus(`Printed "${page.name}".`)
    } catch (err) {
      setStatus(`Print error: ${(err as Error).message}`)
    }
  }

  $('printPageBtn').addEventListener('click', () => {
    persistCurrentPage()
    printPage(state.currentPage).catch((err) => setStatus(`Error: ${err.message}`))
  })

  $('printAllBtn').addEventListener('click', async () => {
    persistCurrentPage()
    for (const page of state.document.pages) {
      state.selectPage(page.id)
      await view.setPage(page)
      await printPage(page)
    }
  })

  // ---- Init ----
  refreshPrinters().catch((err) => setStatus(`Error: ${err.message}`))
  if (state.document.pages.length === 0) {
    state.addPage('label', 76, 130)
  }
  renderAll()
}

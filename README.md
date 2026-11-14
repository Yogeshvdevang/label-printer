# Label Printer

Windows Electron label designer with roll presets and raster printing.

```sh
npm ci
npm run dev
```

Build with `npm run build`, then launch with `npm start`. Run checks with
`npm test` and `npx tsc --noEmit`.

## SEZNIK Josh / DeTong DP27

Install the model's Windows driver and select its Windows printer queue in the
app. DP27/Josh queues use GDI PrintDocument with opaque 24-bit images; other
printers retain the existing RAW TSPL/ESC-POS paths. Keep
`resources/driver-print.ps1` alongside `resources/raw-print.ps1` when packaging.
The bundled 4BARCODE driver is for a different printer.

New Page and Resize offer standard rolls, custom dimensions, round labels and
three-across jewellery tags. A Josh supports a 48 mm print head; wider designs
show reference guides. A successful submission confirms the Windows print call,
not physical output.

## Jewellery template and calibration status

The SEZNIK product dimension image shows a 64 mm body (two 32 mm fold-over
faces) and a 36 mm attachment tail. The template uses three 15 mm column pitches
with conservative 14.3 mm bodies because the product title and image disagree
on width. Its starting page is 45 × 100 mm. Attachment tails and inter-tag spaces
are masked from the print raster. Start directly on this template with
`npm start -- --jewellery` after building.

Source: [SEZNIK jewellery labels](https://seznik.in/products/seznik-jewellery-thermal-labels-14-3mm-x-100mm-waterproof-non-tearable-direct-thermal-150-labels-roll-for-2-to-4-inch-printers-white-for-jewellery-tagging-750-labels).

Physical output has been confirmed for a canvas text label and a direct GDI
scale test. Exact positioning on the jewellery stock is still being calibrated:
the user reported top-positioned artwork appearing farther down the label.
Do not treat this template as physically calibrated or start a large batch
without checking a sample. Windows reported zero hard margins and the expected
45 × 100 mm page size during diagnostics.

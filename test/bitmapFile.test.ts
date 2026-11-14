import { expect, it } from 'vitest'
import { encodeBmp } from '../src/print-engine/windows/bitmapFile.js'

it('encodes bottom-up BGRA and composites transparent canvas pixels onto white', () => {
  const bmp = encodeBmp(new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]), 1, 2)
  expect(bmp.subarray(0, 2).toString()).toBe('BM')
  expect(bmp.readUInt32LE(2)).toBe(bmp.length)
  expect(bmp.readInt32LE(18)).toBe(1)
  expect(bmp.readInt32LE(22)).toBe(2)
  expect([...bmp.subarray(54)]).toEqual([255, 255, 255, 255, 0, 0, 255, 255])
})

it('rejects malformed or oversized raster data', () => {
  expect(() => encodeBmp(new Uint8Array(3), 1, 1)).toThrow()
  expect(() => encodeBmp(new Uint8Array(), 0, 1)).toThrow()
  expect(() => encodeBmp(new Uint8Array(), 5000, 5000)).toThrow()
})

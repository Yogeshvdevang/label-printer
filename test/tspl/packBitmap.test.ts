import { describe, it, expect } from 'vitest'
import { packMonochromeBitmap, BIT_POLARITY } from '../../src/print-engine/tspl/packBitmap.js'

// Derive expected bit values from the active BIT_POLARITY so these tests
// stay correct whichever way it's set (it gets flipped based on physical
// printer behavior, see packBitmap.ts).
const inkBit = BIT_POLARITY === 'blackIs1' ? 1 : 0
const bgBit = inkBit === 1 ? 0 : 1

describe('packMonochromeBitmap', () => {
  it('computes widthBytes as ceil(width/8)', () => {
    const bmp = packMonochromeBitmap(9, 1, () => false)
    expect(bmp.widthBytes).toBe(2)
    expect(bmp.data.length).toBe(2)
  })

  it('packs bits MSB-first within a byte', () => {
    // Ink only the leftmost pixel of an 8-wide row -> bit 7 is inkBit, rest are background
    const bmp = packMonochromeBitmap(8, 1, (x) => x === 0)
    const expected = (inkBit << 7) | (bgBit === 1 ? 0b01111111 : 0)
    expect(bmp.data[0]).toBe(expected)
  })

  it('packs the rightmost pixel of a byte as bit 0', () => {
    const bmp = packMonochromeBitmap(8, 1, (x) => x === 7)
    const expected = inkBit | (bgBit === 1 ? 0b11111110 : 0)
    expect(bmp.data[0]).toBe(expected)
  })

  it('pads unused bits in the last byte of a row with the background bit', () => {
    const bmp = packMonochromeBitmap(3, 1, () => true)
    // 3 ink pixels in bits 7,6,5; bits 4-0 are padding -> background bit
    const inkBits = inkBit === 1 ? 0b111 : 0b000
    const padBits = bgBit === 1 ? 0b11111 : 0b00000
    expect(bmp.data[0]).toBe((inkBits << 5) | padBits)
  })

  it('packs multiple rows independently, each padded to a byte boundary', () => {
    const bmp = packMonochromeBitmap(3, 2, (_x, y) => y === 1)
    expect(bmp.widthBytes).toBe(1)
    expect(bmp.data.length).toBe(2)

    const allBackground = bgBit === 1 ? 0xff : 0x00
    const inkBits = inkBit === 1 ? 0b111 : 0b000
    const padBits = bgBit === 1 ? 0b11111 : 0b00000

    expect(bmp.data[0]).toBe(allBackground) // row y=0: no ink anywhere
    expect(bmp.data[1]).toBe((inkBits << 5) | padBits) // row y=1: ink
  })
})

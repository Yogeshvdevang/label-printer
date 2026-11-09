import { describe, it, expect } from 'vitest'
import { buildTsplJob, DEFAULT_PROFILE } from '../../src/print-engine/tspl/buildCommands.js'
import { packMonochromeBitmap, BIT_POLARITY } from '../../src/print-engine/tspl/packBitmap.js'

describe('buildTsplJob', () => {
  it('emits SIZE/GAP/DIRECTION/REFERENCE/CLS/BITMAP/PRINT with bitmap bytes intact', () => {
    const bitmap = packMonochromeBitmap(8, 1, (x) => x === 0)
    const job = buildTsplJob({ widthMm: 40, heightMm: 30, bitmap, profile: DEFAULT_PROFILE, copies: 2 })
    const text = job.toString('latin1')

    expect(text).toContain('SIZE 40 mm,30 mm\r\n')
    expect(text).toContain('GAP 2 mm,0 mm\r\n')
    expect(text).toContain('DIRECTION 0\r\n')
    expect(text).toContain('REFERENCE 0,0\r\n')
    expect(text).toContain('CLS\r\n')
    expect(text).toContain('BITMAP 0,0,1,1,0,')
    expect(text).toContain('PRINT 1,2\r\n')

    // The single packed bitmap byte (ink pixel at x=0, rest background) must
    // appear verbatim in the buffer, whichever polarity is currently active.
    const expectedByte = BIT_POLARITY === 'blackIs1' ? 0x80 : 0x7f
    expect(job.includes(Buffer.from([expectedByte]))).toBe(true)
  })

  it('defaults to 1 copy when not specified', () => {
    const bitmap = packMonochromeBitmap(8, 1, () => false)
    const job = buildTsplJob({ widthMm: 40, heightMm: 30, bitmap })
    expect(job.toString('latin1')).toContain('PRINT 1,1\r\n')
  })
})

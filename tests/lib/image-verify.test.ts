import { describe, it, expect } from 'vitest'
import {
  crc32,
  verifyIntegrity,
  verifySignature,
  isNewerVersion,
  isCompatibleHardware,
  verifyImage,
  type ImageHeader,
} from '../../src/lib/image-verify'

const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
const header: ImageHeader = {
  magic: 'BCM7',
  version: '2.5.0',
  length: payload.length,
  crc32: crc32(payload),
  hardwareIds: ['BCM7-H2'],
}
const digest = new Uint8Array([9, 9, 9, 9])

describe('crc32', () => {
  it('matches the known value for "123456789"', () => {
    const bytes = new TextEncoder().encode('123456789')
    expect(crc32(bytes)).toBe(0xcbf43926)
  })

  it('returns 0 for empty input', () => {
    expect(crc32(new Uint8Array(0))).toBe(0)
  })

  it('changes when one byte changes', () => {
    const other = new Uint8Array(payload)
    other[3] ^= 0xff
    expect(crc32(other)).not.toBe(crc32(payload))
  })
})

describe('verifyIntegrity', () => {
  it('accepts a payload that matches the header', () => {
    expect(verifyIntegrity(header, payload)).toEqual({ valid: true })
  })

  it('rejects an unknown magic', () => {
    expect(verifyIntegrity({ ...header, magic: 'XXXX' }, payload).reason).toBe('Unknown image magic')
  })

  it('rejects a non-positive declared length', () => {
    expect(verifyIntegrity({ ...header, length: 0 }, payload).reason).toBe('Declared length must be positive')
  })

  it('rejects a payload shorter than declared', () => {
    expect(verifyIntegrity(header, payload.subarray(0, 4)).reason).toBe('Payload is shorter than declared')
  })

  it('rejects a corrupted payload', () => {
    const corrupted = new Uint8Array(payload)
    corrupted[0] = 0xff
    expect(verifyIntegrity(header, corrupted).reason).toBe('CRC mismatch')
  })
})

describe('verifySignature', () => {
  it('accepts matching digests', () => {
    expect(verifySignature(digest, new Uint8Array([9, 9, 9, 9]))).toEqual({ valid: true })
  })

  it('rejects differing digests', () => {
    expect(verifySignature(digest, new Uint8Array([9, 9, 0, 9])).reason).toBe('Signature mismatch')
  })

  it('rejects missing digests', () => {
    expect(verifySignature(new Uint8Array(0), digest).reason).toBe('Missing digest')
    expect(verifySignature(digest, new Uint8Array(0)).reason).toBe('Missing digest')
  })
})

describe('isNewerVersion', () => {
  it('accepts a higher patch, minor or major version', () => {
    expect(isNewerVersion('2.4.2', '2.4.1')).toBe(true)
    expect(isNewerVersion('2.5.0', '2.4.9')).toBe(true)
    expect(isNewerVersion('3.0.0', '2.9.9')).toBe(true)
  })

  it('rejects the same or an older version', () => {
    expect(isNewerVersion('2.4.1', '2.4.1')).toBe(false)
    expect(isNewerVersion('2.3.0', '2.4.1')).toBe(false)
  })
})

describe('isCompatibleHardware', () => {
  it('checks the hardware list', () => {
    expect(isCompatibleHardware(header, 'BCM7-H2')).toBe(true)
    expect(isCompatibleHardware(header, 'BCM7-H1')).toBe(false)
  })
})

describe('verifyImage', () => {
  it('accepts a valid, newer, compatible image', () => {
    expect(verifyImage(header, payload, digest, digest, '2.4.9', 'BCM7-H2')).toEqual({ valid: true })
  })

  it('reports an integrity failure first', () => {
    expect(verifyImage({ ...header, crc32: 1 }, payload, digest, digest, '2.4.9', 'BCM7-H2').reason).toBe('CRC mismatch')
  })

  it('reports a signature failure', () => {
    expect(verifyImage(header, payload, digest, new Uint8Array([1, 1, 1, 1]), '2.4.9', 'BCM7-H2').reason).toBe(
      'Signature mismatch'
    )
  })

  it('reports incompatible hardware', () => {
    expect(verifyImage(header, payload, digest, digest, '2.4.9', 'BCM7-H9').reason).toBe(
      'Image does not target this hardware variant'
    )
  })

  it('reports a version that is not newer', () => {
    expect(verifyImage(header, payload, digest, digest, '2.5.0', 'BCM7-H2').reason).toBe(
      'Image is not newer than the installed version'
    )
  })
})

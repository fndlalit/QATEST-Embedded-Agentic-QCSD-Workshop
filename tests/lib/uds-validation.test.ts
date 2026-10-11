import { describe, it, expect } from 'vitest'
import {
  SERVICE,
  validateRequest,
  parseRequestDownload,
  isWithinPartition,
  isExpectedSequenceCounter,
} from '../../src/lib/uds-validation'

const frame = (...bytes: number[]) => new Uint8Array(bytes)

describe('validateRequest', () => {
  it('rejects an empty frame', () => {
    expect(validateRequest(frame(), 'default')).toEqual({ valid: false, nrc: 'incorrectMessageLengthOrInvalidFormat' })
  })

  it('rejects an unknown service', () => {
    expect(validateRequest(frame(0x99, 0x01), 'default').nrc).toBe('serviceNotSupported')
  })

  it('rejects a frame that is too short for its service', () => {
    expect(validateRequest(frame(SERVICE.routineControl, 0x01), 'extended').nrc).toBe(
      'incorrectMessageLengthOrInvalidFormat'
    )
  })

  it.each([SERVICE.requestDownload, SERVICE.transferData, SERVICE.requestTransferExit])(
    'rejects programming service 0x%s outside the programming session',
    (service) => {
      const result = validateRequest(frame(service, 0, 0x11, 0, 0), 'extended')
      expect(result.nrc).toBe('serviceNotSupportedInActiveSession')
    }
  )

  it('accepts programming services in the programming session', () => {
    expect(validateRequest(frame(SERVICE.requestDownload, 0, 0x11, 0, 0), 'programming')).toEqual({ valid: true })
    expect(validateRequest(frame(SERVICE.transferData, 1, 0xaa), 'programming')).toEqual({ valid: true })
    expect(validateRequest(frame(SERVICE.requestTransferExit), 'programming')).toEqual({ valid: true })
  })

  it('accepts session control, reset, security access and tester present in any session', () => {
    expect(validateRequest(frame(SERVICE.diagnosticSessionControl, 0x02), 'default').valid).toBe(true)
    expect(validateRequest(frame(SERVICE.ecuReset, 0x01), 'default').valid).toBe(true)
    expect(validateRequest(frame(SERVICE.securityAccess, 0x01), 'extended').valid).toBe(true)
    expect(validateRequest(frame(SERVICE.testerPresent, 0x00), 'default').valid).toBe(true)
  })
})

describe('parseRequestDownload', () => {
  it('parses address and size with a 2+2 byte format', () => {
    const parsed = parseRequestDownload(frame(0x34, 0x00, 0x22, 0x10, 0x00, 0x04, 0x00))
    expect(parsed).toEqual({ address: 0x1000, size: 0x0400 })
  })

  it('parses a 4-byte address and 3-byte size', () => {
    const parsed = parseRequestDownload(frame(0x34, 0x00, 0x34, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00))
    expect(parsed).toEqual({ address: 0x08000000, size: 0x010000 })
  })

  it('returns null for another service or a short frame', () => {
    expect(parseRequestDownload(frame(0x36, 0x00, 0x11, 0, 0))).toBeNull()
    expect(parseRequestDownload(frame(0x34, 0x00))).toBeNull()
  })
})

describe('isWithinPartition', () => {
  it('accepts a download inside the partition', () => {
    expect(isWithinPartition({ address: 0x1000, size: 0x400 }, 0x1000, 0x4000)).toBe(true)
  })

  it('rejects an address below the partition', () => {
    expect(isWithinPartition({ address: 0x0800, size: 0x400 }, 0x1000, 0x4000)).toBe(false)
  })

  it('rejects a size larger than the partition', () => {
    expect(isWithinPartition({ address: 0x1000, size: 0x5000 }, 0x1000, 0x4000)).toBe(false)
  })
})

describe('isExpectedSequenceCounter', () => {
  it('accepts the next counter', () => {
    expect(isExpectedSequenceCounter(2, 1)).toBe(true)
  })

  it('wraps from 0xFF to 0x00', () => {
    expect(isExpectedSequenceCounter(0x00, 0xff)).toBe(true)
  })

  it('accepts a repeat of the last accepted counter', () => {
    expect(isExpectedSequenceCounter(1, 1)).toBe(true)
  })

  it('rejects a skipped counter', () => {
    expect(isExpectedSequenceCounter(4, 1)).toBe(false)
  })
})

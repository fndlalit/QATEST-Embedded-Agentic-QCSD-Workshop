import { describe, it, expect, vi } from 'vitest'
import { createEventLogger, formatDtc, validateEvent, type UpdateEvent } from '../../src/lib/dtc-logger'

const event = { code: 'U3000-42', severity: 'fault' as const, updateId: 'upd-1' }

describe('formatDtc', () => {
  it('appends the failure type as two hex digits', () => {
    expect(formatDtc('U3000', 0x51)).toBe('U3000-51')
    expect(formatDtc('U3000', 0x0a)).toBe('U3000-0A')
  })
})

describe('validateEvent', () => {
  it('accepts a complete event', () => {
    expect(validateEvent(event)).toBeNull()
  })

  it('requires a code and an update ID', () => {
    expect(validateEvent({ ...event, code: '' })).toBe('Event code is required')
    expect(validateEvent({ ...event, updateId: '' })).toBe('Update ID is required')
  })

  it('rejects an unknown severity', () => {
    expect(validateEvent({ ...event, severity: 'critical' as never })).toBe('Unknown severity')
  })
})

describe('createEventLogger', () => {
  it('buffers events with a timestamp', async () => {
    const stored: UpdateEvent[] = []
    const logger = createEventLogger(async (e) => void stored.push(...e), undefined, () => 1234)
    logger.log(event)
    expect(logger.pending()).toBe(1)
    await logger.flush()
    expect(stored[0]).toEqual({ ...event, timestamp: 1234 })
  })

  it('ignores invalid events', () => {
    const logger = createEventLogger(async () => {})
    logger.log({ ...event, code: '' })
    expect(logger.pending()).toBe(0)
  })

  it('flushes in batches and reports how many were written', async () => {
    const sink = vi.fn().mockResolvedValue(undefined)
    const logger = createEventLogger(sink, { bufferSize: 10, flushBatchSize: 2 })
    for (let i = 0; i < 5; i++) logger.log(event)
    expect(await logger.flush()).toBe(5)
    expect(sink).toHaveBeenCalledTimes(3)
    expect(logger.pending()).toBe(0)
  })

  it('counts events dropped when the buffer is full', () => {
    const logger = createEventLogger(async () => {}, { bufferSize: 2, flushBatchSize: 2 })
    logger.log(event)
    logger.log(event)
    logger.log(event)
    expect(logger.pending()).toBe(2)
    expect(logger.dropped()).toBe(1)
  })

  it('continues after a sink failure', async () => {
    const sink = vi.fn().mockRejectedValueOnce(new Error('nvm busy')).mockResolvedValue(undefined)
    const logger = createEventLogger(sink, { bufferSize: 10, flushBatchSize: 2 })
    for (let i = 0; i < 4; i++) logger.log(event)
    expect(await logger.flush()).toBe(2)
    expect(logger.pending()).toBe(0)
  })

  it('uses Date.now by default', async () => {
    const stored: UpdateEvent[] = []
    const logger = createEventLogger(async (e) => void stored.push(...e))
    logger.log(event)
    await logger.flush()
    expect(stored[0].timestamp).toBeGreaterThan(0)
  })
})

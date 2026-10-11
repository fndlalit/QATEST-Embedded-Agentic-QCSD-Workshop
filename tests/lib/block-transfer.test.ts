import { describe, it, expect, vi } from 'vitest'
import {
  calculateBackoffDelay,
  isRetryableResponse,
  transferBlockWithRetry,
  validateTransferBlock,
  sleep,
  DEFAULT_RETRY_CONFIG,
  type TransferBlockRequest,
  type RetryConfig,
} from '../../src/lib/block-transfer'

const request: TransferBlockRequest = {
  updateId: 'upd-1',
  blockSequenceCounter: 1,
  address: 0,
  payload: new Uint8Array([1, 2, 3, 4]),
}

const fastConfig: RetryConfig = { maxRetries: 3, baseDelayMs: 10, maxDelayMs: 100, backoffMultiplier: 2 }
const noSleep = async () => {}

describe('calculateBackoffDelay', () => {
  it('grows exponentially with the attempt number', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(calculateBackoffDelay(0, fastConfig)).toBe(10)
    expect(calculateBackoffDelay(1, fastConfig)).toBe(20)
    expect(calculateBackoffDelay(2, fastConfig)).toBe(40)
    vi.restoreAllMocks()
  })

  it('caps the exponential part at maxDelayMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(calculateBackoffDelay(10, fastConfig)).toBe(100)
    vi.restoreAllMocks()
  })

  it('adds jitter on top of the delay', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    expect(calculateBackoffDelay(0, fastConfig)).toBe(12)
    vi.restoreAllMocks()
  })

  it('uses the default configuration when none is given', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    expect(calculateBackoffDelay(0)).toBe(DEFAULT_RETRY_CONFIG.baseDelayMs)
    vi.restoreAllMocks()
  })

  it('never returns a negative delay', () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      expect(calculateBackoffDelay(attempt, fastConfig)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('isRetryableResponse', () => {
  it('honours an explicit retryable flag', () => {
    expect(isRetryableResponse({ success: false, retryable: true })).toBe(true)
    expect(isRetryableResponse({ success: false, retryable: false })).toBe(false)
  })

  it.each([
    'securityAccessDenied',
    'requestOutOfRange',
    'wrongBlockSequenceCounter',
    'generalProgrammingFailure',
    'uploadDownloadNotAccepted',
    'voltageTooLow',
  ])('does not retry %s', (nrc) => {
    expect(isRetryableResponse({ success: false, nrc })).toBe(false)
  })

  it.each(['busyRepeatRequest', 'responsePending', 'isoTpTimeout'])('retries %s', (nrc) => {
    expect(isRetryableResponse({ success: false, nrc })).toBe(true)
  })

  it('retries when no code is given', () => {
    expect(isRetryableResponse({ success: false })).toBe(true)
  })
})

describe('transferBlockWithRetry', () => {
  it('returns after the first attempt on success', async () => {
    const send = vi.fn().mockResolvedValue({ success: true, acknowledgedCounter: 1 })
    const result = await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(result.attempts).toBe(1)
    expect(result.response.success).toBe(true)
    expect(result.totalDelayMs).toBe(0)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('retries a busy ECU and then succeeds', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ success: false, nrc: 'busyRepeatRequest' })
      .mockResolvedValueOnce({ success: true, acknowledgedCounter: 1 })
    const result = await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(result.attempts).toBe(2)
    expect(result.response.success).toBe(true)
    expect(result.totalDelayMs).toBeGreaterThan(0)
  })

  it('stops immediately on a non-retryable code', async () => {
    const send = vi.fn().mockResolvedValue({ success: false, nrc: 'generalProgrammingFailure' })
    const result = await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(result.attempts).toBe(1)
    expect(result.response.nrc).toBe('generalProgrammingFailure')
  })

  it('gives up after maxRetries on a persistent busy ECU', async () => {
    const send = vi.fn().mockResolvedValue({ success: false, nrc: 'busyRepeatRequest' })
    const result = await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(result.attempts).toBe(fastConfig.maxRetries + 1)
    expect(send).toHaveBeenCalledTimes(fastConfig.maxRetries + 1)
    expect(result.response.success).toBe(false)
  })

  it('retries a thrown transport error and then succeeds', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error('isoTpTimeout'))
      .mockResolvedValueOnce({ success: true, acknowledgedCounter: 1 })
    const result = await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(result.attempts).toBe(2)
    expect(result.response.success).toBe(true)
  })

  it('reports the error message when transport errors persist', async () => {
    const send = vi.fn().mockRejectedValue(new Error('busOff'))
    const result = await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(result.response).toEqual({ success: false, nrc: 'busOff', retryable: false })
    expect(result.attempts).toBe(fastConfig.maxRetries + 1)
  })

  it('reports transportError for a non-Error rejection', async () => {
    const send = vi.fn().mockRejectedValue('boom')
    const result = await transferBlockWithRetry(request, send, { ...fastConfig, maxRetries: 0 }, noSleep)
    expect(result.response.nrc).toBe('transportError')
  })

  it('sleeps between attempts with the calculated delay', async () => {
    const sleepFn = vi.fn().mockResolvedValue(undefined)
    const send = vi
      .fn()
      .mockResolvedValueOnce({ success: false, nrc: 'busyRepeatRequest' })
      .mockResolvedValueOnce({ success: false, nrc: 'busyRepeatRequest' })
      .mockResolvedValueOnce({ success: true })
    await transferBlockWithRetry(request, send, fastConfig, sleepFn)
    expect(sleepFn).toHaveBeenCalledTimes(2)
  })

  it('sends the same request on every attempt', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ success: false, nrc: 'busyRepeatRequest' })
      .mockResolvedValueOnce({ success: true })
    await transferBlockWithRetry(request, send, fastConfig, noSleep)
    expect(send.mock.calls[0][0]).toBe(request)
    expect(send.mock.calls[1][0]).toBe(request)
  })

  it('makes a single attempt when maxRetries is zero', async () => {
    const send = vi.fn().mockResolvedValue({ success: false, nrc: 'busyRepeatRequest' })
    const result = await transferBlockWithRetry(request, send, { ...fastConfig, maxRetries: 0 }, noSleep)
    expect(result.attempts).toBe(1)
  })

  it('works with the default configuration and sleep', async () => {
    const send = vi.fn().mockResolvedValue({ success: true })
    const result = await transferBlockWithRetry(request, send)
    expect(result.attempts).toBe(1)
  })
})

describe('sleep', () => {
  it('resolves after the given time', async () => {
    vi.useFakeTimers()
    const done = vi.fn()
    const promise = sleep(50).then(done)
    await vi.advanceTimersByTimeAsync(50)
    await promise
    expect(done).toHaveBeenCalled()
    vi.useRealTimers()
  })
})

describe('validateTransferBlock', () => {
  it('accepts a well-formed block', () => {
    expect(validateTransferBlock(request, 1024)).toBeNull()
  })

  it('requires an update ID', () => {
    expect(validateTransferBlock({ ...request, updateId: '' }, 1024)).toBe('Update ID is required')
  })

  it('rejects a negative sequence counter', () => {
    expect(validateTransferBlock({ ...request, blockSequenceCounter: -1 }, 1024)).toBe(
      'Block sequence counter must not be negative'
    )
  })

  it('rejects an empty payload', () => {
    expect(validateTransferBlock({ ...request, payload: new Uint8Array(0) }, 1024)).toBe('Payload must not be empty')
  })

  it('rejects a payload longer than the negotiated block length', () => {
    expect(validateTransferBlock({ ...request, payload: new Uint8Array(2000) }, 1024)).toBe(
      'Payload exceeds the negotiated block length'
    )
  })

  it('rejects a negative address', () => {
    expect(validateTransferBlock({ ...request, address: -4 }, 1024)).toBe('Address must not be negative')
  })
})

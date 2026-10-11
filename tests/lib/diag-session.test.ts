import { describe, it, expect } from 'vitest'
import {
  defaultSession,
  changeSession,
  touch,
  isExpired,
  applyTimeout,
  setTransferActive,
  remainingMs,
} from '../../src/lib/diag-session'
import { S3_SERVER_MS } from '../../src/lib/timing'

describe('changeSession', () => {
  it('enters the extended session from default', () => {
    const { session, nrc } = changeSession(defaultSession(0), 'extended', 10)
    expect(nrc).toBeUndefined()
    expect(session.type).toBe('extended')
    expect(session.lastActivity).toBe(10)
  })

  it('refuses programming directly from default', () => {
    const { session, nrc } = changeSession(defaultSession(0), 'programming', 10)
    expect(nrc).toBe('conditionsNotCorrect')
    expect(session.type).toBe('default')
  })

  it('enters programming from extended', () => {
    const extended = changeSession(defaultSession(0), 'extended', 10).session
    expect(changeSession(extended, 'programming', 20).session.type).toBe('programming')
  })

  it('returns to default on request', () => {
    const extended = changeSession(defaultSession(0), 'extended', 10).session
    expect(changeSession(extended, 'default', 20).session.type).toBe('default')
  })
})

describe('S3 timeout', () => {
  const extended = changeSession(defaultSession(0), 'extended', 0).session

  it('never expires the default session', () => {
    expect(isExpired(defaultSession(0), 1_000_000)).toBe(false)
  })

  it('keeps a session alive inside S3', () => {
    expect(isExpired(extended, S3_SERVER_MS)).toBe(false)
  })

  it('expires a silent session after S3', () => {
    expect(isExpired(extended, S3_SERVER_MS + 1)).toBe(true)
  })

  it('falls back to default when expired', () => {
    expect(applyTimeout(extended, S3_SERVER_MS + 1).type).toBe('default')
  })

  it('leaves a live session unchanged', () => {
    expect(applyTimeout(extended, 100)).toBe(extended)
  })

  it('is refreshed by activity', () => {
    const touched = touch(extended, 4000)
    expect(isExpired(touched, 8000)).toBe(false)
    expect(touched.lastActivity).toBe(4000)
  })

  it('accepts a custom S3 value', () => {
    expect(isExpired(extended, 200, 100)).toBe(true)
  })
})

describe('setTransferActive', () => {
  it('sets and clears the transfer flag', () => {
    const session = changeSession(defaultSession(0), 'extended', 0).session
    expect(setTransferActive(session, true).transferActive).toBe(true)
    expect(setTransferActive(setTransferActive(session, true), false).transferActive).toBe(false)
  })
})

describe('remainingMs', () => {
  it('is infinite for the default session', () => {
    expect(remainingMs(defaultSession(0), 500)).toBe(Infinity)
  })

  it('counts down and stops at zero', () => {
    const extended = changeSession(defaultSession(0), 'extended', 0).session
    expect(remainingMs(extended, 1000)).toBe(S3_SERVER_MS - 1000)
    expect(remainingMs(extended, S3_SERVER_MS * 2)).toBe(0)
  })
})

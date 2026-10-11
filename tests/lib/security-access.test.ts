import { describe, it, expect } from 'vitest'
import {
  computeKey,
  initialSecurityState,
  isLockedOut,
  requestSeed,
  sendKey,
  relock,
  DEFAULT_SECURITY_CONFIG,
} from '../../src/lib/security-access'

const SECRET = 0xbeef
const fixedRandom = () => 0.5

describe('computeKey', () => {
  it('is deterministic for a seed and secret', () => {
    expect(computeKey(0x1111, SECRET)).toBe(computeKey(0x1111, SECRET))
  })

  it('differs for different seeds', () => {
    expect(computeKey(0x1111, SECRET)).not.toBe(computeKey(0x2222, SECRET))
  })
})

describe('requestSeed', () => {
  it('hands out a non-zero seed and stores it', () => {
    const result = requestSeed(initialSecurityState(), 0, fixedRandom)
    expect(result.seed).toBeGreaterThan(0)
    expect(result.state.pendingSeed).toBe(result.seed)
  })

  it('answers with a zero seed when already unlocked', () => {
    const state = { ...initialSecurityState(), unlocked: true }
    expect(requestSeed(state, 0, fixedRandom).seed).toBe(0)
  })

  it('refuses while locked out', () => {
    const state = { ...initialSecurityState(), lockedUntil: 1000 }
    expect(requestSeed(state, 500, fixedRandom).nrc).toBe('requiredTimeDelayNotExpired')
  })

  it('uses Math.random by default', () => {
    expect(requestSeed(initialSecurityState(), 0).seed).toBeGreaterThan(0)
  })
})

describe('sendKey', () => {
  const seeded = () => requestSeed(initialSecurityState(), 0, fixedRandom)

  it('unlocks with the correct key', () => {
    const { state, seed } = seeded()
    const result = sendKey(state, computeKey(seed!, SECRET), SECRET, 10)
    expect(result.unlocked).toBe(true)
    expect(result.state.unlocked).toBe(true)
    expect(result.state.pendingSeed).toBeNull()
  })

  it('rejects a wrong key and counts the attempt', () => {
    const { state } = seeded()
    const result = sendKey(state, 0, SECRET, 10)
    expect(result.unlocked).toBe(false)
    expect(result.nrc).toBe('invalidKey')
    expect(result.state.failedAttempts).toBe(1)
  })

  it('locks out after the configured number of wrong keys', () => {
    let { state } = seeded()
    state = sendKey(state, 0, SECRET, 10).state
    state = sendKey(state, 0, SECRET, 20).state
    const third = sendKey(state, 0, SECRET, 30)
    expect(third.nrc).toBe('exceededNumberOfAttempts')
    expect(third.state.lockedUntil).toBe(30 + DEFAULT_SECURITY_CONFIG.lockoutMs)
    expect(isLockedOut(third.state, 31)).toBe(true)
  })

  it('refuses a key while locked out', () => {
    const state = { ...initialSecurityState(), lockedUntil: 1000, pendingSeed: 5 }
    expect(sendKey(state, 1, SECRET, 500).nrc).toBe('requiredTimeDelayNotExpired')
  })

  it('refuses a key when no seed was requested', () => {
    expect(sendKey(initialSecurityState(), 1, SECRET, 0).nrc).toBe('requestSequenceError')
  })

  it('allows a new attempt after the lockout expires', () => {
    const state = { ...initialSecurityState(), lockedUntil: 1000 }
    expect(isLockedOut(state, 1000)).toBe(false)
    expect(requestSeed(state, 1000, fixedRandom).seed).toBeGreaterThan(0)
  })
})

describe('relock', () => {
  it('locks the ECU and clears the pending seed', () => {
    const state = relock({ unlocked: true, failedAttempts: 0, lockedUntil: 0, pendingSeed: 7 })
    expect(state.unlocked).toBe(false)
    expect(state.pendingSeed).toBeNull()
  })
})

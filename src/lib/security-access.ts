// SecurityAccess (0x27) seed/key handling with attempt limiting.
// The ECU hands out a seed; the tester must answer with the matching key
// before programming services are unlocked.

export interface SecurityAccessConfig {
  maxAttempts: number
  lockoutMs: number
}

export const DEFAULT_SECURITY_CONFIG: SecurityAccessConfig = {
  maxAttempts: 3,
  lockoutMs: 10 * 60 * 1000,
}

export interface SecurityState {
  unlocked: boolean
  failedAttempts: number
  lockedUntil: number
  pendingSeed: number | null
}

export const initialSecurityState = (): SecurityState => ({
  unlocked: false,
  failedAttempts: 0,
  lockedUntil: 0,
  pendingSeed: null,
})

/**
 * Derives the expected key from a seed. Demo algorithm, not a real one.
 */
export const computeKey = (seed: number, secret: number): number => ((seed ^ secret) + 0x1234) >>> 0

/**
 * Returns true while the lockout period is running.
 */
export const isLockedOut = (state: SecurityState, now: number): boolean => now < state.lockedUntil

export interface SeedResult {
  state: SecurityState
  seed?: number
  nrc?: string
}

/**
 * Handles requestSeed (0x27 0x01).
 */
export const requestSeed = (
  state: SecurityState,
  now: number,
  random: () => number = Math.random
): SeedResult => {
  if (isLockedOut(state, now)) {
    return { state, nrc: 'requiredTimeDelayNotExpired' }
  }

  if (state.unlocked) {
    // Already unlocked: ISO 14229 answers with a zero seed.
    return { state, seed: 0 }
  }

  const seed = Math.floor(random() * 0xffff) + 1
  return {
    state: { ...state, pendingSeed: seed, failedAttempts: 0 },
    seed,
  }
}

export interface KeyResult {
  state: SecurityState
  unlocked: boolean
  nrc?: string
}

/**
 * Handles sendKey (0x27 0x02).
 */
export const sendKey = (
  state: SecurityState,
  key: number,
  secret: number,
  now: number,
  config: SecurityAccessConfig = DEFAULT_SECURITY_CONFIG
): KeyResult => {
  if (isLockedOut(state, now)) {
    return { state, unlocked: false, nrc: 'requiredTimeDelayNotExpired' }
  }

  if (state.pendingSeed === null) {
    return { state, unlocked: false, nrc: 'requestSequenceError' }
  }

  if (key === computeKey(state.pendingSeed, secret)) {
    return {
      state: { unlocked: true, failedAttempts: 0, lockedUntil: 0, pendingSeed: null },
      unlocked: true,
    }
  }

  const failedAttempts = state.failedAttempts + 1
  if (failedAttempts >= config.maxAttempts) {
    return {
      state: { ...state, failedAttempts, lockedUntil: now + config.lockoutMs, pendingSeed: null },
      unlocked: false,
      nrc: 'exceededNumberOfAttempts',
    }
  }

  return {
    state: { ...state, failedAttempts },
    unlocked: false,
    nrc: 'invalidKey',
  }
}

/**
 * Locks the ECU again, for example after a session change or reset.
 */
export const relock = (state: SecurityState): SecurityState => ({
  ...state,
  unlocked: false,
  pendingSeed: null,
})

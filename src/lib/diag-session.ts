// Diagnostic session management with S3 timeout handling.
// A non-default session must fall back to the default session when the tester
// goes silent for longer than S3.

import { S3_SERVER_MS } from './timing'
import type { SessionType } from './uds-validation'

export interface DiagSession {
  type: SessionType
  /** Timestamp of the last frame that kept the session alive. */
  lastActivity: number
  /** True while a download is in progress in this session. */
  transferActive: boolean
}

export const defaultSession = (now: number): DiagSession => ({
  type: 'default',
  lastActivity: now,
  transferActive: false,
})

/**
 * Switches to another session type. Programming may only be entered from extended.
 */
export const changeSession = (
  session: DiagSession,
  target: SessionType,
  now: number
): { session: DiagSession; nrc?: string } => {
  if (target === 'programming' && session.type === 'default') {
    return { session, nrc: 'conditionsNotCorrect' }
  }
  return { session: { type: target, lastActivity: now, transferActive: false } }
}

/**
 * Records activity from the tester. Any received frame refreshes the session.
 */
export const touch = (session: DiagSession, now: number): DiagSession => ({
  ...session,
  lastActivity: now,
})

/**
 * Returns true when the session has been silent for longer than S3.
 */
export const isExpired = (session: DiagSession, now: number, s3Ms: number = S3_SERVER_MS): boolean => {
  if (session.type === 'default') return false
  if (session.transferActive) return false
  return now - session.lastActivity > s3Ms
}

/**
 * Applies the S3 timeout: an expired session falls back to the default session.
 */
export const applyTimeout = (session: DiagSession, now: number, s3Ms: number = S3_SERVER_MS): DiagSession =>
  isExpired(session, now, s3Ms) ? defaultSession(now) : session

/**
 * Marks a download as started or finished.
 */
export const setTransferActive = (session: DiagSession, active: boolean): DiagSession => ({
  ...session,
  transferActive: active,
})

/**
 * Time left before the session expires, in milliseconds.
 */
export const remainingMs = (session: DiagSession, now: number, s3Ms: number = S3_SERVER_MS): number => {
  if (session.type === 'default') return Infinity
  return Math.max(0, s3Ms - (now - session.lastActivity))
}

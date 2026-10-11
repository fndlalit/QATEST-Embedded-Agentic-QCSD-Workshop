// Firmware block transfer with retry and exponential backoff.
// Sends one firmware block to the ECU over UDS TransferData (0x36) and retries
// transient failures.

import { P2_STAR_SERVER_MAX_MS } from './timing'

export interface TransferBlockRequest {
  updateId: string
  /** UDS blockSequenceCounter, 0x00 to 0xFF, wraps after 0xFF. */
  blockSequenceCounter: number
  /** Start address of this block inside the target partition. */
  address: number
  payload: Uint8Array
}

export interface TransferBlockResponse {
  success: boolean
  /** Counter echoed by the ECU in the positive response. */
  acknowledgedCounter?: number
  /** Negative response code name, for example 'requestOutOfRange'. */
  nrc?: string
  retryable?: boolean
}

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  // The wait before a retry must never exceed the enhanced response timeout.
  maxDelayMs: P2_STAR_SERVER_MAX_MS,
  backoffMultiplier: 2,
}

/**
 * Calculates the delay before a given retry attempt using exponential backoff with jitter.
 */
export const calculateBackoffDelay = (
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number => {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)
  // Add jitter: random value between 0 and 50% of the delay
  const jitter = Math.random() * cappedDelay * 0.5
  return Math.floor(cappedDelay + jitter)
}

/**
 * Determines whether a negative response from the ECU may be retried.
 */
export const isRetryableResponse = (response: TransferBlockResponse): boolean => {
  if (response.retryable !== undefined) return response.retryable

  // Negative response codes that must never be retried
  const nonRetryable = [
    'securityAccessDenied',
    'requestOutOfRange',
    'wrongBlockSequenceCounter',
    'generalProgrammingFailure',
    'uploadDownloadNotAccepted',
    'voltageTooLow',
  ]

  if (response.nrc && nonRetryable.includes(response.nrc)) return false

  // busyRepeatRequest, responsePending and transport timeouts are retryable by default
  return true
}

/**
 * Sleeps for the given number of milliseconds.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export interface TransferResult {
  response: TransferBlockResponse
  attempts: number
  totalDelayMs: number
}

/**
 * Sends one firmware block and retries on transient failures.
 */
export const transferBlockWithRetry = async (
  request: TransferBlockRequest,
  sendBlock: (req: TransferBlockRequest) => Promise<TransferBlockResponse>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  sleepFn: (ms: number) => Promise<void> = sleep
): Promise<TransferResult> => {
  let totalDelayMs = 0

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await sendBlock(request)

      if (response.success) {
        return { response, attempts: attempt + 1, totalDelayMs }
      }

      if (!isRetryableResponse(response) || attempt === config.maxRetries) {
        return { response, attempts: attempt + 1, totalDelayMs }
      }

      const delay = calculateBackoffDelay(attempt, config)
      totalDelayMs += delay
      await sleepFn(delay)
    } catch (error) {
      // Transport errors (CAN bus-off, ISO-TP timeout) are always retried
      if (attempt === config.maxRetries) {
        return {
          response: {
            success: false,
            nrc: error instanceof Error ? error.message : 'transportError',
            retryable: false,
          },
          attempts: attempt + 1,
          totalDelayMs,
        }
      }

      const delay = calculateBackoffDelay(attempt, config)
      totalDelayMs += delay
      await sleepFn(delay)
    }
  }

  return {
    response: { success: false, nrc: 'maxRetriesExceeded', retryable: false },
    attempts: config.maxRetries + 1,
    totalDelayMs,
  }
}

/**
 * Validates a block before it is sent.
 */
export const validateTransferBlock = (
  request: TransferBlockRequest,
  maxBlockLength: number
): string | null => {
  if (!request.updateId) return 'Update ID is required'
  if (request.blockSequenceCounter < 0) return 'Block sequence counter must not be negative'
  if (!request.payload || request.payload.length === 0) return 'Payload must not be empty'
  if (request.payload.length > maxBlockLength) return 'Payload exceeds the negotiated block length'
  if (request.address < 0) return 'Address must not be negative'
  return null
}

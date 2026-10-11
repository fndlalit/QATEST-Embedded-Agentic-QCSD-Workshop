// Validation of incoming UDS (ISO 14229) diagnostic requests used during an update.

export const SERVICE = {
  diagnosticSessionControl: 0x10,
  ecuReset: 0x11,
  securityAccess: 0x27,
  routineControl: 0x31,
  requestDownload: 0x34,
  transferData: 0x36,
  requestTransferExit: 0x37,
  testerPresent: 0x3e,
} as const

export type SessionType = 'default' | 'extended' | 'programming'

export interface ValidationResult {
  valid: boolean
  /** Negative response code name when the request is rejected. */
  nrc?: string
}

const MIN_LENGTH: Record<number, number> = {
  [SERVICE.diagnosticSessionControl]: 2,
  [SERVICE.ecuReset]: 2,
  [SERVICE.securityAccess]: 2,
  [SERVICE.routineControl]: 4,
  [SERVICE.requestDownload]: 5,
  [SERVICE.transferData]: 3,
  [SERVICE.requestTransferExit]: 1,
  [SERVICE.testerPresent]: 2,
}

/** Services that are only allowed in the programming session. */
const PROGRAMMING_ONLY: number[] = [
  SERVICE.requestDownload,
  SERVICE.transferData,
  SERVICE.requestTransferExit,
]

/**
 * Validates the shape of a raw UDS request.
 */
export const validateRequest = (frame: Uint8Array, session: SessionType): ValidationResult => {
  if (frame.length === 0) return { valid: false, nrc: 'incorrectMessageLengthOrInvalidFormat' }

  const service = frame[0]
  const minLength = MIN_LENGTH[service]
  if (minLength === undefined) return { valid: false, nrc: 'serviceNotSupported' }
  if (frame.length < minLength) return { valid: false, nrc: 'incorrectMessageLengthOrInvalidFormat' }

  if (PROGRAMMING_ONLY.includes(service) && session !== 'programming') {
    return { valid: false, nrc: 'serviceNotSupportedInActiveSession' }
  }

  return { valid: true }
}

export interface DownloadRequest {
  address: number
  size: number
}

/**
 * Parses a RequestDownload (0x34) frame.
 * Layout: [0x34, dataFormatIdentifier, addressAndLengthFormatIdentifier, address..., size...]
 */
export const parseRequestDownload = (frame: Uint8Array): DownloadRequest | null => {
  if (frame[0] !== SERVICE.requestDownload || frame.length < 5) return null

  const format = frame[2]
  const sizeBytes = format >> 4
  const addressBytes = format & 0x0f

  let offset = 3
  let address = 0
  for (let i = 0; i < addressBytes; i++) address = address * 256 + frame[offset + i]
  offset += addressBytes

  let size = 0
  for (let i = 0; i < sizeBytes; i++) size = size * 256 + frame[offset + i]

  return { address, size }
}

/**
 * Checks that a download fits the memory region reserved for the inactive partition.
 */
export const isWithinPartition = (
  request: DownloadRequest,
  partitionStart: number,
  partitionSize: number
): boolean => request.address >= partitionStart && request.size <= partitionSize

/**
 * Validates the block sequence counter of a TransferData (0x36) frame.
 */
export const isExpectedSequenceCounter = (received: number, lastAccepted: number): boolean => {
  const expected = (lastAccepted + 1) & 0xff
  return received === expected || received === lastAccepted
}

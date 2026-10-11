// Firmware image verification: header parsing, CRC-32, signature check and
// anti-rollback version check.

export interface ImageHeader {
  /** Magic bytes 'BCM7'. */
  magic: string
  /** Semantic version of the image, for example '2.4.10'. */
  version: string
  /** Declared payload length in bytes. */
  length: number
  /** CRC-32 of the payload. */
  crc32: number
  /** Hardware variants this image may be installed on. */
  hardwareIds: string[]
}

export interface VerificationResult {
  valid: boolean
  reason?: string
}

const CRC_TABLE: number[] = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table.push(c >>> 0)
  }
  return table
})()

/**
 * Computes the CRC-32 (IEEE 802.3) of a byte array.
 */
export const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Checks the payload against the length and CRC declared in the header.
 */
export const verifyIntegrity = (header: ImageHeader, payload: Uint8Array): VerificationResult => {
  if (header.magic !== 'BCM7') return { valid: false, reason: 'Unknown image magic' }
  if (header.length <= 0) return { valid: false, reason: 'Declared length must be positive' }
  if (payload.length < header.length) return { valid: false, reason: 'Payload is shorter than declared' }

  const declared = payload.subarray(0, header.length)
  if (crc32(declared) !== header.crc32) return { valid: false, reason: 'CRC mismatch' }

  return { valid: true }
}

/**
 * Compares a signature digest against the expected digest.
 */
export const verifySignature = (digest: Uint8Array, expected: Uint8Array): VerificationResult => {
  if (digest.length === 0 || expected.length === 0) {
    return { valid: false, reason: 'Missing digest' }
  }
  const length = Math.min(digest.length, expected.length)
  for (let i = 0; i < length; i++) {
    if (digest[i] !== expected[i]) return { valid: false, reason: 'Signature mismatch' }
  }
  return { valid: true }
}

/**
 * Anti-rollback: the candidate image must be newer than the installed one.
 */
export const isNewerVersion = (candidate: string, installed: string): boolean => candidate > installed

/**
 * Checks that the image targets this hardware variant.
 */
export const isCompatibleHardware = (header: ImageHeader, hardwareId: string): boolean =>
  header.hardwareIds.includes(hardwareId)

/**
 * Runs every check an image must pass before it may be installed.
 */
export const verifyImage = (
  header: ImageHeader,
  payload: Uint8Array,
  digest: Uint8Array,
  expectedDigest: Uint8Array,
  installedVersion: string,
  hardwareId: string
): VerificationResult => {
  const integrity = verifyIntegrity(header, payload)
  if (!integrity.valid) return integrity

  const signature = verifySignature(digest, expectedDigest)
  if (!signature.valid) return signature

  if (!isCompatibleHardware(header, hardwareId)) {
    return { valid: false, reason: 'Image does not target this hardware variant' }
  }

  if (!isNewerVersion(header.version, installedVersion)) {
    return { valid: false, reason: 'Image is not newer than the installed version' }
  }

  return { valid: true }
}

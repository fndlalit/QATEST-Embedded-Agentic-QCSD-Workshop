// A simulated Body Control Module that answers TransferData requests.
// It replaces real hardware so the update flow can run on a laptop.

import type { TransferBlockRequest, TransferBlockResponse } from '../lib/block-transfer'

export interface SimulatorOptions {
  /** Probability (0 to 1) that the ECU answers busyRepeatRequest. */
  busyRate: number
  /** Probability (0 to 1) that a response is lost after the block was written. */
  lostResponseRate: number
  /** Block index (1-based) at which the ECU reports a programming failure, or 0 for never. */
  failAtBlock: number
  /**
   * Block index (1-based) during which the ECU loses power, or 0 for never.
   * The block is half written, the response never comes, and after the reboot
   * the ECU is back in the default session and rejects further TransferData.
   */
  powerLossAtBlock: number
  random: () => number
}

export const DEFAULT_SIMULATOR_OPTIONS: SimulatorOptions = {
  busyRate: 0.1,
  lostResponseRate: 0.05,
  failAtBlock: 0,
  powerLossAtBlock: 0,
  random: Math.random,
}

export interface EcuSimulator {
  sendBlock: (req: TransferBlockRequest) => Promise<TransferBlockResponse>
  /** Every block the ECU has written to flash, in order, including duplicates. */
  flashLog: () => { counter: number; address: number; length: number }[]
  bytesInFlash: () => number
  /** True once the simulated ECU has lost power and rebooted. */
  rebooted: () => boolean
}

/**
 * Creates a simulated ECU.
 */
export const createEcuSimulator = (options: Partial<SimulatorOptions> = {}): EcuSimulator => {
  const opts = { ...DEFAULT_SIMULATOR_OPTIONS, ...options }
  const log: { counter: number; address: number; length: number }[] = []
  let writes = 0
  let rebooted = false

  const sendBlock = async (req: TransferBlockRequest): Promise<TransferBlockResponse> => {
    if (rebooted) {
      // After a reboot the programming session is gone: no RequestDownload, no transfer.
      return { success: false, nrc: 'requestSequenceError' }
    }

    if (opts.random() < opts.busyRate) {
      return { success: false, nrc: 'busyRepeatRequest' }
    }

    writes++
    if (opts.failAtBlock > 0 && writes === opts.failAtBlock) {
      return { success: false, nrc: 'generalProgrammingFailure' }
    }

    if (opts.powerLossAtBlock > 0 && writes === opts.powerLossAtBlock) {
      // Power is cut halfway through the flash write. The tester sees no response.
      log.push({ counter: req.blockSequenceCounter, address: req.address, length: Math.floor(req.payload.length / 2) })
      rebooted = true
      throw new Error('noResponse')
    }

    // The block is written to flash before the response is sent.
    log.push({ counter: req.blockSequenceCounter, address: req.address, length: req.payload.length })

    if (opts.random() < opts.lostResponseRate) {
      throw new Error('isoTpTimeout')
    }

    return { success: true, acknowledgedCounter: req.blockSequenceCounter }
  }

  return {
    sendBlock,
    flashLog: () => [...log],
    bytesInFlash: () => log.reduce((sum, entry) => sum + entry.length, 0),
    rebooted: () => rebooted,
  }
}

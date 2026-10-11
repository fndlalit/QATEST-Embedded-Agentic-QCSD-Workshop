// Orchestrates one firmware update of the Body Control Module:
// preconditions -> download -> verify -> install -> activate -> commit or roll back.

import { transferBlockWithRetry, type TransferBlockRequest, type TransferBlockResponse } from '../lib/block-transfer'
import { verifyImage, type ImageHeader } from '../lib/image-verify'
import type { EventLogger } from '../lib/dtc-logger'
import { UPDATE_BUDGET_MS } from '../lib/timing'
import { checkPreconditions, type VehicleState } from './preconditions'
import {
  eraseInactive,
  markBootable,
  recordWrite,
  switchActive,
  type PartitionTable,
} from './partition-manager'

export type UpdatePhase =
  | 'idle'
  | 'checkingPreconditions'
  | 'downloading'
  | 'verifying'
  | 'activating'
  | 'committed'
  | 'rolledBack'
  | 'failed'

export interface UpdatePackage {
  updateId: string
  header: ImageHeader
  payload: Uint8Array
  digest: Uint8Array
  expectedDigest: Uint8Array
}

export interface UpdateContext {
  hardwareId: string
  blockLength: number
  partitions: PartitionTable
  readVehicleState: () => VehicleState
  sendBlock: (req: TransferBlockRequest) => Promise<TransferBlockResponse>
  /** Asks the ECU to reboot into the new slot and reports whether it came up healthy. */
  activate: () => Promise<boolean>
  logger: EventLogger
  now: () => number
}

export interface UpdateOutcome {
  phase: UpdatePhase
  partitions: PartitionTable
  blocksSent: number
  retries: number
  elapsedMs: number
  reason?: string
}

/**
 * Splits a payload into transfer blocks.
 */
export const splitIntoBlocks = (payload: Uint8Array, blockLength: number): Uint8Array[] => {
  const blocks: Uint8Array[] = []
  for (let offset = 0; offset < payload.length; offset += blockLength) {
    blocks.push(payload.subarray(offset, offset + blockLength))
  }
  return blocks
}

/**
 * Percentage of the image that has been transferred, 0 to 100.
 */
export const progressPercent = (blocksSent: number, totalBlocks: number): number =>
  totalBlocks === 0 ? 0 : Math.round((blocksSent / totalBlocks) * 100)

/**
 * Runs a complete update and returns its outcome.
 */
export const runUpdate = async (pkg: UpdatePackage, ctx: UpdateContext): Promise<UpdateOutcome> => {
  const startedAt = ctx.now()
  let partitions = ctx.partitions
  let blocksSent = 0
  let retries = 0

  const finish = (phase: UpdatePhase, reason?: string): UpdateOutcome => ({
    phase,
    partitions,
    blocksSent,
    retries,
    elapsedMs: ctx.now() - startedAt,
    reason,
  })

  // 1. Preconditions
  const preconditions = checkPreconditions(ctx.readVehicleState())
  if (!preconditions.ok) {
    ctx.logger.log({ code: 'U3000-01', severity: 'warning', updateId: pkg.updateId, detail: preconditions.failed.join(',') })
    return finish('failed', `Preconditions not met: ${preconditions.failed.join(', ')}`)
  }

  // 2. Download into the inactive slot
  partitions = eraseInactive(partitions)
  const blocks = splitIntoBlocks(pkg.payload, ctx.blockLength)

  for (let index = 0; index < blocks.length; index++) {
    const request: TransferBlockRequest = {
      updateId: pkg.updateId,
      blockSequenceCounter: (index + 1) & 0xff,
      address: index * ctx.blockLength,
      payload: blocks[index],
    }

    const result = await transferBlockWithRetry(request, ctx.sendBlock)
    retries += result.attempts - 1

    if (!result.response.success) {
      ctx.logger.log({ code: 'U3000-42', severity: 'fault', updateId: pkg.updateId, detail: result.response.nrc })
      return finish('failed', `Block ${index + 1} failed: ${result.response.nrc}`)
    }

    partitions = recordWrite(partitions, blocks[index].length)
    blocksSent++
  }

  // 3. Mark the new image bootable, then verify it
  partitions = markBootable(partitions, pkg.header.version)

  const installedVersion = ctx.partitions.slots[ctx.partitions.active].version
  const verification = verifyImage(
    pkg.header,
    pkg.payload,
    pkg.digest,
    pkg.expectedDigest,
    installedVersion,
    ctx.hardwareId
  )
  if (!verification.valid) {
    ctx.logger.log({ code: 'U3000-51', severity: 'fault', updateId: pkg.updateId, detail: verification.reason })
    return finish('failed', verification.reason)
  }

  // 4. Activate the new slot
  partitions = switchActive(partitions)
  const healthy = await ctx.activate()

  if (!healthy) {
    partitions = switchActive(partitions)
    ctx.logger.log({ code: 'U3000-60', severity: 'fault', updateId: pkg.updateId, detail: 'activation failed' })
    return finish('rolledBack', 'New image did not come up healthy')
  }

  // 5. Commit
  const elapsed = ctx.now() - startedAt
  if (elapsed > UPDATE_BUDGET_MS) {
    ctx.logger.log({ code: 'U3000-70', severity: 'warning', updateId: pkg.updateId, detail: `took ${elapsed} ms` })
  }
  ctx.logger.log({ code: 'U3000-00', severity: 'info', updateId: pkg.updateId, detail: pkg.header.version })
  await ctx.logger.flush()

  return finish('committed')
}

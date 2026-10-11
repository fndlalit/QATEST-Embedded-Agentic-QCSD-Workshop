import { describe, it, expect } from 'vitest'
import { splitIntoBlocks, progressPercent, runUpdate, type UpdatePackage, type UpdateContext } from '../../src/ota/update-manager'
import { crc32 } from '../../src/lib/image-verify'
import { createEventLogger } from '../../src/lib/dtc-logger'
import { createPartitionTable } from '../../src/ota/partition-manager'
import { nominalVehicleState } from '../../src/ota/preconditions'

const payload = new Uint8Array(64).map((_, i) => i)
const digest = new Uint8Array([1, 2, 3, 4])

const pkg: UpdatePackage = {
  updateId: 'upd-1',
  header: { magic: 'BCM7', version: '2.5.0', length: payload.length, crc32: crc32(payload), hardwareIds: ['BCM7-H2'] },
  payload,
  digest,
  expectedDigest: digest,
}

const context = (overrides: Partial<UpdateContext> = {}): UpdateContext => ({
  hardwareId: 'BCM7-H2',
  blockLength: 16,
  partitions: createPartitionTable('2.4.9', 64),
  readVehicleState: nominalVehicleState,
  sendBlock: async (req) => ({ success: true, acknowledgedCounter: req.blockSequenceCounter }),
  activate: async () => true,
  logger: createEventLogger(async () => {}),
  now: () => 0,
  ...overrides,
})

describe('splitIntoBlocks', () => {
  it('splits a payload into blocks of the given length', () => {
    const blocks = splitIntoBlocks(new Uint8Array(10), 4)
    expect(blocks.map((b) => b.length)).toEqual([4, 4, 2])
  })

  it('returns no blocks for an empty payload', () => {
    expect(splitIntoBlocks(new Uint8Array(0), 4)).toEqual([])
  })
})

describe('progressPercent', () => {
  it('rounds to a whole percentage', () => {
    expect(progressPercent(1, 3)).toBe(33)
    expect(progressPercent(3, 3)).toBe(100)
  })

  it('is zero when there are no blocks', () => {
    expect(progressPercent(0, 0)).toBe(0)
  })
})

describe('runUpdate', () => {
  it('commits a valid update and switches the active slot', async () => {
    const outcome = await runUpdate(pkg, context())
    expect(outcome.phase).toBe('committed')
    expect(outcome.blocksSent).toBe(4)
    expect(outcome.partitions.active).toBe('B')
    expect(outcome.partitions.slots.B.version).toBe('2.5.0')
  })

  it('refuses to start when the vehicle is moving', async () => {
    const outcome = await runUpdate(
      pkg,
      context({ readVehicleState: () => ({ ...nominalVehicleState(), speedKph: 30 }) })
    )
    expect(outcome.phase).toBe('failed')
    expect(outcome.reason).toContain('vehicleMoving')
    expect(outcome.blocksSent).toBe(0)
  })
})

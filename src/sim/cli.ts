// Runs one simulated firmware update end to end and prints what happened.
// Usage: npm run simulate            (healthy link)
//        npm run simulate -- --lossy (responses get lost after the block is written)

import { crc32 } from '../lib/image-verify'
import { createEventLogger, type UpdateEvent } from '../lib/dtc-logger'
import { nominalVehicleState } from '../ota/preconditions'
import { createPartitionTable } from '../ota/partition-manager'
import { runUpdate, type UpdatePackage } from '../ota/update-manager'
import { createEcuSimulator } from './ecu-simulator'

const IMAGE_SIZE = 16 * 1024
const BLOCK_LENGTH = 1024

const SEED = Number(process.env.SIM_SEED ?? 7)

// Small deterministic generator (mulberry32), used only by the lossy run.
const seededRandom = (seed: number): (() => number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const buildPackage = (): UpdatePackage => {
  const payload = new Uint8Array(IMAGE_SIZE)
  for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) & 0xff
  const digest = new Uint8Array([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02, 0x03, 0x04])

  return {
    updateId: 'upd-2026-10-14-001',
    header: {
      magic: 'BCM7',
      version: '2.5.0',
      length: payload.length,
      crc32: crc32(payload),
      hardwareIds: ['BCM7-H2', 'BCM7-H3'],
    },
    payload,
    digest,
    expectedDigest: digest,
  }
}

const main = async (): Promise<void> => {
  const stored: UpdateEvent[] = []
  const logger = createEventLogger(async (events) => {
    stored.push(...events)
  })
  // `npm run simulate -- --lossy` makes the ECU lose one response in three.
  const lossy = process.argv.includes('--lossy')
  // Both runs are repeatable: the healthy link never fails, and the lossy link
  // draws from a fixed-seed generator so everyone in the room sees the same result.
  const ecu = createEcuSimulator(
    lossy
      ? { busyRate: 0, lostResponseRate: 0.33, random: seededRandom(SEED) }
      : { busyRate: 0, lostResponseRate: 0 },
  )
  const pkg = buildPackage()

  // Retries wait for their real backoff delay, so a run takes a few seconds.
  const outcome = await runUpdate(pkg, {
    hardwareId: 'BCM7-H2',
    blockLength: BLOCK_LENGTH,
    partitions: createPartitionTable('2.4.10', IMAGE_SIZE),
    readVehicleState: nominalVehicleState,
    sendBlock: ecu.sendBlock,
    activate: async () => true,
    logger,
    now: Date.now,
  })

  console.log(`Update ${pkg.updateId} to version ${pkg.header.version}`)
  console.log(`  phase:        ${outcome.phase}`)
  console.log(`  blocks sent:  ${outcome.blocksSent}`)
  console.log(`  retries:      ${outcome.retries}`)
  console.log(`  active slot:  ${outcome.partitions.active}`)
  console.log(`  image size:   ${IMAGE_SIZE} bytes`)
  console.log(`  flash writes: ${ecu.flashLog().length} blocks, ${ecu.bytesInFlash()} bytes`)
  console.log(`  events:       ${stored.map((e) => e.code).join(', ') || 'none'}`)
  if (outcome.reason) console.log(`  reason:       ${outcome.reason}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

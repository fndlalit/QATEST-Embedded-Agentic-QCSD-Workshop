import { describe, it, expect } from 'vitest'
import { createPartitionTable, inactiveSlot, eraseInactive, switchActive } from '../../src/ota/partition-manager'

describe('partition table', () => {
  it('starts with slot A active and bootable', () => {
    const table = createPartitionTable('2.4.10', 4096)
    expect(table.active).toBe('A')
    expect(table.slots.A.bootable).toBe(true)
    expect(table.slots.B.bootable).toBe(false)
  })

  it('reports the inactive slot', () => {
    const table = createPartitionTable('2.4.10', 4096)
    expect(inactiveSlot(table)).toBe('B')
    expect(inactiveSlot(switchActive(table))).toBe('A')
  })

  it('erases only the inactive slot', () => {
    const table = eraseInactive(createPartitionTable('2.4.10', 4096))
    expect(table.slots.A.version).toBe('2.4.10')
    expect(table.slots.B.bytesWritten).toBe(0)
  })
})

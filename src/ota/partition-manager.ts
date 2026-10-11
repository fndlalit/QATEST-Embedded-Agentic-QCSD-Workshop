// A/B partition bookkeeping for the firmware update.
// The ECU runs from the active slot and installs a new image into the inactive one.

export type Slot = 'A' | 'B'

export interface SlotInfo {
  version: string
  bootable: boolean
  /** Remaining boot attempts before the bootloader gives up on this slot. */
  triesRemaining: number
  bytesWritten: number
}

export interface PartitionTable {
  active: Slot
  slots: Record<Slot, SlotInfo>
  slotSize: number
}

export const MAX_BOOT_TRIES = 3

export const createPartitionTable = (installedVersion: string, slotSize: number): PartitionTable => ({
  active: 'A',
  slots: {
    A: { version: installedVersion, bootable: true, triesRemaining: MAX_BOOT_TRIES, bytesWritten: slotSize },
    B: { version: '0.0.0', bootable: false, triesRemaining: 0, bytesWritten: 0 },
  },
  slotSize,
})

export const inactiveSlot = (table: PartitionTable): Slot => (table.active === 'A' ? 'B' : 'A')

/**
 * Erases the inactive slot so a new image can be written.
 */
export const eraseInactive = (table: PartitionTable): PartitionTable => {
  const slot = inactiveSlot(table)
  return {
    ...table,
    slots: {
      ...table.slots,
      [slot]: { version: '0.0.0', bootable: false, triesRemaining: 0, bytesWritten: 0 },
    },
  }
}

/**
 * Records a block written to the inactive slot.
 */
export const recordWrite = (table: PartitionTable, length: number): PartitionTable => {
  const slot = inactiveSlot(table)
  const info = table.slots[slot]
  return {
    ...table,
    slots: { ...table.slots, [slot]: { ...info, bytesWritten: info.bytesWritten + length } },
  }
}

/**
 * Marks the inactive slot as bootable with the given version.
 */
export const markBootable = (table: PartitionTable, version: string): PartitionTable => {
  const slot = inactiveSlot(table)
  return {
    ...table,
    slots: {
      ...table.slots,
      [slot]: { ...table.slots[slot], version, bootable: true, triesRemaining: MAX_BOOT_TRIES },
    },
  }
}

/**
 * Switches the active slot. The previous slot stays available for rollback.
 */
export const switchActive = (table: PartitionTable): PartitionTable => ({
  ...table,
  active: inactiveSlot(table),
})

/**
 * Called by the bootloader on every boot attempt of the active slot.
 */
export const consumeBootTry = (table: PartitionTable): PartitionTable => {
  const info = table.slots[table.active]
  return {
    ...table,
    slots: { ...table.slots, [table.active]: { ...info, triesRemaining: info.triesRemaining - 1 } },
  }
}

/**
 * Rolls back to the other slot when the active one can no longer boot.
 */
export const rollbackIfNeeded = (table: PartitionTable): PartitionTable => {
  const info = table.slots[table.active]
  if (info.triesRemaining > 0) return table

  const fallback = inactiveSlot(table)
  return {
    ...table,
    active: fallback,
    slots: { ...table.slots, [table.active]: { ...info, bootable: false } },
  }
}

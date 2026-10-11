// Update event and fault (DTC) logger.
// Buffers events in RAM and hands them to a sink (non-volatile memory or a
// backend uplink) in batches.

export type EventSeverity = 'info' | 'warning' | 'fault'

export interface UpdateEvent {
  code: string
  severity: EventSeverity
  updateId: string
  timestamp: number
  detail?: string
}

export interface LoggerConfig {
  bufferSize: number
  flushBatchSize: number
}

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  bufferSize: 32,
  flushBatchSize: 8,
}

export type EventSink = (events: UpdateEvent[]) => Promise<void>

export interface EventLogger {
  log: (event: Omit<UpdateEvent, 'timestamp'>) => void
  flush: () => Promise<number>
  pending: () => number
  dropped: () => number
}

/**
 * Formats a DTC code for an update fault, for example 'U3000-51'.
 */
export const formatDtc = (base: string, failureType: number): string =>
  `${base}-${failureType.toString(16).toUpperCase().padStart(2, '0')}`

/**
 * Validates an event before it is buffered.
 */
export const validateEvent = (event: Omit<UpdateEvent, 'timestamp'>): string | null => {
  if (!event.code) return 'Event code is required'
  if (!event.updateId) return 'Update ID is required'
  if (!['info', 'warning', 'fault'].includes(event.severity)) return 'Unknown severity'
  return null
}

/**
 * Creates a logger that buffers events and writes them to the sink in batches.
 */
export const createEventLogger = (
  sink: EventSink,
  config: LoggerConfig = DEFAULT_LOGGER_CONFIG,
  now: () => number = Date.now
): EventLogger => {
  let buffer: UpdateEvent[] = []
  let droppedCount = 0

  const log = (event: Omit<UpdateEvent, 'timestamp'>): void => {
    if (validateEvent(event) !== null) return

    if (buffer.length >= config.bufferSize) {
      // Buffer full: make room by discarding the oldest entry
      buffer.shift()
      droppedCount++
    }
    buffer.push({ ...event, timestamp: now() })
  }

  const flush = async (): Promise<number> => {
    let written = 0
    while (buffer.length > 0) {
      const batch = buffer.slice(0, config.flushBatchSize)
      buffer = buffer.slice(config.flushBatchSize)
      try {
        await sink(batch)
        written += batch.length
      } catch {
        // Sink unavailable: give up on this batch and continue with the next one
      }
    }
    return written
  }

  return {
    log,
    flush,
    pending: () => buffer.length,
    dropped: () => droppedCount,
  }
}

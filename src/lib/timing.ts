// Diagnostic timing parameters (ISO 14229-2) used across the update module.

/** Default response timeout of the ECU. */
export const P2_SERVER_MAX_MS = 50

/** Enhanced response timeout after a responsePending (0x78) reply. */
export const P2_STAR_SERVER_MAX_MS = 5000

/** Session timeout: a non-default session falls back after this much silence. */
export const S3_SERVER_MS = 5000

/** Budget for one complete firmware update, from first request to commit. */
export const UPDATE_BUDGET_MS = 10 * 60 * 1000

/** Budget for a rollback to the previous image. */
export const ROLLBACK_BUDGET_MS = 30 * 1000

/**
 * Returns true when an elapsed time is inside its budget.
 */
export const withinBudget = (elapsedMs: number, budgetMs: number): boolean =>
  elapsedMs >= 0 && elapsedMs <= budgetMs

import { describe, it, expect } from 'vitest'
import { withinBudget, P2_SERVER_MAX_MS, P2_STAR_SERVER_MAX_MS, S3_SERVER_MS, UPDATE_BUDGET_MS, ROLLBACK_BUDGET_MS } from '../../src/lib/timing'

describe('timing parameters', () => {
  it('uses the ISO 14229-2 defaults', () => {
    expect(P2_SERVER_MAX_MS).toBe(50)
    expect(P2_STAR_SERVER_MAX_MS).toBe(5000)
    expect(S3_SERVER_MS).toBe(5000)
  })

  it('defines the update and rollback budgets', () => {
    expect(UPDATE_BUDGET_MS).toBe(600000)
    expect(ROLLBACK_BUDGET_MS).toBe(30000)
  })
})

describe('withinBudget', () => {
  it('accepts values up to and including the budget', () => {
    expect(withinBudget(0, 100)).toBe(true)
    expect(withinBudget(100, 100)).toBe(true)
  })

  it('rejects values over the budget and negative values', () => {
    expect(withinBudget(101, 100)).toBe(false)
    expect(withinBudget(-1, 100)).toBe(false)
  })
})

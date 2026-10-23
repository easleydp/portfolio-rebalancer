import { beforeEach, describe, expect, it } from 'vitest'
import {
  KEY,
  clearSaved,
  defaults,
  fromStoredFund,
  load,
  rollover,
  save,
  toStoredFund,
  toStoredState,
  type State,
} from './storage'

describe('storage conversions', () => {
  it('converts UI fund to stored fund with pure numbers and price in pounds', () => {
    const uiFund = {
      id: 'f1',
      name: 'Vanguard All-World',
      quantity: '2,100',
      price: '2,000.05p',
      target: '60',
    }
    const stored = toStoredFund(uiFund)
    expect(stored).toEqual({
      id: 'f1',
      name: 'Vanguard All-World',
      quantity: 2100,
      price: 20.0005,
      target: 60,
    })
  })

  it('handles £-prefixed price correctly when converting to stored pounds', () => {
    const uiFund = {
      id: 'f2',
      name: 'Fund B',
      quantity: '100',
      price: '£12.50',
      target: '40',
    }
    const stored = toStoredFund(uiFund)
    expect(stored.price).toBe(12.5)
  })

  it('converts empty or invalid fund fields to null', () => {
    const emptyFund = {
      id: 'f3',
      name: '',
      quantity: '',
      price: '',
      target: '',
    }
    expect(toStoredFund(emptyFund)).toEqual({
      id: 'f3',
      name: '',
      quantity: null,
      price: null,
      target: null,
    })
  })

  it('hydrates stored fund numbers back to UI formatted strings', () => {
    const stored = {
      id: 'f1',
      name: 'Vanguard All-World',
      quantity: 2100,
      price: 20.0005,
      target: 60,
    }
    const hydrated = fromStoredFund(stored)
    expect(hydrated).toEqual({
      id: 'f1',
      name: 'Vanguard All-World',
      quantity: '2,100',
      price: '2,000.05p',
      target: '60',
    })
  })

  it('hydrates stored fund with price in pounds back to pence string', () => {
    const stored = {
      id: 'f2',
      name: 'Fund B',
      quantity: 50,
      price: 12.06,
      target: 20,
    }
    const hydrated = fromStoredFund(stored)
    expect(hydrated.price).toBe('1,206.00p')
  })

  it('hydrates null stored fields to empty strings', () => {
    const stored = {
      id: 'f3',
      name: 'Empty Fund',
      quantity: null,
      price: null,
      target: null,
    }
    const hydrated = fromStoredFund(stored)
    expect(hydrated.quantity).toBe('')
    expect(hydrated.price).toBe('')
    expect(hydrated.target).toBe('')
  })
})

describe('state serialization & localStorage persistence', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    store = {}
    globalThis.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v) },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { store = {} },
      length: 0,
      key: () => null,
    } as unknown as Storage
  })

  it('serializes state with pure numbers and pounds throughout', () => {
    const state: State = {
      funds: [
        { id: 'f1', name: 'Fund A', quantity: '2,100', price: '2,000.05p', target: '60' },
        { id: 'f2', name: 'Fund B', quantity: '500', price: '1,206.00p', target: '40' },
      ],
      cash: '1,000.00',
      plat: '44,000.00',
      settings: { rel: '25', cap: '5', whole: true },
      saved: '',
      prev: null,
    }

    const stored = toStoredState(state, '2026-10-23T12:00:00.000Z')
    expect(stored).toEqual({
      funds: [
        { id: 'f1', name: 'Fund A', quantity: 2100, price: 20.0005, target: 60 },
        { id: 'f2', name: 'Fund B', quantity: 500, price: 12.06, target: 40 },
      ],
      cash: 1000,
      plat: 44000,
      settings: {
        rel: 25,
        cap: 5,
        whole: true,
      },
      saved: '2026-10-23T12:00:00.000Z',
      prev: null,
    })
  })

  it('persists under KEY portfolio-rebalancer-v2 and loads back formatted UI values', () => {
    expect(KEY).toBe('portfolio-rebalancer-v2')

    const state: State = {
      funds: [
        { id: 'f1', name: 'Fund A', quantity: '2,100', price: '2,000.05p', target: '60' },
        { id: 'f2', name: 'Fund B', quantity: '500', price: '1,206.00p', target: '40' },
      ],
      cash: '1,000.00',
      plat: '44,000.00',
      settings: { rel: '25', cap: '5', whole: true },
      saved: '',
      prev: null,
    }

    const savedAt = save(state)
    expect(savedAt).toBeTruthy()

    // Verify raw JSON in localStorage
    const raw = localStorage.getItem(KEY)
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!)
    expect(parsed.cash).toBe(1000)
    expect(parsed.plat).toBe(44000)
    expect(parsed.settings.rel).toBe(25)
    expect(parsed.settings.cap).toBe(5)
    expect(parsed.funds[0].quantity).toBe(2100)
    expect(parsed.funds[0].price).toBe(20.0005)
    expect(parsed.funds[0].target).toBe(60)

    // Load back
    const loaded = load()
    expect(loaded.cash).toBe('1,000.00')
    expect(loaded.plat).toBe('44,000.00')
    expect(loaded.settings.rel).toBe('25')
    expect(loaded.settings.cap).toBe('5')
    expect(loaded.funds[0].quantity).toBe('2,100')
    expect(loaded.funds[0].price).toBe('2,000.05p')
    expect(loaded.funds[0].target).toBe('60')
    expect(loaded.funds[1].price).toBe('1,206.00p')
  })

  it('ignores old v1 data in localStorage and returns defaults', () => {
    localStorage.setItem('portfolio-rebalancer-v1', JSON.stringify({ cash: '999' }))
    const loaded = load()
    expect(loaded.cash).toBe('')
    expect(loaded.plat).toBe('')
    expect(loaded.funds.length).toBe(3)
    expect(loaded.funds[0].name).toBe('')
    expect(loaded.settings).toEqual({ rel: '25', cap: '5', whole: true })
  })

  it('clears saved state from localStorage', () => {
    save(defaults())
    expect(localStorage.getItem(KEY)).toBeTruthy()
    clearSaved()
    expect(localStorage.getItem(KEY)).toBeNull()
  })
})

describe('rollover', () => {
  it('stores previous prices in pounds when older than 60 days', () => {
    const t0 = Date.parse('2026-01-01T00:00:00Z')
    const t61DaysLater = t0 + 61 * 864e5

    const state: State = {
      funds: [
        { id: 'f1', name: 'VWRL', quantity: '100', price: '2,000.05p', target: '50' },
        { id: 'f2', name: 'VUAG', quantity: '200', price: '1,206.00p', target: '50' },
      ],
      cash: '100.00',
      plat: '5,000.00',
      settings: { rel: '25', cap: '5', whole: true },
      saved: new Date(t0).toISOString(),
      prev: null,
    }

    const updated = rollover(state, t61DaysLater)
    expect(updated.plat).toBe('')
    expect(updated.prev).toEqual({
      vwrl: 20.0005,
      vuag: 12.06,
    })
  })

  it('keeps state unchanged if within 60 days', () => {
    const t0 = Date.parse('2026-01-01T00:00:00Z')
    const t10DaysLater = t0 + 10 * 864e5

    const state: State = {
      funds: [{ id: 'f1', name: 'VWRL', quantity: '100', price: '2,000.05p', target: '50' }],
      cash: '100.00',
      plat: '5,000.00',
      settings: { rel: '25', cap: '5', whole: true },
      saved: new Date(t0).toISOString(),
      prev: { vwrl: 18.5 },
    }

    const updated = rollover(state, t10DaysLater)
    expect(updated).toEqual(state)
  })
})

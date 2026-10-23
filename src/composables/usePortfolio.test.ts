import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { KEY } from '../lib/storage'
import { usePortfolio } from './usePortfolio'

describe('usePortfolio debounce persistence', () => {
  let store: Record<string, string> = {}

  beforeEach(() => {
    vi.useFakeTimers()
    store = {}
    globalThis.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = String(v)
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        store = {}
      },
      length: 0,
      key: () => null,
    } as unknown as Storage
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounces localStorage writes by 500ms when state changes', async () => {
    const { state, savedAt } = usePortfolio()

    // Mutate state
    state.cash = '500.00'
    await nextTick()

    // Immediately after mutation, localStorage should not be updated yet
    expect(store[KEY]).toBeUndefined()
    expect(savedAt.value).toBe('')

    // Advance 300ms (not yet 500ms)
    vi.advanceTimersByTime(300)
    expect(store[KEY]).toBeUndefined()

    // Advance remaining 200ms
    vi.advanceTimersByTime(200)

    // Now it should be written
    expect(store[KEY]).toBeDefined()
    const parsed = JSON.parse(store[KEY])
    expect(parsed.cash).toBe(500)
    expect(savedAt.value).toBeTruthy()
  })

  it('resets timer on rapid successive keystrokes', async () => {
    const { state } = usePortfolio()

    state.cash = '1'
    await nextTick()
    vi.advanceTimersByTime(200)
    expect(store[KEY]).toBeUndefined()

    state.cash = '10'
    await nextTick()
    vi.advanceTimersByTime(200)
    expect(store[KEY]).toBeUndefined()

    state.cash = '100'
    await nextTick()
    vi.advanceTimersByTime(400)
    expect(store[KEY]).toBeUndefined()

    // Finish the 500ms window from the last keystroke (100ms left)
    vi.advanceTimersByTime(100)
    expect(store[KEY]).toBeDefined()
    expect(JSON.parse(store[KEY]).cash).toBe(100)
  })

  it('cancels pending save and clears storage on reset', async () => {
    const { state, reset } = usePortfolio()

    // User types something then immediately resets
    state.cash = '999'
    await nextTick()
    reset()

    // Even after advancing past the 500ms debounce time, nothing should be saved
    vi.advanceTimersByTime(1000)
    expect(store[KEY]).toBeUndefined()
  })

  it('flushes pending changes immediately when flushSave is called', async () => {
    const { state, flushSave, savedAt } = usePortfolio()

    state.cash = '750'
    await nextTick()
    expect(store[KEY]).toBeUndefined()

    flushSave()

    expect(store[KEY]).toBeDefined()
    expect(JSON.parse(store[KEY]).cash).toBe(750)
    expect(savedAt.value).toBeTruthy()
  })
})

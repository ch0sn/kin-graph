import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from './settings'

describe('parseSettings', () => {
  it('uses the defaults for nothing or nonsense', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ colorMode: 'sepia', theme: 'neon', siblingOrder: 7 })).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  it('keeps valid values', () => {
    const settings = {
      colorMode: 'dark',
      theme: 'blueprint',
      siblingOrder: 'girls-first',
      highlightGender: true,
    } as const
    expect(parseSettings(settings)).toEqual(settings)
  })

  it('reads the old light/dark choice that was stored as `theme`', () => {
    expect(parseSettings({ theme: 'dark', siblingOrder: 'boys-first' })).toEqual({
      ...DEFAULT_SETTINGS,
      colorMode: 'dark',
      siblingOrder: 'boys-first',
    })
    expect(parseSettings({ theme: 'system' }).colorMode).toBe('system')
  })
})

import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, parseSettings } from './settings'

describe('parseSettings', () => {
  it('uses the defaults for nothing or nonsense', () => {
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('dark')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings({ colorMode: 'sepia', theme: 'neon', siblingOrder: 7, nameOrder: 'up', colorVision: 'rainbow', closeTab: 'burn', newTreeIn: 1, onStart: null, fanGenerations: 12 })).toEqual(
      DEFAULT_SETTINGS,
    )
  })

  it('keeps valid values', () => {
    const settings = {
      language: 'de',
      colorMode: 'dark',
      theme: 'blueprint',
      colorVision: 'deuteranopia',
      siblingOrder: 'girls-first',
      nameOrder: 'family-first',
      highlightGender: true,
      personCard: { location: false, lifeEvents: false, birthAndDeath: true, notes: false },
      personCardOrder: ['birthAndDeath', 'notes', 'location', 'lifeEvents'],
      closeTab: 'ask',
      newTreeIn: 'replace',
      onStart: 'own-tree',
      fanGenerations: 6,
    } as const
    expect(parseSettings(settings)).toEqual(settings)
  })

  it('keeps explicit card toggles and defaults missing or invalid preferences independently', () => {
    expect(parseSettings({ personCard: { location: false, notes: 'false', birthAndDeath: true } }).personCard).toEqual({
      location: false,
      lifeEvents: true,
      birthAndDeath: true,
      notes: true,
    })
    expect(parseSettings({ personCard: null }).personCard).toEqual(DEFAULT_SETTINGS.personCard)
  })

  it('reads the old light/dark choice that was stored as `theme`', () => {
    expect(parseSettings({ theme: 'dark', siblingOrder: 'boys-first' })).toEqual({
      ...DEFAULT_SETTINGS,
      colorMode: 'dark',
      siblingOrder: 'boys-first',
    })
    expect(parseSettings({ theme: 'system' }).colorMode).toBe('system')
  })

  it('keeps the order of known sections, including hidden ones, and appends missing sections', () => {
    const settings = parseSettings({
      personCard: { notes: false },
      personCardOrder: ['notes', 'unknown', 'birthAndDeath', 'notes'],
    })
    expect(settings.personCardOrder).toEqual(['notes', 'birthAndDeath', 'location', 'lifeEvents'])
    expect(settings.personCard.notes).toBe(false)
    expect(parseSettings({ personCardOrder: 'notes' }).personCardOrder).toEqual(DEFAULT_SETTINGS.personCardOrder)
  })
})

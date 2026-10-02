import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { THEME_IDS, THEMES } from './themes'

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')
const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8')

describe('themes', () => {
  it('offers at least ten, each with a unique id', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(10)
    expect(new Set(THEME_IDS).size).toBe(THEMES.length)
  })

  it.each(THEME_IDS)('%s is fully defined in index.css', (id) => {
    const block = css.match(new RegExp(`\\[data-theme=['"]${id}['"]\\]\\s*\\{([^}]*)\\}`))?.[1]
    expect(block, `no [data-theme='${id}'] block`).toBeDefined()
    for (const token of [
      '--n-h',
      '--n-c',
      '--accent-l',
      '--accent-d',
      '--card-radius',
      '--font-serif',
    ]) {
      expect(block, `${id} is missing ${token}`).toContain(token)
    }
  })

  it('loads every typeface the themes use', () => {
    const families = [...css.matchAll(/--font-(?:serif|sans):\s*'([^']+)'/g)].map((m) => m[1])
    for (const family of new Set(families)) {
      expect(html, `${family} isn't loaded in index.html`).toContain(family.replace(/ /g, '+'))
    }
  })
})

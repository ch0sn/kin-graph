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
    const selfHosted = new Set(
      [...css.matchAll(/@font-face\s*\{[^}]*font-family:\s*'([^']+)'/g)].map((m) => m[1]),
    )
    for (const family of new Set(families)) {
      if (selfHosted.has(family)) continue
      expect(html, `${family} isn't loaded in index.html`).toContain(family.replace(/ /g, '+'))
    }
  })

  it('uses Kakao Big Sans for Hangul in every theme face', () => {
    expect(css).toContain('unicode-range: U+1100-11FF, U+3130-318F, U+A960-A97F, U+AC00-D7AF, U+D7B0-D7FF')
    const stacks = [...css.matchAll(/--font-(?:serif|sans):\s*([^;]+);/g)].map((match) => match[1])
    expect(stacks.length).toBeGreaterThan(THEME_IDS.length)
    for (const stack of stacks) {
      expect(stack, stack).toContain("'Kakao Big Sans'")
    }
  })

  it('uses Kakao Big Sans when the language is Korean', () => {
    const block = css.match(/html\[lang=['"]ko['"]\]\s*\{([^}]*)\}/)?.[1]
    expect(block, 'no html[lang=ko] font override').toBeDefined()
    expect(block).toContain("--font-sans: 'Kakao Big Sans'")
    expect(block).toContain("--font-serif: 'Kakao Big Sans'")
    for (const file of ['KakaoBigSans-Regular.woff2', 'KakaoBigSans-Bold.woff2']) {
      expect(css).toContain(`/fonts/${file}`)
      expect(readFileSync(new URL(`../../public/fonts/${file}`, import.meta.url)).byteLength).toBeGreaterThan(0)
    }
    expect(readFileSync(new URL('../../public/fonts/OFL.txt', import.meta.url), 'utf8')).toContain(
      'SIL Open Font License',
    )
  })
})

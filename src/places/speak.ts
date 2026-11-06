const MARKS = /\p{M}/gu

/** Lower case, with accents lifted off, so "München" and "Munchen" meet. */
export function foldMarks(text: string): string {
  return text
    .replace(/ß/g, 'ss')
    .replace(/æ/gi, 'ae')
    .replace(/œ/gi, 'oe')
    .replace(/ø/gi, 'o')
    .replace(/ł/gi, 'l')
    .replace(/đ/gi, 'd')
    .replace(/þ/gi, 'th')
    .replace(/ð/gi, 'd')
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
}

/**
 * Spoken forms of a name. Accents are lifted, and ä/ö/ü are kept both as a
 * single vowel and as ae/oe/ue, so "Köln", "Koln" and "Koeln" match.
 */
export function spokenForms(names: readonly string[]): string[] {
  const forms = new Set<string>()
  for (const name of names) {
    const folded = foldMarks(name)
    const withDigraphs = foldMarks(name.replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue'))
    if (folded) forms.add(folded)
    if (withDigraphs) forms.add(withDigraphs)
  }
  return [...forms]
}

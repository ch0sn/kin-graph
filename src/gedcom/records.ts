/** One line of a GEDCOM file with the lines nested under it. */
export interface GedcomNode {
  tag: string
  /** The `@I1@` identifier of a top-level record. */
  xref?: string
  value: string
  children: GedcomNode[]
}

export interface ParsedRecords {
  records: GedcomNode[]
  /** Lines that weren't valid GEDCOM and were left out. */
  malformedLines: number
}

const LINE = /^\s*(\d+)\s+(?:(@[^@\s]+@)\s+)?(\S+)(?:[ \t](.*))?$/

/** Reads the line structure of a GEDCOM file, joining `CONC` and `CONT` continuations. */
export function parseRecords(text: string): ParsedRecords {
  const records: GedcomNode[] = []
  const stack: GedcomNode[] = []
  let malformedLines = 0

  for (const raw of text.replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    if (!raw.trim()) continue
    const match = LINE.exec(raw)
    if (!match) {
      malformedLines++
      continue
    }
    const level = Number(match[1])
    const tag = match[3].toUpperCase()
    const value = match[4] ?? ''

    if (level > stack.length) {
      // Skipped a level: the line has no parent to belong to.
      malformedLines++
      continue
    }
    stack.length = level
    const parent = stack[level - 1]

    if ((tag === 'CONC' || tag === 'CONT') && parent) {
      parent.value += (tag === 'CONT' ? '\n' : '') + value
      continue
    }
    const node: GedcomNode = { tag, xref: match[2], value, children: [] }
    if (parent) parent.children.push(node)
    else records.push(node)
    stack.push(node)
  }

  for (const node of walk(records)) node.value = node.value.replace(/@@/g, '@')
  return { records, malformedLines }
}

function* walk(nodes: GedcomNode[]): Generator<GedcomNode> {
  for (const node of nodes) {
    yield node
    yield* walk(node.children)
  }
}

export function child(node: GedcomNode, tag: string): GedcomNode | undefined {
  return node.children.find((c) => c.tag === tag)
}

export function childrenOf(node: GedcomNode, tag: string): GedcomNode[] {
  return node.children.filter((c) => c.tag === tag)
}

export interface Decoded {
  text: string
  /** Not UTF-8, so accented characters may have come out wrong. */
  legacy: boolean
}

/**
 * Decodes the bytes of a GEDCOM file. UTF-8 and UTF-16 are read as they are;
 * older "ANSI" and ANSEL files come out as Windows-1252, which is right for
 * plain Latin text and close enough to flag for the rest.
 */
export function decodeGedcom(bytes: Uint8Array): Decoded {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder('utf-16le').decode(bytes), legacy: false }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder('utf-16be').decode(bytes), legacy: false }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), legacy: false }
  } catch {
    return { text: new TextDecoder('windows-1252').decode(bytes), legacy: true }
  }
}

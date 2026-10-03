import { describe, expect, it } from 'vitest'
import { sampleFamily } from '../data/sampleFamily'
import {
  addChild,
  addParent,
  addPartner,
  createGraph,
  fullName,
  simpleName,
  updatePerson,
  type FamilyGraph,
  type NewPerson,
} from '../model'
import { parseTreeDocument, toDocument } from '../storage/treeDocument'
import { fromGedcomDate, toGedcomDate } from './dates'
import { toGedcom } from './export'
import { GedcomError, importGedcom, importGedcomFile } from './import'
import { decodeGedcom, parseRecords } from './records'

/** A graph with ids replaced by readable names, so two graphs can be compared. */
function canonical(graph: FamilyGraph) {
  const label = (id: string) => {
    const p = graph.people[id]
    return `${fullName(p)}${p.isPlaceholder ? ' (placeholder)' : ''}`
  }
  const people = Object.values(graph.people)
    .map(({ id: _id, ...p }) => p)
    .map((p) => JSON.stringify(p, Object.keys(p).sort()))
    .sort()
  return {
    manager: label(graph.managerId),
    people,
    links: graph.parentLinks.map((l) => `${label(l.parentId)} > ${label(l.childId)} ${l.kind}`).sort(),
    partnerships: graph.partnerships
      .map(({ partnerIds, status, startDate, endDate }) =>
        [partnerIds.map(label).sort().join(' + '), status, startDate, endDate].join(' | '),
      )
      .sort(),
  }
}

const roundTrip = (graph: FamilyGraph) => importGedcom(toGedcom(graph)).graph
const person = (given: string, extra: Partial<NewPerson> = {}): NewPerson => ({
  names: [simpleName(given)],
  ...extra,
})

describe('GEDCOM dates', () => {
  it('writes fuzzy dates at each precision', () => {
    expect(toGedcomDate('1950')).toBe('1950')
    expect(toGedcomDate('1950-03')).toBe('MAR 1950')
    expect(toGedcomDate('1950-03-04')).toBe('4 MAR 1950')
    expect(toGedcomDate('1950-12-14')).toBe('14 DEC 1950')
  })

  it('reads them back, in any letter case', () => {
    expect(fromGedcomDate('14 MAR 1950')).toEqual({ kind: 'exact', date: '1950-03-14' })
    expect(fromGedcomDate('mar 1950')).toEqual({ kind: 'exact', date: '1950-03' })
    expect(fromGedcomDate('4 Dec 1950')).toEqual({ kind: 'exact', date: '1950-12-04' })
    expect(fromGedcomDate(' 1950 ')).toEqual({ kind: 'exact', date: '1950' })
    expect(fromGedcomDate('950')).toEqual({ kind: 'exact', date: '0950' })
  })

  it('keeps the date of an approximate one or the start of a range, and says so', () => {
    expect(fromGedcomDate('ABT 1900')).toEqual({ kind: 'approximate', date: '1900' })
    expect(fromGedcomDate('BEF MAR 1900')).toEqual({ kind: 'approximate', date: '1900-03' })
    expect(fromGedcomDate('BET 1900 AND 1910')).toEqual({ kind: 'approximate', date: '1900' })
    expect(fromGedcomDate('FROM 1900 TO 1910')).toEqual({ kind: 'approximate', date: '1900' })
  })

  it('rejects what it cannot keep', () => {
    for (const text of ['(sometime in spring)', '1700/01', '12 BCE 40', '@#DHEBREW@ 5 TVT 5700', '31 FOO 1900', '']) {
      expect(fromGedcomDate(text).kind, text).toBe('unsupported')
    }
    expect(fromGedcomDate('32 JAN 1900').kind).toBe('unsupported')
  })
})

describe('GEDCOM lines', () => {
  it('nests records and joins CONC and CONT', () => {
    const { records, malformedLines } = parseRecords(
      '0 HEAD\n0 @I1@ INDI\n1 NOTE first\n2 CONC  half\n2 CONT second\n1 SEX M\r\n0 TRLR',
    )
    expect(malformedLines).toBe(0)
    expect(records.map((r) => r.tag)).toEqual(['HEAD', 'INDI', 'TRLR'])
    expect(records[1].xref).toBe('@I1@')
    expect(records[1].children[0].value).toBe('first half\nsecond')
    expect(records[1].children[1].value).toBe('M')
  })

  it('counts lines it cannot read and keeps going', () => {
    const { records, malformedLines } = parseRecords('0 HEAD\nnonsense\n3 TOO DEEP\n0 @I1@ INDI\n')
    expect(records).toHaveLength(2)
    expect(malformedLines).toBe(2)
  })

  it('reads UTF-8, UTF-16 and falls back to Windows-1252', () => {
    const utf8 = new TextEncoder().encode('1 NAME Zoë')
    expect(decodeGedcom(utf8)).toEqual({ text: '1 NAME Zoë', legacy: false })
    expect(decodeGedcom(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8])).text).toContain('Zoë')
    const utf16 = new Uint8Array([0xff, 0xfe, ...[...'Zoë'].flatMap((c) => [c.charCodeAt(0), 0])])
    expect(decodeGedcom(utf16).text).toBe('Zoë')
    expect(decodeGedcom(new Uint8Array([0x5a, 0x6f, 0xeb]))).toEqual({ text: 'Zoë', legacy: true })
  })
})

describe('export', () => {
  it('writes a lineage-linked 5.5.1 file with linked records', () => {
    const text = toGedcom(sampleFamily(), new Date(2026, 9, 3))
    expect(text.startsWith('0 HEAD\r\n1 SOUR KinGraph')).toBe(true)
    expect(text).toContain('1 DATE 3 OCT 2026')
    expect(text).toContain('2 VERS 5.5.1')
    expect(text).toContain('1 CHAR UTF-8')
    expect(text.trimEnd().endsWith('0 TRLR')).toBe(true)
    // Every pointer refers to a record that exists.
    const defined = new Set([...text.matchAll(/^0 (@\w+@)/gm)].map((m) => m[1]))
    for (const [, pointer] of text.matchAll(/^\d (?:HUSB|WIFE|CHIL|FAMC|FAMS|SUBM|_ROOT) (@\w+@)/gm)) {
      expect(defined.has(pointer), pointer).toBe(true)
    }
  })

  it('writes names, sex and events the way other programs expect', () => {
    let graph = createGraph({
      names: [{ given: 'Mary Ann', surnames: ['Smith'] }, { given: 'Mary', surnames: ['Jones'], type: 'married', from: '1950' }],
      gender: 'female',
      birthDate: '1920-03-04',
      deathDate: '1999',
    })
    graph = updatePerson(graph, graph.managerId, {})
    const text = toGedcom(graph)
    expect(text).toContain('1 NAME Mary Ann /Smith/')
    expect(text).toContain('2 GIVN Mary Ann')
    expect(text).toContain('2 SURN Smith')
    expect(text).toContain('1 NAME Mary /Jones/\r\n2 GIVN Mary\r\n2 SURN Jones\r\n2 TYPE married')
    expect(text).toContain('1 SEX F')
    expect(text).toContain('1 BIRT\r\n2 DATE 4 MAR 1920')
    expect(text).toContain('1 DEAT\r\n2 DATE 1999')
  })

  it('escapes @ and strips slashes from names', () => {
    const text = toGedcom(createGraph({ names: [{ given: 'A@B', surnames: ['X/Y'] }] }))
    expect(text).toContain('1 NAME A@@B /X Y/')
  })

  it('splits lines over 255 characters with CONC and newlines with CONT', () => {
    const longValue =
      'Part1: ' +
      'A'.repeat(240) +
      ' ' +
      'B'.repeat(200) +
      ' 🍎 Zoë\nPart2: line after newline ' +
      'C'.repeat(300)
    const graph = createGraph({
      names: [{ given: longValue }],
    })
    const text = toGedcom(graph)
    const lines = text.split('\r\n').filter(Boolean)

    for (const l of lines) {
      expect(l.length).toBeLessThanOrEqual(255)
    }

    expect(text).toContain(' CONC ')
    expect(text).toContain(' CONT ')

    const imported = importGedcom(text).graph
    const importedPerson = imported.people[imported.managerId]
    expect(importedPerson.names[0].given).toBe(longValue)
  })

  it('splits safely at surrogate pairs and avoids trailing space on continued lines', () => {
    const withEmojiAtBoundary = 'X'.repeat(247) + '🍎' + 'Y'.repeat(50)
    const graph1 = createGraph({ names: [{ given: withEmojiAtBoundary }] })
    const text1 = toGedcom(graph1)
    for (const l of text1.split('\r\n').filter(Boolean)) {
      expect(l.length).toBeLessThanOrEqual(255)
    }
    const imported1 = importGedcom(text1).graph
    expect(imported1.people[imported1.managerId].names[0].given).toBe(withEmojiAtBoundary)

    const withSpaceAtBoundary = 'X'.repeat(247) + ' ' + 'Y'.repeat(50)
    const graph2 = createGraph({ names: [{ given: withSpaceAtBoundary }] })
    const text2 = toGedcom(graph2)
    for (const l of text2.split('\r\n').filter(Boolean)) {
      expect(l.length).toBeLessThanOrEqual(255)
      if (l.startsWith('2 GIVN') || l.startsWith('1 NAME')) {
        expect(l.endsWith(' ')).toBe(false)
      }
    }
    const imported2 = importGedcom(text2).graph
    expect(imported2.people[imported2.managerId].names[0].given).toBe(withSpaceAtBoundary)
  })

  it('records the manager so a round trip restores the root', () => {
    const graph = sampleFamily()
    expect(roundTrip(graph).managerId).toBeDefined()
    expect(canonical(roundTrip(graph)).manager).toBe('Alex Morgan')
  })
})

describe('round trip', () => {
  it('keeps the sample family: people, parent kinds, partnerships and dates', () => {
    const graph = sampleFamily()
    expect(canonical(roundTrip(graph))).toEqual(canonical(graph))
  })

  it('keeps several partnerships, their statuses and dates', () => {
    let graph = createGraph(person('Pat'))
    const add = (r: { graph: FamilyGraph; person: { id: string } }) => {
      graph = r.graph
      return r.person.id
    }
    const a = add(addPartner(graph, graph.managerId, person('Ann'), 'married'))
    const b = add(addPartner(graph, graph.managerId, person('Bea'), 'divorced'))
    const c = add(addPartner(graph, graph.managerId, person('Cy'), 'partnered'))
    const d = add(addPartner(graph, graph.managerId, person('Di'), 'separated'))
    const e = add(addPartner(graph, graph.managerId, person('Ed'), 'widowed'))
    for (const [id, start, end] of [[a, '1990-05'], [b, '1995', '2001-02-03'], [c, '2005'], [d, undefined, '2010'], [e]] as const) {
      const partnership = graph.partnerships.find((p) => p.partnerIds.includes(id))!
      graph = {
        ...graph,
        partnerships: graph.partnerships.map((p) => (p === partnership ? { ...p, startDate: start, endDate: end } : p)),
      }
    }
    add(addChild(graph, graph.managerId, person('Kid'), { coParentId: b }))

    expect(canonical(roundTrip(graph))).toEqual(canonical(graph))
  })

  it('keeps adoptive and foster parents, including mixed ones for one child', () => {
    let graph = createGraph(person('Kid'))
    const kid = graph.managerId
    for (const [name, kind] of [['Bio', 'biological'], ['Adopt', 'adoptive'], ['Foster', 'foster']] as const) {
      const r = addParent(graph, kid, person(name), { kind })
      graph = r.graph
    }
    const out = roundTrip(graph)
    expect(canonical(out)).toEqual(canonical(graph))
    expect(out.parentLinks.map((l) => l.kind).sort()).toEqual(['adoptive', 'biological', 'foster'])
  })

  it('keeps placeholder parents, deceased flags, genders, other names and scripts', () => {
    let graph = createGraph({
      names: [
        {
          given: '민준',
          surnames: ['김'],
          forms: [
            { given: 'Minjun', surnames: ['Kim'], script: 'romanized' },
            { given: '敏俊', surnames: ['金'], script: 'hanja' },
          ],
        },
        { given: 'Joon', type: 'nickname' },
        { given: 'Ana', surnames: ['García', 'López'], type: 'birth', from: '1980', to: '2001-05' },
        { given: 'Björk', patronymic: 'Guðmundsdóttir' },
      ],
      gender: 'other',
      deceased: true,
    })
    graph = addParent(graph, graph.managerId, { names: [simpleName('Unknown')], isPlaceholder: true }).graph
    expect(canonical(roundTrip(graph))).toEqual(canonical(graph))
  })

  it('reports nothing unsupported in its own files', () => {
    const { report } = importGedcom(toGedcom(sampleFamily()))
    expect(report).toMatchObject({ unsupported: {}, skippedLinks: 0, droppedDates: 0, approximateDates: 0 })
  })

  it('writes a file that the app itself accepts as a valid tree', () => {
    const out = roundTrip(sampleFamily())
    expect(() => parseTreeDocument(toDocument(out))).not.toThrow()
  })
})

const FILE = (...lines: string[]) => ['0 HEAD', '1 GEDC', '2 VERS 5.5.1', ...lines, '0 TRLR'].join('\n')

describe('import', () => {
  it('reads a typical file with vendor tags, noting what it cannot keep', () => {
    const { graph, report } = importGedcom(
      FILE(
        '0 @I1@ INDI',
        '1 NAME John /Doe/',
        '1 SEX M',
        '1 BIRT',
        '2 DATE ABT 1900',
        '2 PLAC Boston',
        '1 OCCU Smith',
        '1 _UID 1234',
        '0 @I2@ INDI',
        '1 NAME Jane /Roe/',
        '1 SEX F',
        '1 DEAT Y',
        '0 @I3@ INDI',
        '1 NAME Jim //',
        '1 BIRT',
        '2 DATE (about spring)',
        '1 FAMC @F1@',
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 CHIL @I3@',
        '1 MARR',
        '2 DATE 1 JAN 1920',
        '1 NOTE a note',
        '0 @S1@ SOUR',
        '1 TITL A book',
      ),
    )
    expect(Object.values(graph.people).map(fullName)).toEqual(['John Doe', 'Jane Roe', 'Jim'])
    const [john, jane, jim] = Object.values(graph.people)
    expect(john.birthDate).toBe('1900')
    expect(john.gender).toBe('male')
    expect(jane.deceased).toBe(true)
    expect(jim.birthDate).toBeUndefined()
    expect(graph.parentLinks).toHaveLength(2)
    expect(graph.parentLinks.every((l) => l.kind === 'biological' && l.childId === jim.id)).toBe(true)
    expect(graph.partnerships).toMatchObject([{ status: 'married', startDate: '1920-01-01' }])
    expect(graph.managerId).toBe(john.id)

    expect(report.families).toBe(1)
    expect(report.approximateDates).toBe(1)
    expect(report.droppedDates).toBe(1)
    expect(report.unsupported).toEqual({ OCCU: 1, _UID: 1, 'BIRT.PLAC': 1, NOTE: 1, SOUR: 1 })
    expect(() => parseTreeDocument(toDocument(graph))).not.toThrow()
  })

  it('handles multiple marriages and half siblings', () => {
    const { graph } = importGedcom(
      FILE(
        '0 @I1@ INDI', '1 NAME Dad /X/', '1 SEX M', '1 FAMS @F1@', '1 FAMS @F2@',
        '0 @I2@ INDI', '1 NAME Mum1 /Y/', '1 SEX F', '1 FAMS @F1@',
        '0 @I3@ INDI', '1 NAME Mum2 /Z/', '1 SEX F', '1 FAMS @F2@',
        '0 @I4@ INDI', '1 NAME Kid1 /X/', '1 FAMC @F1@',
        '0 @I5@ INDI', '1 NAME Kid2 /X/', '1 FAMC @F2@',
        '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I4@', '1 MARR', '1 DIV Y',
        '0 @F2@ FAM', '1 HUSB @I1@', '1 WIFE @I3@', '1 CHIL @I5@', '1 MARR',
      ),
    )
    expect(graph.partnerships.map((p) => p.status).sort()).toEqual(['divorced', 'married'])
    expect(graph.parentLinks).toHaveLength(4)
  })

  it('reads pedigree types, defaulting to biological', () => {
    const { graph } = importGedcom(
      FILE(
        '0 @I1@ INDI', '1 NAME A', '0 @I2@ INDI', '1 NAME B', '0 @I3@ INDI', '1 NAME C', '1 FAMC @F1@', '2 PEDI adopted',
        '0 @I4@ INDI', '1 NAME D', '1 FAMC @F1@', '2 PEDI foster',
        '0 @I5@ INDI', '1 NAME E', '1 FAMC @F1@', '2 PEDI sealing',
        '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I3@', '1 CHIL @I4@', '1 CHIL @I5@',
      ),
    )
    const byChild = (name: string) =>
      graph.parentLinks.filter((l) => fullName(graph.people[l.childId]) === name).map((l) => l.kind)
    expect(byChild('C')).toEqual(['adoptive', 'adoptive'])
    expect(byChild('D')).toEqual(['foster', 'foster'])
    expect(byChild('E')).toEqual(['biological', 'biological'])
  })

  it('splits names without GIVN and SURN, and copes with missing ones', () => {
    const { graph } = importGedcom(
      FILE(
        '0 @I1@ INDI', '1 NAME Mary Ann /van der Berg/ Jr',
        '0 @I2@ INDI', '1 NAME /Solo/',
        '0 @I3@ INDI',
        '0 @I4@ INDI', '1 NAME Anna', '2 SPFX von', '2 SURN Berg', '1 NAME Annie //', '2 TYPE aka',
      ),
    )
    const [a, b, c, d] = Object.values(graph.people)
    expect(a.names[0]).toEqual({ given: 'Mary Ann', surnames: ['van der Berg'] })
    expect(b.names[0]).toEqual({ given: 'Solo' })
    expect(c.names[0]).toEqual({ given: 'Unknown' })
    expect(d.names).toEqual([
      { given: 'Anna', surnames: ['von Berg'] },
      { given: 'Annie', type: 'alias' },
    ])
  })

  it('skips parent links that would break the tree and reports them', () => {
    const { graph, report } = importGedcom(
      FILE(
        '0 @I1@ INDI', '1 NAME A', '0 @I2@ INDI', '1 NAME B', '0 @I3@ INDI', '1 NAME C',
        '0 @I4@ INDI', '1 NAME Kid', '1 FAMC @F1@', '1 FAMC @F2@',
        '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I4@',
        // A third birth parent, and A as their own child.
        '0 @F2@ FAM', '1 HUSB @I3@', '1 CHIL @I4@', '1 CHIL @I1@',
      ),
    )
    // A > Kid, B > Kid, C > Kid is a third birth parent; C > A is fine; nothing loops here.
    expect(report.skippedLinks).toBe(1)
    expect(graph.parentLinks).toHaveLength(3)
    expect(() => parseTreeDocument(toDocument(graph))).not.toThrow()

    const loop = importGedcom(
      FILE(
        '0 @I1@ INDI', '1 NAME A', '0 @I2@ INDI', '1 NAME B',
        '0 @F1@ FAM', '1 HUSB @I1@', '1 CHIL @I2@',
        '0 @F2@ FAM', '1 HUSB @I2@', '1 CHIL @I1@',
        '0 @F3@ FAM', '1 HUSB @I1@', '1 WIFE @I1@', '1 CHIL @I1@',
      ),
    )
    expect(loop.report.skippedLinks).toBe(3)
    expect(() => parseTreeDocument(toDocument(loop.graph))).not.toThrow()
  })

  it('ignores references to people who are not in the file and duplicate partnerships', () => {
    const { graph } = importGedcom(
      FILE(
        '0 @I1@ INDI', '1 NAME A', '0 @I2@ INDI', '1 NAME B',
        '0 @F1@ FAM', '1 HUSB @I1@', '1 WIFE @I2@', '1 CHIL @I9@',
        '0 @F2@ FAM', '1 HUSB @I1@', '1 WIFE @I2@',
        '0 @F3@ FAM', '1 HUSB @I1@', '1 WIFE @I1@',
      ),
    )
    expect(graph.partnerships).toHaveLength(1)
    expect(graph.parentLinks).toHaveLength(0)
  })

  it('uses a manager chosen in the file, else the first real person', () => {
    const lines = ['0 @I1@ INDI', '1 NAME First', '0 @I2@ INDI', '1 NAME Second']
    const plain = importGedcom(FILE(...lines)).graph
    expect(fullName(plain.people[plain.managerId])).toBe('First')
    const text = ['0 HEAD', '1 _ROOT @I2@', ...lines, '0 TRLR'].join('\n')
    const { graph } = importGedcom(text)
    expect(fullName(graph.people[graph.managerId])).toBe('Second')
  })

  it('rejects files that are not GEDCOM, or have no people', () => {
    expect(() => importGedcom('hello')).toThrow(GedcomError)
    expect(() => importGedcom('{"format":"kingraph-tree"}')).toThrow(/isn’t a GEDCOM/)
    expect(() => importGedcom(FILE())).toThrow(/doesn’t contain any people/)
    expect(() => importGedcom(FILE('0 @I1@ INDI', '1 _PLACEHOLDER Y'))).toThrow(GedcomError)
  })

  it('flags a file that is not UTF-8', () => {
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('0 HEAD\n0 @I1@ INDI\n1 NAME Zo'),
      0xeb,
      ...new TextEncoder().encode('\n0 TRLR\n'),
    ])
    const { graph, report } = importGedcomFile(bytes)
    expect(report.legacyEncoding).toBe(true)
    expect(fullName(Object.values(graph.people)[0])).toBe('Zoë')
  })

  it('survives a long GEDCOM with continuation lines in names', () => {
    const { graph } = importGedcom(FILE('0 @I1@ INDI', '1 NAME A very long given', '2 CONC  name /Surname/'))
    expect(fullName(Object.values(graph.people)[0])).toBe('A very long given name Surname')
  })
})

describe('families without a partnership', () => {
  it('puts a lone parent in a family of their own', () => {
    let graph = createGraph(person('Kid'))
    graph = addParent(graph, graph.managerId, person('Solo')).graph
    const text = toGedcom(graph)
    expect(text.match(/^0 @F\d+@ FAM/gm)).toHaveLength(1)
    expect(text).toContain('1 HUSB')
    expect(text).not.toContain('1 WIFE')
  })

  it('keeps unmarried parents of a child together', () => {
    let graph = createGraph(person('Kid'))
    graph = addParent(graph, graph.managerId, person('P1')).graph
    graph = addParent(graph, graph.managerId, person('P2')).graph
    expect(graph.partnerships).toHaveLength(0)
    expect(toGedcom(graph).match(/^0 @F\d+@ FAM/gm)).toHaveLength(1)
  })
})

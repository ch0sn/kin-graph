import { isCertainlyBefore } from './dates'
import { bloodKinship, type BloodKinship, type Kinship } from './kinship'
import { childIdsOf, getPerson, parentIdsOf, partnershipBetween } from './queries'
import type { FamilyGraph, Gender, PartnershipStatus, Person, PersonId } from './types'

/**
 * Korean relationship labels. Korean terms depend on more than the English
 * ones do: which side of the family someone is on (외할머니 is the mother's
 * mother, 고모 the father's sister and 이모 the mother's), whether a sibling
 * is older or younger, and the speaker's own gender (an older sister is 언니
 * to a woman and 누나 to a man). Where the tree doesn't say, a plainer
 * description is used. More distant relatives are counted in 촌 (degrees).
 */
export function describeKinshipKo(
  graph: FamilyGraph,
  fromId: PersonId,
  toId: PersonId,
  k: Kinship,
): string {
  const me = getPerson(graph, fromId)
  const them = getPerson(graph, toId)
  const gender = them.gender

  switch (k.type) {
    case 'self':
      return fromId === graph.managerId ? '나' : '본인'
    case 'blood':
      return bloodLabel(graph, fromId, toId, k)
    case 'partner':
      return partnerLabel(k.status, gender)
    case 'step-parent':
      return pick(gender, '새어머니', '새아버지', '의붓부모')
    case 'step-child':
      return pick(gender, '의붓딸', '의붓아들', '의붓자녀')
    case 'step-sibling':
      return prefixed('의붓', siblingLabel(me, them))
    case 'relatives-partner': {
      const { up, down } = k.relative
      const relative = getPerson(graph, k.relativeId)
      if (up === 0 && down === 1) return pick(gender, '며느리', '사위', '자녀의 배우자')
      if (up === 1 && down === 1) {
        const term = siblingsPartner(me, relative)
        if (term) return term
      }
      if (down === 0) return prefixed('의붓', bloodLabel(graph, fromId, k.relativeId, k.relative, gender))
      if (up === 2 && down === 1) {
        const [parentId] = ancestorsToward(graph, fromId, k.relativeId, up, down)
        const parentGender = parentId === undefined ? undefined : getPerson(graph, parentId).gender
        const term = auntOrUnclesPartner(parentGender, relative.gender)
        if (term) return term
      }
      const status = partnershipBetween(graph, k.relativeId, toId)?.status ?? 'partnered'
      return `${bloodLabel(graph, fromId, k.relativeId, k.relative)}의 ${partnerLabel(status, gender)}`
    }
    case 'partners-relative': {
      const { up, down } = k.relative
      const partner = getPerson(graph, k.partnerId)
      // A wife's family is 처가, a husband's family 시댁.
      const side = partner.gender === 'female' ? '처' : partner.gender === 'male' ? '시' : undefined
      if (down === 0 && up === 1 && side === '처' && gender) {
        return pick(gender, '장모', '장인', '처가 부모')
      }
      if (down === 0 && up === 1 && side === '시' && gender) {
        return pick(gender, '시어머니', '시아버지', '시부모')
      }
      if (up === 1 && down === 1) {
        const term = partnersSibling(partner, them)
        if (term) return term
      }
      if (down === 0 && side) return side + bloodLabel(graph, k.partnerId, toId, k.relative, gender)
      if (up === 0) return prefixed('의붓', bloodLabel(graph, k.partnerId, toId, k.relative, gender))
      const status = partnershipBetween(graph, fromId, k.partnerId)?.status ?? 'partnered'
      return `${partnerLabel(status, partner.gender)}의 ${bloodLabel(graph, k.partnerId, toId, k.relative, gender)}`
    }
  }
}

function pick(gender: Gender | undefined, female: string, male: string, neutral: string) {
  return gender === 'female' ? female : gender === 'male' ? male : neutral
}

/** 의붓 + 형 → 의붓형, but 의붓 + "여자 형제" keeps its space. */
function prefixed(prefix: string, label: string): string {
  return label.includes(' ') ? `${prefix} ${label}` : prefix + label
}

/**
 * Whether `other` was born before `person`, as far as both birth dates
 * allow. Undefined when either is missing or they can't be told apart.
 */
function isOlder(person: Person, other: Person): boolean | undefined {
  const a = person.birthDate
  const b = other.birthDate
  if (!a || !b) return undefined
  if (isCertainlyBefore(b, a)) return true
  if (isCertainlyBefore(a, b)) return false
  return undefined
}

/**
 * The people between `fromId` and the ancestor they share with `toId`,
 * nearest first: [mother] for an aunt, [mother, grandmother] for a great-aunt.
 */
function ancestorsToward(
  graph: FamilyGraph,
  fromId: PersonId,
  toId: PersonId,
  up: number,
  down: number,
): PersonId[] {
  const path: PersonId[] = []
  let current = fromId
  for (let remaining = up; remaining > 1; remaining--) {
    const next = parentIdsOf(graph, current).find((parentId) => {
      const b = bloodKinship(graph, parentId, toId)
      return b?.up === remaining - 1 && b.down === down
    })
    if (!next) break
    path.push(next)
    current = next
  }
  return path
}

/** Whether a descendant comes through a daughter, which makes them 외손주. */
function throughDaughter(graph: FamilyGraph, fromId: PersonId, toId: PersonId, down: number): boolean {
  const childId = childIdsOf(graph, fromId).find((id) => {
    const b = bloodKinship(graph, id, toId)
    return b?.up === 0 && b.down === down - 1
  })
  return childId !== undefined && getPerson(graph, childId).gender === 'female'
}

const SINO = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구', '십']

/** Degrees of kinship: 사촌, 오촌, 육촌, … */
function chon(degree: number): string {
  return `${SINO[degree] ?? degree}촌`
}

function bloodLabel(
  graph: FamilyGraph,
  fromId: PersonId,
  toId: PersonId,
  { up, down, half }: BloodKinship,
  gender: Gender | undefined = getPerson(graph, toId).gender,
): string {
  if (up === 0 && down === 0) return '본인'

  if (down === 0) {
    if (up === 1) return pick(gender, '어머니', '아버지', '부모')
    const base = pick(gender, '할머니', '할아버지', '조부모')
    if (up >= 5) return `${up}대조 ${base}`
    const [parentId] = ancestorsToward(graph, fromId, toId, up, down)
    const maternal = parentId !== undefined && getPerson(graph, parentId).gender === 'female'
    return (maternal ? '외' : '') + ['', '', '', '증조', '고조'][up] + base
  }
  if (up === 0) {
    if (down === 1) return pick(gender, '딸', '아들', '자녀')
    const base = pick(gender, '손녀', '손자', '손주')
    if (down >= 5) return `${down}대손`
    const maternal = throughDaughter(graph, fromId, toId, down)
    return (maternal ? '외' : '') + ['', '', '', '증', '고'][down] + base
  }
  if (up === 1 && down === 1) {
    const label = siblingLabel(getPerson(graph, fromId), getPerson(graph, toId))
    return half ? prefixed('이복', label) : label
  }

  const [parentId, grandparentId] = ancestorsToward(graph, fromId, toId, up, down)
  const parentGender = parentId === undefined ? undefined : getPerson(graph, parentId).gender

  if (up === 2 && down === 1) {
    if (gender === 'female') {
      return parentGender === 'female' ? '이모' : parentGender === 'male' ? '고모' : '고모/이모'
    }
    if (gender === 'male') return parentGender === 'female' ? '외삼촌' : '삼촌'
    return '부모의 형제자매'
  }
  if (up === 3 && down === 1) {
    const grandparentGender =
      grandparentId === undefined ? undefined : getPerson(graph, grandparentId).gender
    if (grandparentGender === 'female') return pick(gender, '이모할머니', '외종조할아버지', '조부모의 형제자매')
    if (grandparentGender === 'male') return pick(gender, '고모할머니', '종조할아버지', '조부모의 형제자매')
    return '조부모의 형제자매'
  }
  if (up === 1 && down === 2) return pick(gender, '조카딸', '조카', '조카')
  if (up === 1 && down === 3) return pick(gender, '조카손녀', '조카손자', '조카손주')
  if (up === 2 && down === 2) return parentGender === 'female' ? '외사촌' : '사촌'
  return chon(up + down)
}

/** 언니, 누나, 오빠, 형 or 여동생, 남동생, depending on who is older and who is asking. */
function siblingLabel(me: Person, sibling: Person): string {
  const older = isOlder(me, sibling)
  if (older === undefined) return pick(sibling.gender, '여자 형제', '남자 형제', '형제자매')
  if (!older) return pick(sibling.gender, '여동생', '남동생', '동생')
  if (sibling.gender === 'female') return pick(me.gender, '언니', '누나', '언니/누나')
  if (sibling.gender === 'male') return pick(me.gender, '오빠', '형', '오빠/형')
  return '손위 형제'
}

/** A sibling's spouse: 형부, 제부, 매형, 매제, 형수, 제수, 새언니, 올케. */
function siblingsPartner(me: Person, sibling: Person): string | undefined {
  const older = isOlder(me, sibling)
  if (older === undefined || (me.gender !== 'female' && me.gender !== 'male')) return undefined
  if (sibling.gender === 'female') {
    return me.gender === 'female' ? (older ? '형부' : '제부') : older ? '매형' : '매제'
  }
  if (sibling.gender === 'male') {
    return me.gender === 'male' ? (older ? '형수' : '제수') : older ? '새언니' : '올케'
  }
  return undefined
}

/** A partner's sibling: 처형, 처제, 처남 on a wife's side; 시누이, 아주버님, 시동생 on a husband's. */
function partnersSibling(partner: Person, sibling: Person): string | undefined {
  const older = isOlder(partner, sibling)
  if (partner.gender === 'female') {
    if (sibling.gender === 'male') return '처남'
    if (sibling.gender === 'female' && older !== undefined) return older ? '처형' : '처제'
  }
  if (partner.gender === 'male') {
    if (sibling.gender === 'female') return '시누이'
    if (sibling.gender === 'male' && older !== undefined) return older ? '아주버님' : '시동생'
  }
  return undefined
}

/** An aunt's husband or an uncle's wife: 이모부, 고모부, 외숙모, 숙모. */
function auntOrUnclesPartner(
  parentGender: Gender | undefined,
  relativeGender: Gender | undefined,
): string | undefined {
  if (parentGender !== 'female' && parentGender !== 'male') return undefined
  const maternal = parentGender === 'female'
  if (relativeGender === 'female') return maternal ? '이모부' : '고모부'
  if (relativeGender === 'male') return maternal ? '외숙모' : '숙모'
  return undefined
}

function partnerLabel(status: PartnershipStatus, gender?: Gender): string {
  const spouse = pick(gender, '아내', '남편', '배우자')
  switch (status) {
    case 'married':
      return spouse
    case 'partnered':
      return '파트너'
    case 'separated':
      return '전 파트너'
    case 'divorced':
      return pick(gender, '전처', '전남편', '전 배우자')
    case 'widowed':
      return `사별한 ${spouse}`
  }
}

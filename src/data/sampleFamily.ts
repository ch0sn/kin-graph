import {
  addPerson,
  createGraph,
  linkParent,
  linkPartners,
  simpleName,
  type FamilyGraph,
  type NewPerson,
  type PartnershipStatus,
} from '../model'

type Gender = NewPerson['gender']

/**
 * A demo family: the patriarchs of Genesis 11–41, around Joseph. Everyone is
 * long dead and undated, as the Bible counts years in lifespans, not dates.
 */
export function sampleFamily(): FamilyGraph {
  let graph = createGraph(person('Joseph', 'male'))
  const ids: Record<string, string> = { Joseph: graph.managerId }

  // Everyone else, eldest first within each family so ties keep birth order.
  const people: [string, Gender][] = [
    ['Terah', 'male'],
    ['Abraham', 'male'],
    ['Sarah', 'female'],
    ['Nahor', 'male'],
    ['Haran', 'male'],
    ['Milcah', 'female'],
    ['Lot', 'male'],
    ['Hagar', 'female'],
    ['Ishmael', 'male'],
    ['Isaac', 'male'],
    ['Bethuel', 'male'],
    ['Rebekah', 'female'],
    ['Laban', 'male'],
    ['Esau', 'male'],
    ['Jacob', 'male'],
    ['Leah', 'female'],
    ['Rachel', 'female'],
    ['Reuben', 'male'],
    ['Simeon', 'male'],
    ['Levi', 'male'],
    ['Judah', 'male'],
    ['Dinah', 'female'],
    ['Benjamin', 'male'],
    ['Potiphera', 'male'],
    ['Asenath', 'female'],
    ['Manasseh', 'male'],
    ['Ephraim', 'male'],
  ]
  for (const [name, gender] of people) {
    const added = addPerson(graph, person(name, gender))
    graph = added.graph
    ids[name] = added.person.id
  }

  const partners = (a: string, b: string, status: PartnershipStatus = 'married') => {
    graph = linkPartners(graph, ids[a], ids[b], { status })
  }
  const children = (parents: string[], kids: string[]) => {
    for (const kid of kids) for (const parent of parents) graph = linkParent(graph, ids[parent], ids[kid])
  }

  // Terah's sons (Genesis 11). Milcah was Haran's daughter too, but a link
  // from Haran would pull her husband, his own brother, down a generation.
  children(['Terah'], ['Abraham', 'Nahor', 'Haran'])
  children(['Haran'], ['Lot'])
  partners('Nahor', 'Milcah')
  children(['Nahor', 'Milcah'], ['Bethuel'])
  children(['Bethuel'], ['Rebekah', 'Laban'])

  // Abraham's sons by Sarah and by Hagar, whom he sent away (Genesis 16–21)
  partners('Abraham', 'Sarah')
  partners('Abraham', 'Hagar', 'separated')
  children(['Abraham', 'Hagar'], ['Ishmael'])
  children(['Abraham', 'Sarah'], ['Isaac'])

  // Isaac married his cousin's daughter Rebekah, Jacob his cousins Leah and Rachel (Genesis 24–30)
  partners('Isaac', 'Rebekah')
  children(['Isaac', 'Rebekah'], ['Esau', 'Jacob'])
  children(['Laban'], ['Leah', 'Rachel'])
  partners('Jacob', 'Leah')
  partners('Jacob', 'Rachel')
  children(['Jacob', 'Leah'], ['Reuben', 'Simeon', 'Levi', 'Judah', 'Dinah'])
  children(['Jacob', 'Rachel'], ['Joseph', 'Benjamin'])

  // Joseph's own family in Egypt (Genesis 41)
  children(['Potiphera'], ['Asenath'])
  partners('Joseph', 'Asenath')
  children(['Joseph', 'Asenath'], ['Manasseh', 'Ephraim'])

  return graph
}

function person(givenName: string, gender: Gender): NewPerson {
  return { names: [simpleName(givenName)], gender, deceased: true }
}

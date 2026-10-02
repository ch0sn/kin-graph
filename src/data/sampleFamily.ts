import {
  addChild,
  addParent,
  addPartner,
  addSibling,
  createGraph,
  linkPartners,
  type FamilyGraph,
  type NewPerson,
  type PersonResult,
} from '../model'

/** A demo family around Alex, used until real trees are stored. */
export function sampleFamily(): FamilyGraph {
  let graph = createGraph(person('Alex', 'Morgan', 'male', '1988-06-12'))
  const add = (result: PersonResult) => {
    graph = result.graph
    return result.person.id
  }
  const alex = graph.managerId

  // Parents, siblings and step-family
  const mary = add(addParent(graph, alex, person('Mary', 'Morgan', 'female', '1960-02-03')))
  const john = add(addParent(graph, alex, person('John', 'Morgan', 'male', '1958-09-21')))
  graph = linkPartners(graph, mary, john, { status: 'divorced' })
  const sara = add(addSibling(graph, alex, person('Sara', 'Morgan', 'female', '1991-04-30')))
  const linda = add(
    addPartner(graph, john, person('Linda', 'Hale', 'female', '1965-11-08'), 'married'),
  )
  add(addChild(graph, john, person('Tom', 'Morgan', 'male', '1999-01-17')))
  add(addChild(graph, linda, person('Kim', 'Hale', 'female', '1993-07-25'), { coParentId: null }))
  add(addPartner(graph, sara, person('Paul', 'Reyes', 'male', '1989-03-14'), 'married'))
  add(addChild(graph, sara, person('Leo', 'Reyes', 'male', '2019-10-02')))

  // Mother's side
  const grace = add(addParent(graph, mary, person('Grace', 'Ellis', 'female', '1934-05-19', '2015')))
  add(addParent(graph, mary, person('George', 'Ellis', 'male', '1931-12-01', '2008')))
  const ann = add(addSibling(graph, mary, person('Ann', 'Ellis', 'female', '1963-08-11')))
  add(addPartner(graph, ann, person('Rob', 'Carter', 'male', '1961-06-06'), 'married'))
  add(addChild(graph, ann, person('Ben', 'Carter', 'male', '1990-02-27')))
  add(addParent(graph, grace, person('Ruth', 'Price', 'female', '1910', '1989')))

  // Alex's own family
  const emma = add(
    addPartner(graph, alex, person('Emma', 'Morgan', 'female', '1989-12-09'), 'married'),
  )
  add(addChild(graph, alex, person('Lily', 'Morgan', 'female', '2016-05-04')))
  add(addChild(graph, alex, person('Max', 'Morgan', 'male', '2020-08-22')))
  add(addParent(graph, emma, person('Joan', 'Brooks', 'female', '1962-01-29')))
  add(addSibling(graph, emma, person('Dan', 'Brooks', 'male', '1986-10-15')))

  return graph
}

function person(
  givenName: string,
  familyName: string,
  gender: NewPerson['gender'],
  birthDate?: string,
  deathDate?: string,
): NewPerson {
  return { givenName, familyName, gender, birthDate, deathDate }
}

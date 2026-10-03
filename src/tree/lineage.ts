import type { Edge } from '@xyflow/react'

/**
 * The lines to light up when someone clicks a line in the tree: that line and
 * everything above it. A line down to a child brings in both parents' lines
 * to their union, and then the same for each parent's own parents, all the
 * way up the tree.
 *
 * Lines are either partner lines (parent to union, which end at a union
 * node) or family lines (union, or a lone parent, down to a child).
 */
export function lineageEdgeIds(
  edges: Pick<Edge, 'id' | 'source' | 'target'>[],
  unionIds: ReadonlySet<string>,
  clickedId: string,
): Set<string> {
  const clicked = edges.find((e) => e.id === clickedId)
  const found = new Set<string>()
  if (!clicked) return found

  const into = new Map<string, typeof edges>()
  for (const edge of edges) into.set(edge.target, [...(into.get(edge.target) ?? []), edge])

  const seen = new Set<string>()
  /** Adds the lines that lead into a person or union. */
  const climb = (nodeId: string) => {
    if (seen.has(nodeId)) return
    seen.add(nodeId)
    for (const edge of into.get(nodeId) ?? []) {
      found.add(edge.id)
      // A union is reached from its parents; a person from their family's union or lone parent.
      climb(edge.source)
    }
  }

  found.add(clicked.id)
  // From a line to a child, continue from the union above; from a partner line, from the union itself.
  climb(unionIds.has(clicked.target) ? clicked.target : clicked.source)
  return found
}

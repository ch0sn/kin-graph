import { BaseEdge, type EdgeProps } from '@xyflow/react'
import type { FamilyEdge as FamilyEdgeType } from './familyLayout'

/**
 * A right-angled line from parents to a child: down to the family's bus in
 * the gap between rows, across, and down to the child. The bus height is
 * kept relative to the child so lines follow cards as they move.
 */
export function FamilyEdge({ id, sourceX, sourceY, targetX, targetY, data, style }: EdgeProps<FamilyEdgeType>) {
  const busY = targetY - (data?.busOffset ?? (targetY - sourceY) / 2)
  const path =
    Math.abs(sourceX - targetX) < 0.5
      ? `M ${sourceX},${sourceY} V ${targetY}`
      : `M ${sourceX},${sourceY} V ${busY} H ${targetX} V ${targetY}`
  return <BaseEdge id={id} path={path} style={style} />
}

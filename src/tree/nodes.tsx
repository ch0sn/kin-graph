import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { fullName, lifeYears, type Gender } from '../model'
import { Avatar } from '../ui/Avatar'
import { useTreeDisplay } from './display'
import type { PersonNode as PersonNodeType, UnionNode as UnionNodeType } from './familyLayout'

/*
 * React Flow measures where lines attach when a node first renders. The
 * handles therefore sit on a wrapper that never moves; only the visible card
 * inside it animates in, so lines meet the cards exactly.
 */

/** Card borders when highlighting gender; people without one keep the usual border. */
const GENDER_BORDERS: Partial<Record<Gender, string>> = {
  male: 'border-2 border-blue-500',
  female: 'border-2 border-red-500',
}

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person, label, isManager, entranceDelay = 0 } = data
  const { highlightGender } = useTreeDisplay()
  const years = lifeYears(person)
  const genderBorder = highlightGender && person.gender ? GENDER_BORDERS[person.gender] : undefined
  const border =
    genderBorder ??
    (isManager
      ? 'border-amber-300'
      : selected
        ? 'border-stone-400'
        : 'border-stone-200 hover:border-stone-300')

  return (
    <div className="relative size-full">
      <Handle id="top" type="target" position={Position.Top} className="handle" />
      <Handle id="left" type="source" position={Position.Left} className="handle" />
      <Handle id="right" type="source" position={Position.Right} className="handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="handle" />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: entranceDelay }}
        className={[
          'flex size-full items-center gap-3 rounded-2xl border bg-white px-3 shadow-sm transition-[box-shadow,border-color]',
          border,
          !isManager && 'hover:shadow-md',
          selected
            ? isManager
              ? 'shadow-md ring-4 ring-amber-300/70'
              : 'shadow-md ring-4 ring-stone-300/60'
            : isManager && 'ring-4 ring-amber-100',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <Avatar person={person} highlight={isManager} />
        <div className="min-w-0">
          {label && (
            <p
              title={label}
              className="truncate text-[10px] font-semibold tracking-[0.12em] text-stone-400 uppercase"
            >
              {label}
            </p>
          )}
          {/* Long names wrap onto a second line rather than being cut off. */}
          <p
            title={fullName(person)}
            className="line-clamp-2 font-serif text-[15px] leading-tight break-words text-stone-900"
          >
            {fullName(person)}
          </p>
          {years && <p className="text-xs text-stone-500 tabular-nums">{years}</p>}
        </div>
      </motion.div>
    </div>
  )
}

export function UnionNode({ data }: NodeProps<UnionNodeType>) {
  return (
    <div className="relative size-full">
      <Handle id="top" type="target" position={Position.Top} className="handle" />
      <Handle id="left" type="target" position={Position.Left} className="handle" />
      <Handle id="right" type="target" position={Position.Right} className="handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="handle" />
      <motion.div
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: data.entranceDelay ?? 0 }}
        className="size-full rounded-full border-2 border-stone-300 bg-stone-50"
      />
    </div>
  )
}

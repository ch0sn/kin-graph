import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { fullName, type Gender } from '../model'
import { Avatar } from '../ui/Avatar'
import { LifeLine } from '../ui/LifeLine'
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

/*
 * The manager's own card uses the theme's accent (by default orange in light
 * mode and yellow in dark mode; see index.css).
 */
const MANAGER_BORDER = 'border-(--accent)'
const MANAGER_GLOW = 'ring-4 ring-(--accent-glow)'
const MANAGER_SELECTED = 'card-shadow-hover ring-4 ring-(--accent-strong)'

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person, label, isManager, entranceDelay = 0 } = data
  const { highlightGender } = useTreeDisplay()
  const genderBorder = highlightGender && person.gender ? GENDER_BORDERS[person.gender] : undefined
  const border =
    genderBorder ??
    (isManager
      ? MANAGER_BORDER
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
          'flex size-full items-center gap-3 rounded-(--card-radius) border bg-white px-3 card-shadow transition-[box-shadow,border-color]',
          border,
          !isManager && 'hover:card-shadow-hover',
          selected
            ? isManager
              ? MANAGER_SELECTED
              : 'card-shadow-hover ring-4 ring-stone-300/60'
            : isManager && MANAGER_GLOW,
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
            className="line-clamp-2 font-serif text-(length:--name-size) leading-tight break-words text-stone-900"
          >
            {fullName(person)}
          </p>
          <LifeLine person={person} className="text-xs" />
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

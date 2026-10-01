import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import { fullName, lifeYears } from '../model'
import { Avatar } from '../ui/Avatar'
import type { PersonNode as PersonNodeType, UnionNode as UnionNodeType } from './familyLayout'

export function PersonNode({ data, selected }: NodeProps<PersonNodeType>) {
  const { person, label, isManager, entranceDelay = 0 } = data
  const years = lifeYears(person)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: entranceDelay }}
      className={[
        'flex h-full w-full items-center gap-3 rounded-2xl border bg-white px-3 shadow-sm transition-[box-shadow,border-color]',
        isManager ? 'border-amber-300' : 'border-stone-200 hover:border-stone-300 hover:shadow-md',
        selected
          ? isManager
            ? 'shadow-md ring-4 ring-amber-300/70'
            : 'border-stone-400 shadow-md ring-4 ring-stone-300/60'
          : isManager && 'ring-4 ring-amber-100',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <Handle id="top" type="target" position={Position.Top} className="handle" />
      <Handle id="left" type="source" position={Position.Left} className="handle" />
      <Handle id="right" type="source" position={Position.Right} className="handle" />
      <Avatar person={person} highlight={isManager} />
      <div className="min-w-0">
        {label && (
          <p className="truncate text-[10px] font-semibold tracking-[0.12em] text-stone-400 uppercase">
            {label}
          </p>
        )}
        <p className="truncate font-serif text-[15px] leading-tight text-stone-900">
          {fullName(person)}
        </p>
        {years && <p className="text-xs text-stone-500 tabular-nums">{years}</p>}
      </div>
      <Handle id="bottom" type="source" position={Position.Bottom} className="handle" />
    </motion.div>
  )
}

export function UnionNode({ data }: NodeProps<UnionNodeType>) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: data.entranceDelay ?? 0 }}
      className="size-full rounded-full border-2 border-stone-300 bg-stone-50"
    >
      <Handle id="top" type="target" position={Position.Top} className="handle" />
      <Handle id="left" type="target" position={Position.Left} className="handle" />
      <Handle id="right" type="target" position={Position.Right} className="handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="handle" />
    </motion.div>
  )
}

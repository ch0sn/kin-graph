import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion } from 'motion/react'
import type { Person } from '../model'
import {
  ENTRANCE_STAGGER as STAGGER,
  type PersonNode as PersonNodeType,
  type UnionNode as UnionNodeType,
} from './familyLayout'

export function PersonNode({ data }: NodeProps<PersonNodeType>) {
  const { person, label, isManager, distance } = data
  const years = lifeYears(person)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: distance * STAGGER }}
      className={[
        'flex h-full w-full items-center gap-3 rounded-2xl border bg-white px-3 shadow-sm',
        isManager
          ? 'border-amber-300 ring-4 ring-amber-100'
          : 'border-stone-200 hover:border-stone-300 hover:shadow-md',
      ].join(' ')}
    >
      <Handle id="top" type="target" position={Position.Top} className="handle" />
      <Handle id="left" type="source" position={Position.Left} className="handle" />
      <Handle id="right" type="source" position={Position.Right} className="handle" />
      <div
        className={[
          'flex size-11 shrink-0 items-center justify-center rounded-full font-serif text-lg',
          isManager ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600',
        ].join(' ')}
        aria-hidden
      >
        {initials(person)}
      </div>
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
      transition={{ delay: data.distance * STAGGER }}
      className="size-full rounded-full border-2 border-stone-300 bg-stone-50"
    >
      <Handle id="top" type="target" position={Position.Top} className="handle" />
      <Handle id="left" type="target" position={Position.Left} className="handle" />
      <Handle id="right" type="target" position={Position.Right} className="handle" />
      <Handle id="bottom" type="source" position={Position.Bottom} className="handle" />
    </motion.div>
  )
}

function fullName(person: Person): string {
  return [person.givenName, person.familyName].filter(Boolean).join(' ')
}

function initials(person: Person): string {
  return [person.givenName, person.familyName]
    .map((name) => name?.trim().charAt(0) ?? '')
    .join('')
    .toUpperCase()
}

function lifeYears(person: Person): string | null {
  const born = person.birthDate?.slice(0, 4)
  const died = person.deathDate?.slice(0, 4)
  if (born && died) return `${born} – ${died}`
  if (born) return `b. ${born}`
  if (died) return `d. ${died}`
  return null
}

import { ArrowLeft, ArrowUp, Baby, Heart, Pencil, Trash, Users, X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import {
  addChild,
  addParent,
  addPartner,
  addSibling,
  displayName,
  fullName,
  GraphError,
  isOngoing,
  parentIdsOf,
  partnershipsOf,
  partnerOf,
  relationshipLabel,
  removePerson,
  updatePerson,
  type FamilyGraph,
  type NewPerson,
  type ParentKind,
  type PartnershipStatus,
  type Person,
  type PersonId,
} from '../model'
import { useT } from '../i18n'
import { Avatar } from '../ui/Avatar'
import { LifeLine } from '../ui/LifeLine'
import { Button, CheckboxGroup, Segmented, type Option } from '../ui/fields'
import { PersonForm } from './PersonForm'
import { emptyValues, keepNameDetails, valuesFromPerson } from './personValues'

type Relation = 'parent' | 'partner' | 'sibling' | 'child'

type Mode = { view: 'details' } | { view: 'add'; relation: Relation } | { view: 'edit' } | { view: 'remove' }

interface PersonSheetProps {
  graph: FamilyGraph
  personId: PersonId | null
  onChange: (graph: FamilyGraph) => void
  onClose: () => void
}

/** Details and actions for the selected person, sliding up from the bottom. */
export function PersonSheet({ graph, personId, onChange, onClose }: PersonSheetProps) {
  const person = personId ? graph.people[personId] : undefined
  return (
    <AnimatePresence>
      {person && (
        <Sheet key="sheet" label={fullName(person)} onClose={onClose}>
          {/* Keyed by person so switching people resets the view. */}
          <SheetBody
            key={person.id}
            graph={graph}
            person={person}
            onChange={onChange}
            onClose={onClose}
          />
        </Sheet>
      )}
    </AnimatePresence>
  )
}

function Sheet({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const dragControls = useDragControls()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // A modal dialog on top (e.g. photo cropping) handles its own Escape.
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <motion.section
      role="dialog"
      aria-label={label}
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.7 }}
      onDragEnd={(_, info) => {
        if (info.offset.y > 120 || info.velocity.y > 600) onClose()
      }}
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-3xl border border-b-0 border-stone-200 bg-white shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:rounded-3xl sm:border-b"
    >
      <div
        className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
        aria-hidden
      >
        <div className="h-1.5 w-10 rounded-full bg-stone-300" />
      </div>
      <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </motion.section>
  )
}

function SheetBody({
  graph,
  person,
  onChange,
  onClose,
}: {
  graph: FamilyGraph
  person: Person
  onChange: (graph: FamilyGraph) => void
  onClose: () => void
}) {
  const { t } = useT()
  const [mode, setMode] = useState<Mode>({ view: 'details' })
  const [error, setError] = useState<string | null>(null)
  const go = (next: Mode) => {
    setMode(next)
    setError(null)
  }

  /** Applies an edit, showing the reason inline if the model rejects it. */
  const apply = (edit: () => FamilyGraph, after: () => void = () => go({ view: 'details' })) => {
    try {
      onChange(edit())
      after()
    } catch (e) {
      if (!(e instanceof GraphError)) throw e
      setError(e.message)
    }
  }

  const label = relationshipLabel(graph, person.id)
  const isManager = person.id === graph.managerId

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={mode.view === 'add' ? `add-${mode.relation}` : mode.view}
        initial={{ opacity: 0, x: mode.view === 'details' ? -12 : 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
      >
        {mode.view === 'details' && (
          <div className="flex flex-col gap-5">
            <header className="flex items-center gap-4 pt-1">
              <Avatar person={person} size="md" highlight={isManager} />
              <div className="min-w-0 flex-1">
                {label && (
                  <p className="text-[11px] font-semibold tracking-[0.12em] text-stone-400 uppercase">
                    {label}
                  </p>
                )}
                <h2 className="truncate font-serif text-2xl leading-tight text-stone-900">
                  {fullName(person)}
                </h2>
                <LifeLine person={person} detailed className="text-sm" />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="self-start rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                aria-label={t('common.close')}
              >
                <X className="size-5" />
              </button>
            </header>

            <div className="grid grid-cols-2 gap-2">
              <ActionButton icon={<ArrowUp />} onClick={() => go({ view: 'add', relation: 'parent' })}>
                {t('sheet.addParent')}
              </ActionButton>
              <ActionButton icon={<Heart />} onClick={() => go({ view: 'add', relation: 'partner' })}>
                {t('sheet.addPartner')}
              </ActionButton>
              <ActionButton icon={<Users />} onClick={() => go({ view: 'add', relation: 'sibling' })}>
                {t('sheet.addSibling')}
              </ActionButton>
              <ActionButton icon={<Baby />} onClick={() => go({ view: 'add', relation: 'child' })}>
                {t('sheet.addChild')}
              </ActionButton>
            </div>

            <div className="flex gap-2 border-t border-stone-100 pt-4">
              <Button variant="ghost" onClick={() => go({ view: 'edit' })}>
                <Pencil className="size-4" aria-hidden />
                {t('sheet.edit')}
              </Button>
              {!isManager && (
                <Button
                  variant="ghost"
                  className="ml-auto text-red-700 hover:bg-red-50 hover:text-red-800"
                  onClick={() => go({ view: 'remove' })}
                >
                  <Trash className="size-4" aria-hidden />
                  {t('common.remove')}
                </Button>
              )}
            </div>
          </div>
        )}

        {mode.view === 'add' && (
          <SubView
            title={t(`add.${mode.relation}.title`)}
            subtitle={t('sheet.for', { name: fullName(person) })}
            onBack={() => go({ view: 'details' })}
          >
            <AddRelativeForm
              graph={graph}
              person={person}
              relation={mode.relation}
              error={error}
              onCancel={() => go({ view: 'details' })}
              onSubmit={(edit) => apply(edit)}
            />
          </SubView>
        )}

        {mode.view === 'edit' && (
          <SubView title={t('sheet.edit')} subtitle={fullName(person)} onBack={() => go({ view: 'details' })}>
            <PersonForm
              initial={valuesFromPerson(person)}
              submitLabel={t('common.save')}
              error={error}
              onCancel={() => go({ view: 'details' })}
              onSubmit={(fields) => apply(() => updatePerson(graph, person.id, keepNameDetails(fields, person)))}
            />
          </SubView>
        )}

        {mode.view === 'remove' && (
          <SubView title={t('sheet.removeTitle', { name: displayName(person).given })} onBack={() => go({ view: 'details' })}>
            <p className="text-sm leading-relaxed text-stone-600">
              {t('sheet.removeBody', { name: fullName(person) })}
            </p>
            {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go({ view: 'details' })}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" onClick={() => apply(() => removePerson(graph, person.id), onClose)}>
                {t('common.remove')}
              </Button>
            </div>
          </SubView>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

function SubView({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string
  subtitle?: string
  onBack: () => void
  children: ReactNode
}) {
  const { t } = useT()
  return (
    <div className="flex flex-col gap-4 pt-1">
      <header className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0">
          <h2 className="font-serif text-xl leading-tight text-stone-900">{title}</h2>
          {subtitle && <p className="truncate text-sm text-stone-500">{subtitle}</p>}
        </div>
      </header>
      {children}
    </div>
  )
}

function ActionButton({
  icon,
  onClick,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3.5 text-left text-sm font-medium text-stone-800 transition hover:border-stone-300 hover:bg-white active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none [&_svg]:size-4 [&_svg]:text-stone-500"
    >
      {icon}
      {children}
    </button>
  )
}

// --- Adding relatives -----------------------------------------------------------

const PARENT_KIND_VALUES: ParentKind[] = ['biological', 'adoptive', 'foster']

const STATUS_VALUES: PartnershipStatus[] = ['married', 'partnered', 'separated', 'divorced', 'widowed']

const NO_CO_PARENT = 'none'

function AddRelativeForm({
  graph,
  person,
  relation,
  error,
  onSubmit,
  onCancel,
}: {
  graph: FamilyGraph
  person: Person
  relation: Relation
  error: string | null
  onSubmit: (edit: () => FamilyGraph) => void
  onCancel: () => void
}) {
  const { t } = useT()
  const PARENT_KINDS: Option<ParentKind>[] = PARENT_KIND_VALUES.map((value) => ({
    value,
    label: t(`kind.${value}`),
  }))
  const PARTNERSHIP_STATUSES: Option<PartnershipStatus>[] = STATUS_VALUES.map((value) => ({
    value,
    label: t(`status.${value}`),
  }))
  const name = (id: PersonId) => fullName(graph.people[id])

  // Parent
  const hasTwoBiologicalParents = parentIdsOf(graph, person.id, ['biological']).length >= 2
  const [parentKind, setParentKind] = useState<ParentKind>(
    hasTwoBiologicalParents ? 'adoptive' : 'biological',
  )

  // Sibling: choosing a subset of parents makes a half-sibling.
  const visibleParents = parentIdsOf(graph, person.id).filter(
    (id) => !graph.people[id].isPlaceholder,
  )
  const [sharedParentIds, setSharedParentIds] = useState(visibleParents)

  // Partner
  const [status, setStatus] = useState<PartnershipStatus>('married')

  // Child: the other parent defaults to the only ongoing partner, as in the model.
  const partnerships = partnershipsOf(graph, person.id)
  const ongoing = partnerships.filter(isOngoing)
  const [coParent, setCoParent] = useState<string>(
    ongoing.length === 1 ? partnerOf(ongoing[0], person.id) : NO_CO_PARENT,
  )
  const [childKind, setChildKind] = useState<ParentKind>('biological')

  const sharesFamilyName = relation === 'sibling' || relation === 'child'
  const initial = emptyValues({
    familyName: sharesFamilyName ? (displayName(person).surnames?.join(' ') ?? '') : '',
  })

  const add = (relative: NewPerson): FamilyGraph => {
    switch (relation) {
      case 'parent':
        return addParent(graph, person.id, relative, { kind: parentKind }).graph
      case 'partner':
        return addPartner(graph, person.id, relative, status).graph
      case 'sibling':
        return addSibling(graph, person.id, relative, {
          sharedParentIds: visibleParents.length > 1 ? sharedParentIds : undefined,
        }).graph
      case 'child':
        return addChild(graph, person.id, relative, {
          kind: childKind,
          coParentId: coParent === NO_CO_PARENT ? null : coParent,
        }).graph
    }
  }

  return (
    <PersonForm
      initial={initial}
      submitLabel={t(`add.${relation}.submit`)}
      error={error}
      onCancel={onCancel}
      onSubmit={(relative) => onSubmit(() => add(relative))}
    >
      {relation === 'parent' && (
        <Segmented
          label={t('form.relationship')}
          options={PARENT_KINDS.map((o) => ({
            ...o,
            disabled: o.value === 'biological' && hasTwoBiologicalParents,
          }))}
          value={parentKind}
          onChange={setParentKind}
        />
      )}

      {relation === 'partner' && (
        <Segmented label={t('form.status')} options={PARTNERSHIP_STATUSES} value={status} onChange={setStatus} />
      )}

      {relation === 'sibling' && visibleParents.length > 1 && (
        <CheckboxGroup
          label={t('form.sharedParents')}
          hint={t('form.sharedParentsHint')}
          options={visibleParents.map((id) => ({ value: id, label: name(id) }))}
          values={sharedParentIds}
          onChange={setSharedParentIds}
        />
      )}

      {relation === 'child' && (
        <>
          {partnerships.length > 0 && (
            <Segmented
              label={t('form.otherParent')}
              options={[
                ...partnerships.map((p) => ({
                  value: partnerOf(p, person.id),
                  label: name(partnerOf(p, person.id)),
                })),
                { value: NO_CO_PARENT, label: t('form.notRecorded') },
              ]}
              value={coParent}
              onChange={setCoParent}
            />
          )}
          <Segmented label={t('form.relationship')} options={PARENT_KINDS} value={childKind} onChange={setChildKind} />
        </>
      )}
    </PersonForm>
  )
}

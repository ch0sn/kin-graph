import { ArrowLeft, ArrowUp, Baby, Heart, Mars, Pencil, Plus, Trash, Users, Venus, X } from 'lucide-react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  addChild,
  addEvent,
  addParent,
  addPartner,
  addSibling,
  displayName,
  formatFuzzyDate,
  fullName,
  GraphError,
  isOngoing,
  linkPartners,
  parentIdsOf,
  partnershipsOf,
  coParentFor,
  unlinkedCoParentIdsOf,
  partnerOf,
  relationshipLabel,
  removeEvent,
  removePerson,
  updateEvent,
  updatePartnership,
  updatePerson,
  type FamilyGraph,
  type Gender,
  type LifeEvent,
  type NewPerson,
  type ParentKind,
  type Partnership,
  type PartnershipStatus,
  type Person,
  type PersonId,
} from '../model'
import { useT } from '../i18n'
import { Avatar } from '../ui/Avatar'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LifeLine } from '../ui/LifeLine'
import { Button, CheckboxGroup, Segmented, type Option } from '../ui/fields'
import { EventForm } from './EventForm'
import { emptyEventValues, valuesFromEvent } from './eventValues'
import { LocationRow } from './LocationRow'
import { PartnershipForm } from './PartnershipForm'
import { PersonForm } from './PersonForm'
import { Timeline } from './Timeline'
import { emptyName, emptyValues, valuesFromPerson } from './personValues'

type Relation = 'parent' | 'partner' | 'sibling' | 'child'

type Mode =
  | { view: 'details' }
  | { view: 'add'; relation: Relation }
  | { view: 'edit' }
  /** Choosing which kind of relative to add. */
  | { view: 'relative' }
  | { view: 'remove' }
  /** Adding a life event, or editing the given one. */
  | { view: 'event'; event?: LifeEvent }
  /** Editing a partnership, or recording a new one with someone already in the tree. */
  | { view: 'partnership'; partnerId: PersonId; partnership?: Partnership }

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

/**
 * Where the toolbox goes: a slot beside the sheet, outside its scrolling
 * area, which the sheet body fills through a portal.
 */
const ToolboxSlot = createContext<HTMLElement | null>(null)

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
  const [toolboxSlot, setToolboxSlot] = useState<HTMLElement | null>(null)

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
      className="fixed inset-x-0 bottom-0 z-20 mx-auto flex max-h-[85dvh] w-full max-w-md flex-col sm:max-w-sm rounded-t-3xl border border-b-0 border-stone-200 bg-white shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] sm:inset-x-auto sm:bottom-4 sm:left-4 sm:rounded-3xl sm:border-b sm:has-[[role=toolbar]]:rounded-tr-none"
    >
      <div
        className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
        onPointerDown={(e) => dragControls.start(e)}
        aria-hidden
      >
        <div className="h-1.5 w-10 rounded-full bg-stone-300" />
      </div>
      <div className="overflow-y-auto overscroll-contain px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <ToolboxSlot value={toolboxSlot}>{children}</ToolboxSlot>
      </div>
      {/*
        Beside the sheet on wide screens; on narrow ones the actions sit inside it.
        It is placed over the sheet's top and right border so the two read as one box.
      */}
      <div ref={setToolboxSlot} className="absolute -top-px left-full hidden sm:block" />
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
                <h2 className="flex items-center gap-2 font-serif text-2xl leading-tight text-stone-900">
                  <span className="truncate">{fullName(person)}</span>
                  <GenderIcon gender={person.gender} />
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


            <PartnerList
              graph={graph}
              personId={person.id}
              onEdit={(partnerId, partnership) => go({ view: 'partnership', partnerId, partnership })}
            />

            <Toolbox
              onAddRelative={() => go({ view: 'relative' })}
              onEdit={() => go({ view: 'edit' })}
              onRemove={isManager ? undefined : () => go({ view: 'remove' })}
            />

            <Timeline
              graph={graph}
              personId={person.id}
              onAdd={() => go({ view: 'event' })}
              onEdit={(event) => go({ view: 'event', event })}
              before={
                <LocationRow
                  location={person.location}
                  knownCountries={knownCountries(graph)}
                  onSave={(location, locationCountry) =>
                    apply(() => updatePerson(graph, person.id, { location, locationCountry }), () => {})
                  }
                />
              }
            />

            <div className="flex gap-2 border-t border-stone-100 pt-4 sm:hidden">
              <Button variant="primary" onClick={() => go({ view: 'relative' })}>
                <Plus className="size-4" aria-hidden />
                {t('sheet.addRelative')}
              </Button>
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

        {mode.view === 'relative' && (
          <SubView
            title={t('sheet.addRelative')}
            subtitle={t('sheet.addRelativeHint', { name: fullName(person) })}
            onBack={() => go({ view: 'details' })}
          >
            <div className="flex flex-col gap-2">
              {RELATIONS.map(({ relation, Icon }) => (
                <button
                  key={relation}
                  type="button"
                  onClick={() => go({ view: 'add', relation })}
                  className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:border-stone-300 hover:bg-white active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none"
                >
                  <Icon className="size-5 shrink-0 text-stone-500" aria-hidden />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-stone-800">
                      {t(`sheet.add${capitalize(relation)}`)}
                    </span>
                    <span className="text-xs text-stone-500">
                      {t(`sheet.add${capitalize(relation)}.hint`)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </SubView>
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
              onSubmit={(fields) => apply(() => updatePerson(graph, person.id, fields))}
            />
          </SubView>
        )}

        {mode.view === 'partnership' && (
          <SubView
            title={t(mode.partnership ? 'partnership.edit' : 'partnership.link')}
            subtitle={`${fullName(person)} & ${fullName(graph.people[mode.partnerId])}`}
            onBack={() => go({ view: 'details' })}
          >
            <PartnershipForm
              partnership={mode.partnership ?? { status: 'married' }}
              onCancel={() => go({ view: 'details' })}
              onSubmit={(patch) =>
                apply(() =>
                  mode.partnership
                    ? updatePartnership(graph, mode.partnership.id, patch)
                    : linkPartners(graph, person.id, mode.partnerId, patch),
                )
              }
            />
          </SubView>
        )}

        {mode.view === 'event' && (
          <SubView
            title={t(mode.event ? 'sheet.edit' : 'event.add')}
            subtitle={fullName(person)}
            onBack={() => go({ view: 'details' })}
          >
            <EventForm
              initial={mode.event ? valuesFromEvent(mode.event) : emptyEventValues()}
              onCancel={() => go({ view: 'details' })}
              onRemove={
                mode.event && (() => apply(() => removeEvent(graph, mode.event!.id)))
              }
              onSubmit={(fields) =>
                apply(() =>
                  mode.event
                    ? updateEvent(graph, mode.event.id, fields)
                    : addEvent(graph, person.id, fields),
                )
              }
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

/** The person's partners with the status and dates of each partnership, to edit. */
/**
 * The person's partners with the status and dates of each partnership, to
 * edit, and anyone they share a child with who isn't recorded as a partner.
 */
function PartnerList({
  graph,
  personId,
  onEdit,
}: {
  graph: FamilyGraph
  personId: PersonId
  /** Edits the partnership with `partnerId`, or records one when there is none. */
  onEdit: (partnerId: PersonId, partnership?: Partnership) => void
}) {
  const { t } = useT()
  const partnerships = partnershipsOf(graph, personId)
  const coParents = unlinkedCoParentIdsOf(graph, personId)
  if (partnerships.length === 0 && coParents.length === 0) return null
  const name = (id: PersonId) => fullName(graph.people[id])
  return (
    <section className="flex flex-col gap-2 border-t border-stone-100 pt-4">
      <h3 className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
        {t('partnership.title')}
      </h3>
      <ul className="flex flex-col">
        {partnerships.map((p) => {
          const partnerId = partnerOf(p, personId)
          const dates = [p.startDate, p.endDate]
            .map((d) => d && formatFuzzyDate(d))
            .filter(Boolean)
            .join(' – ')
          return (
            <li key={p.id} className="flex items-center gap-2 py-1">
              <p className="min-w-0 flex-1 text-sm text-stone-900">
                <span className="font-medium">{name(partnerId)}</span>
                <span className="text-stone-500">
                  {' · '}
                  {t(`status.${p.status}`)}
                  {dates && ` · ${dates}`}
                </span>
              </p>
              <button
                type="button"
                onClick={() => onEdit(partnerId, p)}
                aria-label={`${t('partnership.edit')}: ${name(partnerId)}`}
                className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-900"
              >
                <Pencil className="size-3.5" aria-hidden />
              </button>
            </li>
          )
        })}
        {coParents.map((id) => (
          <li key={id} className="flex items-center gap-2 py-1">
            <p className="min-w-0 flex-1 text-sm text-stone-900">
              <span className="font-medium">{name(id)}</span>
              <span className="text-stone-500"> · {t('partnership.unlinked')}</span>
            </p>
            <Button variant="ghost" className="-mr-2 px-2.5 py-1 text-xs" onClick={() => onEdit(id)}>
              <Plus className="size-3.5" aria-hidden />
              {t('partnership.linkShort')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
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

/**
 * The person's actions in a box beside the sheet. It renders into the
 * sheet's side slot, so on narrow screens it is simply absent.
 */
function Toolbox({
  onAddRelative,
  onEdit,
  onRemove,
}: {
  onAddRelative: () => void
  onEdit: () => void
  onRemove?: () => void
}) {
  const { t } = useT()
  const slot = useContext(ToolboxSlot)
  if (!slot) return null
  // Icons only until the box is hovered or focused, then it widens to show the labels.
  // Collapsed, 57px less the padding and right border leaves 40px: a 20px icon with 10px either side.
  const tool =
    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left text-[11px] font-medium whitespace-nowrap transition active:scale-[0.98] focus-visible:ring-4 focus-visible:ring-stone-200 focus-visible:outline-none [&_svg]:size-5 [&_svg]:shrink-0'
  const label =
    'opacity-0 transition-opacity duration-150 group-hover/tools:opacity-100 group-focus-within/tools:opacity-100 motion-reduce:transition-none'
  return createPortal(
    <div
      role="toolbar"
      aria-label={t('sheet.tools')}
      className="group/tools flex w-[57px] flex-col gap-1 overflow-hidden rounded-tr-3xl rounded-br-2xl border border-l-0 border-stone-200 bg-white p-2 pt-4 shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] [clip-path:inset(-60px_-60px_-60px_0)] transition-[width] duration-200 ease-out hover:w-48 focus-within:w-48 motion-reduce:transition-none"
    >
      <button
        type="button"
        onClick={onAddRelative}
        title={t('sheet.addRelative')}
        className={`${tool} bg-stone-900 text-white hover:bg-stone-800`}
      >
        <Plus aria-hidden />
        <span className={label}>{t('sheet.addRelative')}</span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        title={t('sheet.edit')}
        className={`${tool} text-stone-700 hover:bg-stone-100 hover:text-stone-900`}
      >
        <Pencil aria-hidden />
        <span className={label}>{t('sheet.edit')}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title={t('sheet.removePerson')}
          className={`${tool} text-red-700 hover:bg-red-50 hover:text-red-800`}
        >
          <Trash aria-hidden />
          <span className={label}>{t('sheet.removePerson')}</span>
        </button>
      )}
    </div>,
    slot,
  )
}

/** The countries people in the tree live in, as far as postal code lookups recorded them. */
function knownCountries(graph: FamilyGraph): string[] {
  const codes = Object.values(graph.people).map((p) => p.locationCountry)
  return [...new Set(codes.filter((c): c is string => !!c))]
}

const GENDER_ICONS = {
  male: { Icon: Mars, className: 'text-blue-500' },
  female: { Icon: Venus, className: 'text-red-500' },
} as const

/** ♂ or ♀ beside a name, in the tree's highlight colours; nothing for other or unknown. */
function GenderIcon({ gender }: { gender?: Gender }) {
  const { t } = useT()
  if (gender !== 'male' && gender !== 'female') return null
  const { Icon, className } = GENDER_ICONS[gender]
  return (
    <Icon
      role="img"
      aria-label={t(`gender.${gender}`)}
      className={`size-5 shrink-0 ${className}`}
      strokeWidth={2.25}
    />
  )
}

const RELATIONS = [
  { relation: 'parent', Icon: ArrowUp },
  { relation: 'partner', Icon: Heart },
  { relation: 'sibling', Icon: Users },
  { relation: 'child', Icon: Baby },
] as const

const capitalize = <T extends string>(text: T) => (text[0].toUpperCase() + text.slice(1)) as Capitalize<T>

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
  // Siblings and children start with the same surnames.
  const { surnames } = displayName(person)
  const initial = emptyValues({
    names: [
      sharesFamilyName && surnames?.length
        ? emptyName({ surname: surnames.join(' '), surnameParts: surnames })
        : emptyName(),
    ],
  })

  // A second parent: ask how the two parents are related before adding, so
  // they're recorded as a couple rather than one becoming the other's ex or a step-parent.
  const coParentId = relation === 'parent' ? coParentFor(graph, person.id, parentKind) : null
  const [pendingParent, setPendingParent] = useState<NewPerson | null>(null)
  const [parentsStatus, setParentsStatus] = useState<PartnershipStatus>('married')

  const add = (relative: NewPerson, partnerStatus?: PartnershipStatus): FamilyGraph => {
    switch (relation) {
      case 'parent':
        return addParent(graph, person.id, relative, { kind: parentKind, partnerStatus }).graph
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
      onSubmit={(relative) =>
        coParentId ? setPendingParent(relative) : onSubmit(() => add(relative))
      }
    >
      {coParentId && (
        <ConfirmDialog
          open={pendingParent !== null}
          title={t('parents.title', {
            a: pendingParent ? fullName(pendingParent) : '',
            b: name(coParentId),
          })}
          confirmLabel={t('common.save')}
          secondaryLabel={t('parents.notCouple')}
          cancelLabel={t('common.back')}
          onConfirm={() => {
            const relative = pendingParent!
            setPendingParent(null)
            onSubmit(() => add(relative, parentsStatus))
          }}
          onSecondary={() => {
            const relative = pendingParent!
            setPendingParent(null)
            onSubmit(() => add(relative))
          }}
          onCancel={() => setPendingParent(null)}
        >
          <div className="flex flex-col gap-4">
            <p>{t('parents.body', { child: fullName(person) })}</p>
            <Segmented
              label={t('form.status')}
              options={PARTNERSHIP_STATUSES}
              value={parentsStatus}
              onChange={setParentsStatus}
            />
          </div>
        </ConfirmDialog>
      )}
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

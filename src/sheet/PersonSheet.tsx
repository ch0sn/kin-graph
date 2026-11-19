import { ArrowLeft, ArrowUp, Baby, ChevronRight, Eye, FileText, FileUp, Heart, Mars, Pencil, Plus, Trash, Users, Venus, X, type LucideIcon } from 'lucide-react'
import { animate, AnimatePresence, motion, stagger, useDragControls, useIsPresent, useMotionValue, useReducedMotion, type AnimationPlaybackControls, type Variants } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import {
  addChild,
  addEvent,
  addParent,
  addPartner,
  addSibling,
  childIdsOf,
  displayName,
  formatFuzzyDate,
  fullName,
  GraphError,
  isOngoing,
  lifeYears,
  linkPartners,
  parentIdsOf,
  partnerIdsOf,
  partnershipsOf,
  coParentFor,
  siblingsOf,
  surnamesForChild,
  unlinkedCoParentIdsOf,
  partnerOf,
  peopleCount,
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
import { useBackupPicker } from '../storage/useBackupPicker'
import { labelOffset } from '../tree/discColumn'
import { NodeActionButton, NodeFan, type NodeMenuAction } from '../tree/NodeMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { LifeLine } from '../ui/LifeLine'
import { Button, CheckboxGroup, Segmented, type Option } from '../ui/fields'
import { EventForm } from './EventForm'
import { FormActionsSlot } from './formActionsSlot'
import { emptyEventValues, valuesFromEvent } from './eventValues'
import { LocationRow } from './LocationRow'
import { PartnershipForm } from './PartnershipForm'
import { PersonForm } from './PersonForm'
import { PersonPortrait } from './PersonPortrait'
import { Timeline } from './Timeline'
import { emptyName, emptyValues, valuesFromPerson } from './personValues'

export type Relation = 'parent' | 'partner' | 'sibling' | 'child'

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

/** Seeing the family from someone else's side. */
export interface Perspectives {
  /** Shows the tree with the person as its root, first asking whether to make it their tree. */
  onViewAs: (personId: PersonId) => void
  /** Opens the person's own tree. */
  onOpenOwnTree: (personId: PersonId) => void
  /** The person's own tree on this device, if they have one. */
  ownTree: (personId: PersonId) => OwnTree | null
  /** Opens a file as the person's own tree. */
  onOpenFile: (personId: PersonId, graph: FamilyGraph) => void
  /** Removes the person and deletes their own tree. */
  onRemoveWithTree: (personId: PersonId, graph: FamilyGraph) => void
  /** Whether the sheet shows a view, whose root is only seen from, not the tree's own. */
  isView: boolean
  /** Asks to delete the whole tree, as removing its root means. */
  onDeleteTree: () => void
}

/** A toolbox action; greyed out with its title saying why when it isn't available. */
interface Tool {
  available: boolean
  title: string
  onClick: () => void
}

/** The file action: open a person's own tree, or import one when they have none. */
interface FileTool extends Tool {
  label: string
  Icon: LucideIcon
}

export interface OwnTree {
  /** e.g. "Mary Morgan's tree". */
  name: string
  /** e.g. "12 people". */
  people: string
}

interface PersonSheetProps {
  graph: FamilyGraph
  personId: PersonId | null
  searchFocus: number
  onChange: (graph: FamilyGraph) => void
  onClose: () => void
  onSelectPerson: (id: PersonId) => void
  onBackPerson?: () => void
  perspectives?: Perspectives
  /** Opens the sheet on the form for adding this kind of relative, rather than the details. */
  startWith?: Relation
}

/** Wide enough for the corner fan. Matches the `sm` anchor on the sheet. */
const fanBreakpoint = '(min-width: 640px)'
const fanFits = () => window.matchMedia(fanBreakpoint).matches

function subscribeToFanBreakpoint(onChange: () => void) {
  const query = window.matchMedia(fanBreakpoint)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const mobileActionRow: Variants = {
  opening: { transition: { delayChildren: stagger(0.04) } },
  closing: { transition: { delayChildren: stagger(0.03, { from: 'last' }) } },
}

const mobileActionDisc: Variants = {
  folded: { opacity: 0, y: 16, scale: 0.8 },
  opening: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  closing: { opacity: 0, y: 16, scale: 0.8, transition: { duration: 0.14, ease: 'easeIn' } },
}

function MobilePersonActions({ actions }: { actions: NodeMenuAction[] }) {
  const { t } = useT()
  const wide = useSyncExternalStore(subscribeToFanBreakpoint, fanFits)
  const reduce = useReducedMotion()
  const present = useIsPresent()
  if (wide) return null

  return (
    <motion.div
      className={`flex justify-center gap-2 pb-2 min-[360px]:gap-3 sm:hidden ${present ? '' : 'absolute inset-x-0 bottom-0'}`}
      role="group"
      aria-label={t('sheet.tools')}
      inert={!present}
      variants={mobileActionRow}
      initial={reduce ? false : 'folded'}
      animate="opening"
      exit={reduce ? undefined : 'closing'}
    >
      {actions.map((action) => (
        <motion.div key={action.id} variants={mobileActionDisc}>
          <NodeActionButton action={action} />
        </motion.div>
      ))}
    </motion.div>
  )
}

/** Details and actions for the selected person, sliding up from the bottom. */
export function PersonSheet({
  graph,
  personId,
  searchFocus,
  onChange,
  onClose,
  onSelectPerson,
  onBackPerson,
  perspectives,
  startWith,
}: PersonSheetProps) {
  const sheet = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    if (searchFocus > 0) sheet.current?.focus({ preventScroll: true })
  }, [searchFocus])
  const live = personId ? graph.people[personId] : undefined
  // Kept while the fan folds, so clearing the selection does not take the card with it.
  const [held, setHeld] = useState(live)
  if (live && held !== live) setHeld(live)

  const [cardOn, setCardOn] = useState(false)
  const [fanOpen, setFanOpen] = useState(false)
  const finishFold = useCallback(() => setCardOn(false), [])

  if (live) {
    if (!cardOn) setCardOn(true)
    if (!fanOpen) setFanOpen(true)
  } else if (cardOn && fanOpen) {
    // Discs slide back into the card first. Then the card slides away.
    if (fanFits()) setFanOpen(false)
    else setCardOn(false)
  }

  const person = live ?? (cardOn ? held : undefined)
  return (
    <AnimatePresence>
      {person && (
        <Sheet key="sheet" sheetRef={sheet} label={fullName(person)} onClose={onClose}>
          {/* Keyed by person (and where it starts) so switching resets the view. */}
          <SheetBody
            key={`${person.id}:${startWith ?? ''}`}
            graph={graph}
            person={person}
            onChange={onChange}
            onClose={onClose}
            onSelectPerson={onSelectPerson}
            onBackPerson={onBackPerson}
            perspectives={perspectives}
            startWith={startWith}
            fanOpen={fanOpen}
            onFanFolded={finishFold}
          />
        </Sheet>
      )}
    </AnimatePresence>
  )
}

/**
 * Mobile actions sit above the card. On wide screens the same anchor
 * positions the fan behind the card's top-right corner.
 */
const SheetAnchorContext = createContext<HTMLElement | null>(null)

function Sheet({
  sheetRef,
  label,
  onClose,
  children,
}: {
  sheetRef: RefObject<HTMLElement | null>
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const dragControls = useDragControls()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const handle = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  const cardHeight = useMotionValue<number | 'auto'>('auto')
  const wide = useSyncExternalStore(subscribeToFanBreakpoint, fanFits)
  const reduce = useReducedMotion()
  const present = useIsPresent()

  useLayoutEffect(() => {
    if (reduce) {
      cardHeight.jump('auto')
      return
    }
    const shell = sheetRef.current
    const surface = card.current
    const grip = handle.current
    const body = content.current
    if (!present || !shell || !surface || !grip || !body || !anchor) return

    let target: number | undefined
    let animation: AnimationPlaybackControls | undefined
    const resize = () => {
      // Animate the actual height so the docked bottom edge, text, and sticky
      // form controls all stay in their normal layout throughout the transition.
      const surfaceStyle = getComputedStyle(surface)
      const surfaceLimit = Number.parseFloat(surfaceStyle.maxHeight)
      // Only the mobile action row takes up vertical space in the sheet.
      const limit = wide
        ? surfaceLimit
        : Math.min(surfaceLimit, Number.parseFloat(getComputedStyle(shell).maxHeight) - anchor.offsetHeight)
      const border = Number.parseFloat(surfaceStyle.borderTopWidth) + Number.parseFloat(surfaceStyle.borderBottomWidth)
      const desired = grip.offsetHeight + body.offsetHeight + border
      const next = Math.max(0, Math.min(desired, limit))
      if (!Number.isFinite(next) || next === target) return

      animation?.stop()
      target = next
      if (cardHeight.get() === 'auto') cardHeight.jump(next)
      else animation = animate(cardHeight, next, { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] })
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(body)
    observer.observe(grip)
    observer.observe(anchor)
    window.addEventListener('resize', resize)
    return () => {
      animation?.stop()
      observer.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [anchor, cardHeight, present, reduce, sheetRef, wide])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // A modal dialog on top (e.g. photo cropping) handles its own Escape.
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <SheetAnchorContext.Provider value={anchor}>
      <motion.section
        ref={sheetRef}
        role="dialog"
        aria-label={label}
        tabIndex={-1}
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
        className="fixed inset-x-0 bottom-(--mobile-dock) z-20 mx-auto w-full max-sm:flex max-sm:max-h-[calc(100dvh-var(--mobile-dock)-4rem-env(safe-area-inset-top,0px))] max-sm:flex-col max-sm:justify-end sm:inset-x-auto sm:bottom-4 sm:left-4 sm:max-w-sm"
      >
        <div ref={setAnchor} className="pointer-events-none relative shrink-0 sm:absolute sm:top-0 sm:right-0 sm:z-0" />
        <motion.div
          ref={card}
          style={{ height: cardHeight, flexShrink: wide || reduce ? undefined : 0 }}
          className="sheet-card relative z-1 flex max-h-[calc(90dvh-var(--mobile-dock))] min-h-0 w-full flex-col rounded-t-3xl border border-b-0 border-stone-200 bg-white shadow-[0_-8px_40px_-12px_rgb(0_0_0/0.25)] sm:max-h-[calc(100dvh-12rem)] sm:rounded-3xl sm:border-b"
        >
          <div
            ref={handle}
            className="flex shrink-0 cursor-grab touch-none justify-center pt-3 pb-1 active:cursor-grabbing"
            onPointerDown={(e) => dragControls.start(e)}
            aria-hidden
          >
            <div className="h-1.5 w-10 rounded-full bg-stone-300" />
          </div>
          <div data-sheet-scroll className="overflow-y-auto overscroll-contain px-4 max-sm:scroll-pt-20 sm:px-5">
            <div ref={content} className="relative pb-4 sm:pb-5">
              {children}
            </div>
          </div>
        </motion.div>
      </motion.section>
    </SheetAnchorContext.Provider>
  )
}

function SheetBody({
  graph,
  person,
  onChange,
  onClose,
  onSelectPerson,
  onBackPerson,
  perspectives,
  startWith,
  fanOpen,
  onFanFolded,
}: {
  graph: FamilyGraph
  person: Person
  onChange: (graph: FamilyGraph) => void
  onClose: () => void
  onSelectPerson: (id: PersonId) => void
  onBackPerson?: () => void
  perspectives?: Perspectives
  startWith?: Relation
  /** False while the discs fold back in, ahead of the card leaving. */
  fanOpen: boolean
  onFanFolded: () => void
}) {
  const { t } = useT()
  const reduce = useReducedMotion()
  const resetPaneScroll = useCallback((pane: HTMLDivElement | null) => {
    const scroller = pane?.closest<HTMLElement>('[data-sheet-scroll]')
    if (scroller) scroller.scrollTop = 0
  }, [])
  const filePicker = useBackupPicker((picked) => perspectives?.onOpenFile(person.id, picked))
  const [mode, setMode] = useState<Mode>(startWith ? { view: 'add', relation: startWith } : { view: 'details' })
  const [error, setError] = useState<string | null>(null)
  const go = useCallback((next: Mode) => {
    setMode(next)
    setError(null)
  }, [])

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
  const [confirmingTree, setConfirmingTree] = useState(false)
  const name = fullName(person)
  const years = lifeYears(person)
  /** The tree's own root, who is "you" here and can only go with the whole tree. */
  const isTreeRoot = isManager && perspectives !== undefined && !perspectives.isView
  const showsTree = perspectives && !person.isPlaceholder
  const ownTree = showsTree && !isTreeRoot ? perspectives.ownTree(person.id) : null
  /** Import is for someone else who has no file yet. The tree's own root already is the open file. */
  const canImportFile = Boolean(showsTree && !isManager && !ownTree)
  const treeTools: { viewAs: Tool; file: FileTool } | undefined = showsTree
    ? {
        viewAs: {
          available: !isManager,
          title: isManager ? t('view.isRoot', { name }) : t('view.as', { name }),
          onClick: () => perspectives.onViewAs(person.id),
        },
        file: {
          available: ownTree !== null || canImportFile,
          label: canImportFile ? t('sheet.importFile') : t('sheet.ownTree'),
          Icon: canImportFile ? FileUp : FileText,
          title: isTreeRoot
            ? t('view.isOwnTree', { name })
            : ownTree
              ? t('view.open', { name })
              : canImportFile
                ? t('view.linkFile', { name })
                : t('view.noTree', { name }),
          onClick: () => {
            if (ownTree) perspectives.onOpenOwnTree(person.id)
            else if (canImportFile) filePicker.open()
          },
        },
      }
    : undefined
  const removeTool: Tool | undefined = !isManager
    ? { available: true, title: t('sheet.removePerson'), onClick: () => go({ view: 'remove' }) }
    : isTreeRoot
      ? { available: true, title: t('sheet.deleteTree'), onClick: () => go({ view: 'remove' }) }
      : perspectives?.isView
        ? { available: false, title: t('view.onlyView'), onClick: () => {} }
        : undefined

  const anchor = useContext(SheetAnchorContext)
  const lineRef = useRef<HTMLElement | null>(null)
  const setLine = useCallback((node: HTMLElement | null) => {
    lineRef.current = node
  }, [])
  // The details header's relationship line, until it can be measured.
  const [lineY, setLineY] = useState(42)

  useLayoutEffect(() => {
    // Other sheets replace the relationship label. Keep the discs where they
    // were; measuring the label as it leaves throws the column off the card.
    if (mode.view !== 'details') return
    const el = lineRef.current
    if (!el || !anchor) return
    const measure = () => {
      if (!fanFits()) return
      const y = labelOffset(el.getBoundingClientRect(), anchor.getBoundingClientRect().top)
      if (y === null) return
      setLineY((current) => (Math.abs(current - y) < 0.5 ? current : y))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [anchor, mode.view, label])
  const menuActions = (() => {
    const list: NodeMenuAction[] = [
      {
        id: 'add',
        label: t('sheet.addRelative'),
        title: t('sheet.addRelative'),
        Icon: Plus,
        available: true,
        onClick: () => go({ view: 'relative' }),
      },
      {
        id: 'edit',
        label: t('sheet.edit'),
        title: t('sheet.edit'),
        Icon: Pencil,
        available: true,
        onClick: () => go({ view: 'edit' }),
      },
    ]
    if (treeTools) {
      list.push(
        {
          id: 'view',
          label: t('sheet.viewAs'),
          title: treeTools.viewAs.title,
          Icon: Eye,
          available: treeTools.viewAs.available,
          onClick: treeTools.viewAs.onClick,
        },
        {
          id: 'own',
          label: treeTools.file.label,
          title: treeTools.file.title,
          Icon: treeTools.file.Icon,
          available: treeTools.file.available,
          onClick: treeTools.file.onClick,
        },
      )
    }
    if (removeTool) {
      list.push({
        id: 'remove',
        label: isManager ? t('sheet.deleteTree') : t('sheet.removePerson'),
        title: removeTool.title,
        Icon: Trash,
        available: removeTool.available,
        tone: 'danger',
        onClick: removeTool.onClick,
      })
    }
    return list
  })()

  return (
    <>
      {filePicker.input}
      {anchor &&
        createPortal(
          <NodeFan open={fanOpen} actions={menuActions} lineY={lineY} onFolded={onFanFolded} />,
          anchor,
        )}
      <AnimatePresence mode="popLayout" initial={false} propagate>
      <motion.div
        ref={resetPaneScroll}
        key={mode.view === 'add' ? `add-${mode.relation}` : mode.view}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.09 } }}
        transition={{ duration: reduce ? 0 : 0.15 }}
      >
        {mode.view === 'details' && (
          <div className="flex flex-col gap-4 sm:gap-5">
            {anchor && createPortal(
              <AnimatePresence propagate>
                <MobilePersonActions key="mobile-actions" actions={menuActions} />
              </AnimatePresence>,
              anchor,
            )}
            <header className="flex items-center gap-3 pt-1 sm:gap-4">
              {onBackPerson && <button type="button" onClick={onBackPerson} className="grid size-10 shrink-0 place-items-center rounded-xl bg-stone-100 sm:hidden" aria-label={t('mobile.previousPerson')}><ArrowLeft className="size-4" aria-hidden /></button>}
              <PersonPortrait person={person} isManager={isManager} />
              <div className="min-w-0 flex-1">
                {label && (
                  <p ref={setLine} className="hidden text-xs font-semibold tracking-[0.12em] text-stone-400 uppercase sm:block">
                    {label}
                  </p>
                )}
                <h2
                  ref={label ? undefined : setLine}
                  className="flex items-center gap-2 font-serif text-2xl leading-tight text-stone-900"
                >
                  <span className="truncate">{fullName(person)}</span>
                  <span className="hidden sm:contents"><GenderIcon gender={person.gender} /></span>
                </h2>
                <p className="mt-1 text-sm text-stone-600 sm:hidden">{[label, years].filter(Boolean).join(' · ')}</p>
                <LifeLine person={person} detailed className="hidden! text-sm sm:flex!" />
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid size-11 shrink-0 place-items-center self-start rounded-xl bg-stone-100 text-stone-500 transition hover:bg-stone-200 hover:text-stone-900 sm:size-9 sm:rounded-full sm:bg-transparent"
                aria-label={t('common.close')}
              >
                <X className="size-5" />
              </button>
            </header>


            <CloseFamily graph={graph} personId={person.id} onSelect={onSelectPerson} />

            <div className="flex flex-col gap-5">
              <PartnerList
                graph={graph}
                personId={person.id}
                onEdit={(partnerId, partnership) => go({ view: 'partnership', partnerId, partnership })}
              />

              {filePicker.error && (
                <p role="alert" className="text-sm text-red-800">
                  {filePicker.error}
                </p>
              )}

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

              {person.notes && (
                <section aria-labelledby="notes-title" className="flex flex-col gap-2 border-t border-stone-100 pt-4">
                  <h3 id="notes-title" className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
                    {t('form.notes')}
                  </h3>
                  <p className="text-sm break-words whitespace-pre-line text-stone-700">{person.notes}</p>
                </section>
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
              autoFocus={fanFits()}
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

        {mode.view === 'remove' && isTreeRoot && (
          <SubView
            title={t('sheet.removeRootTitle', { tree: t('newTree.treeName', { name }) })}
            onBack={() => go({ view: 'details' })}
          >
            <p className="text-sm leading-relaxed text-stone-600">
              {t('sheet.removeRootBody', {
                name,
                tree: t('newTree.treeName', { name }),
                people: peopleCount(graph),
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go({ view: 'details' })}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  go({ view: 'details' })
                  perspectives.onDeleteTree()
                }}
              >
                {t('sheet.removeRootConfirm')}
              </Button>
            </div>
          </SubView>
        )}

        {mode.view === 'remove' && !isTreeRoot && (
          <SubView title={t('sheet.removeTitle', { name: displayName(person).given })} onBack={() => go({ view: 'details' })}>
            <p className="text-sm leading-relaxed text-stone-600">
              {t('sheet.removeBody', { name: fullName(person) })}
            </p>
            {ownTree && (
              <p className="mt-2 text-sm leading-relaxed font-medium text-red-800">
                {t('sheet.removeTreeToo', { tree: ownTree.name, people: ownTree.people })}
              </p>
            )}
            {error && <p className="mt-3 text-sm text-red-800">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => go({ view: 'details' })}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  ownTree ? setConfirmingTree(true) : apply(() => removePerson(graph, person.id), onClose)
                }
              >
                {t('common.remove')}
              </Button>
            </div>
            {ownTree && perspectives && (
              <ConfirmDialog
                open={confirmingTree}
                title={t('sheet.removeTreeTitle', { name: fullName(person) })}
                confirmLabel={t('sheet.removeTreeConfirm')}
                cancelLabel={t('newTree.finalCancel')}
                tone="danger"
                onConfirm={() => {
                  setConfirmingTree(false)
                  try {
                    perspectives.onRemoveWithTree(person.id, removePerson(graph, person.id))
                    onClose()
                  } catch (e) {
                    if (!(e instanceof GraphError)) throw e
                    setError(e.message)
                  }
                }}
                onCancel={() => setConfirmingTree(false)}
              >
                {t('sheet.removeTreeBody', { name: fullName(person), tree: ownTree.name, people: ownTree.people })}
              </ConfirmDialog>
            )}
          </SubView>
        )}
      </motion.div>
    </AnimatePresence>
    </>
  )
}

function CloseFamily({ graph, personId, onSelect }: {
  graph: FamilyGraph
  personId: PersonId
  onSelect: (id: PersonId) => void
}) {
  const { t } = useT()
  const ids = [...new Set([
    ...partnerIdsOf(graph, personId),
    ...childIdsOf(graph, personId),
    ...parentIdsOf(graph, personId),
    ...siblingsOf(graph, personId).map(({ id }) => id),
  ])].filter((id) => graph.people[id] && !graph.people[id].isPlaceholder)
  if (ids.length === 0) return null

  return (
    <section className="flex flex-col gap-2 border-t border-stone-200 pt-3 sm:hidden">
      <h3 className="text-sm font-semibold text-stone-700">{t('mobile.closeFamily')}</h3>
      <ul className="grid grid-cols-2 gap-2">
        {ids.map((id) => (
          <li key={id} className="min-w-0">
            <button type="button" onClick={() => onSelect(id)} className="flex min-h-12 w-full items-center gap-1.5 rounded-xl bg-stone-100 px-2.5 py-1 text-left focus-visible:outline-2 focus-visible:outline-(--accent)">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold">{fullName(graph.people[id])}</span>
                <span className="block truncate text-[11px] text-stone-600">{relationshipLabel(graph, id, personId)}</span>
              </span>
              <ChevronRight aria-hidden className="size-3.5 shrink-0 text-stone-500" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}


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
  const [actions, setActions] = useState<HTMLElement | null>(null)
  return (
    <div className="flex flex-col gap-4">
      {/* Stays at the top while the form scrolls, with the form's Cancel and Save. */}
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-stone-100 bg-white px-4 py-2 sm:-mx-5 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 grid size-11 shrink-0 place-items-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 sm:size-auto sm:p-2"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 font-serif text-xl leading-tight break-words text-stone-900">{title}</h2>
          {subtitle && <p className="truncate text-sm text-stone-500">{subtitle}</p>}
        </div>
        <div ref={setActions} className="flex shrink-0 items-center gap-1" />
      </header>
      <FormActionsSlot value={actions}>{children}</FormActionsSlot>
    </div>
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

  // A sibling takes this person's surnames. A child of a couple who are
  // married and still together takes the father's, from either parent.
  const childCoParentId = relation === 'child' && coParent !== NO_CO_PARENT ? coParent : null
  const surnames =
    relation === 'child'
      ? surnamesForChild(graph, person.id, childCoParentId)
      : relation === 'sibling'
        ? displayName(person).surnames
        : undefined
  const initial = emptyValues({
    names: [
      surnames?.length
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
      suggestedSurnames={relation === 'child' ? surnames ?? null : undefined}
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


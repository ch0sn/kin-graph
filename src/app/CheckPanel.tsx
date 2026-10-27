import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useT, type Language, type MessageKey, type Params } from '../i18n'
import {
  AFTER_FATHER_MONTHS,
  fullName,
  MAX_AGE,
  MAX_FATHER_AGE,
  MAX_MOTHER_AGE,
  MIN_PARENT_AGE,
  type FamilyGraph,
  type PersonId,
  type TreeIssue,
} from '../model'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Button } from '../ui/fields'

/** What an issue says, in the reader's language. */
function issueMessage(
  graph: FamilyGraph,
  issue: TreeIssue,
  t: (key: MessageKey, params?: Params) => string,
  language: Language,
): string {
  const names = issue.personIds.map((id) => (graph.people[id] ? fullName(graph.people[id]) : '?'))
  const [name, other = '', third = ''] = names
  const years = {
    tooOld: MAX_AGE,
    tooOldToBeLiving: MAX_AGE,
    parentTooYoung: MIN_PARENT_AGE,
    parentTooOld: graph.people[issue.personIds[1]]?.gender === 'female' ? MAX_MOTHER_AGE : MAX_FATHER_AGE,
  }[issue.kind as string]
  return t(`check.${issue.kind}`, {
    name,
    other,
    third,
    names: new Intl.ListFormat(language, { type: 'conjunction' }).format(names),
    ...(years !== undefined && { years }),
    months: AFTER_FATHER_MONTHS,
  })
}

/** The problems found in a tree, each leading to the person it's about. */
export function CheckPanel({
  open,
  graph,
  issues,
  ignored,
  onShow,
  onIgnore,
  onClose,
}: {
  open: boolean
  graph: FamilyGraph
  /** Every issue found, ignored ones included. */
  issues: TreeIssue[]
  ignored: ReadonlySet<string>
  onShow: (personId: PersonId) => void
  onIgnore: (issueId: string, ignored: boolean) => void
  onClose: () => void
}) {
  const { t, language } = useT()
  const [showIgnored, setShowIgnored] = useState(false)
  const active = issues.filter((issue) => !ignored.has(issue.id))
  const dismissed = issues.filter((issue) => ignored.has(issue.id))

  const row = (issue: TreeIssue, isIgnored: boolean) => {
    const Icon = issue.severity === 'error' ? CircleAlert : TriangleAlert
    return (
      <li key={issue.id} className="flex gap-3 rounded-xl px-2 py-2.5 hover:bg-stone-50">
        <Icon
          aria-hidden
          className={['mt-0.5 size-4 shrink-0', issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'].join(' ')}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-stone-500 uppercase">
            {t(issue.severity === 'error' ? 'check.error' : 'check.warning')}
          </p>
          <p className="text-stone-800">{issueMessage(graph, issue, t, language)}</p>
          <div className="mt-1.5 flex gap-1.5">
            <Button className="px-2.5 py-1" onClick={() => onShow(issue.personIds[0])}>
              {t('check.show')}
            </Button>
            <Button variant="ghost" className="px-2.5 py-1" onClick={() => onIgnore(issue.id, !isIgnored)}>
              {t(isIgnored ? 'check.unignore' : 'check.ignore')}
            </Button>
          </div>
        </div>
      </li>
    )
  }

  return (
    <ConfirmDialog open={open} title={t('check.title')} confirmLabel={t('common.done')} onConfirm={onClose} onCancel={onClose}>
      <div className="flex flex-col gap-3">
        <p>{active.length === 0 ? t('check.none') : t('check.intro')}</p>
        {active.length > 0 && <ul className="-mx-2 flex max-h-[45vh] flex-col overflow-y-auto">{active.map((i) => row(i, false))}</ul>}
        {dismissed.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={showIgnored}
              onClick={() => setShowIgnored(!showIgnored)}
              className="text-xs font-medium text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline"
            >
              {t('check.ignored', { count: dismissed.length })}
            </button>
            {showIgnored && (
              <ul className="-mx-2 mt-1 flex max-h-[30vh] flex-col overflow-y-auto opacity-75">
                {dismissed.map((i) => row(i, true))}
              </ul>
            )}
          </div>
        )}
      </div>
    </ConfirmDialog>
  )
}


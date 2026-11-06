/** The row of pips under a stepped flow. The current one widens. */
export function StepDots({ index, count, label }: { index: number; count: number; label: string }) {
  return (
    <div className="flex gap-2" aria-label={label} role="img">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={[
            'h-1.5 rounded-full transition-all duration-300',
            i === index ? 'w-6 bg-stone-900' : 'w-1.5 bg-stone-300',
          ].join(' ')}
        />
      ))}
    </div>
  )
}

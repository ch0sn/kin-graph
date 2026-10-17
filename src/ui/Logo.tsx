import logoUrl from '../../assets/branding/kin-graph-logo.svg'

/** The KinGraph mark. Decorative: the wordmark beside it already names the app. */
export function Logo({ className = 'size-8' }: { className?: string }) {
  return <img src={logoUrl} alt="" className={className} />
}

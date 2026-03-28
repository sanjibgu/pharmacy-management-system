import { Link, type LinkProps } from 'react-router-dom'

type Props = LinkProps & {
  variant?: 'primary' | 'secondary'
  className?: string
}

export default function LinkButton({
  variant = 'primary',
  className = '',
  ...props
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400'
  const styles =
    variant === 'primary'
      ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
      : 'bg-white/10 text-slate-100 hover:bg-white/15 ring-1 ring-inset ring-white/15'

  return <Link {...props} className={`${base} ${styles} ${className}`} />
}


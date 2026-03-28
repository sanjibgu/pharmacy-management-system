import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger'
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  className = '',
  ...props
}: Props) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400 disabled:opacity-60 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'bg-sky-500 text-slate-950 hover:bg-sky-400'
      : variant === 'danger'
        ? 'bg-rose-500 text-slate-950 hover:bg-rose-400'
        : 'bg-white/10 text-slate-100 hover:bg-white/15 ring-1 ring-inset ring-white/15'

  return <button {...props} className={`${base} ${styles} ${className}`} />
}

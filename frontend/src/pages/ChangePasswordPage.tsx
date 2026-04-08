import { useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import Button from '../components/Button'
import SiteHeader from '../components/SiteHeader'
import { useAuth } from '../context/AuthContext'
import { apiFetch } from '../services/api'
import { getTenantSlug } from '../services/tenant'

export default function ChangePasswordPage() {
  const { token, user } = useAuth()
  const { tenantSlug } = useParams()
  const isLocalhost = window.location.hostname === 'localhost'
  const effectiveSlug = tenantSlug || (isLocalhost ? getTenantSlug() : null)
  const base = effectiveSlug ? `/${effectiveSlug}` : ''

  const backTo = useMemo(() => {
    if (user?.role === 'SuperAdmin') return '/superadmin/pending'
    return `${base}/dashboard`
  }, [base, user?.role])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!token) return
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        token,
        body: { currentPassword, newPassword, confirmNewPassword },
        tenant: user?.role !== 'SuperAdmin',
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmNewPassword('')
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />
      <main className="py-4">
        <div className="mx-auto w-full max-w-xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold">Change Password</h1>
            <Link className="text-sm text-slate-300 hover:text-slate-100" to={backTo}>
              Back
            </Link>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm text-rose-200 ring-1 ring-inset ring-rose-400/20">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
              Password changed successfully.
            </div>
          ) : null}

          <form onSubmit={submit} className="mt-6 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
            <div className="grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-300">Current password</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-300">New password</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-slate-300">Confirm new password</span>
                <input
                  className="h-11 rounded-xl bg-slate-950/40 px-4 text-sm ring-1 ring-inset ring-white/10"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setCurrentPassword('')
                  setNewPassword('')
                  setConfirmNewPassword('')
                  setError(null)
                  setSuccess(false)
                }}
                disabled={saving}
              >
                Reset
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Update'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}


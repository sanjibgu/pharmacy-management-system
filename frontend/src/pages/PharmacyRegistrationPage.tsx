import type { FormEvent, InputHTMLAttributes, ReactNode } from 'react'
import { useState } from 'react'
import { apiFetch } from '../services/api'
import Container from '../components/Container'
import SiteFooter from '../components/SiteFooter'
import SiteHeader from '../components/SiteHeader'
import Button from '../components/Button'

type FormState = {
  pharmacyName: string
  ownerName: string
  email: string
  phone: string
  address: string
}

const initialState: FormState = {
  pharmacyName: '',
  ownerName: '',
  email: '',
  phone: '',
  address: '',
}

function Field({
  label,
  children,
  hint,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        {hint ? <span className="text-xs text-slate-500">{hint}</span> : null}
      </div>
      {children}
    </label>
  )
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        'h-11 w-full rounded-xl bg-slate-950/40 px-4 text-sm text-slate-100',
        'ring-1 ring-inset ring-white/10 placeholder:text-slate-600',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400',
      ].join(' ')}
    />
  )
}

export default function PharmacyRegistrationPage() {
  const [form, setForm] = useState<FormState>(initialState)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  function onChange<K extends keyof FormState>(key: K, value: FormState[K]) {
    setStatus('idle')
    setError(null)
    setForm((s) => ({ ...s, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setStatus('submitting')
    setError(null)

    try {
      await apiFetch<{ id: string; status: string; message: string }>(
        '/api/public/pharmacies/register',
        {
          method: 'POST',
          body: form,
          tenant: false,
        },
      )
      setStatus('success')
      setForm(initialState)
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <SiteHeader />

      <main className="py-12">
        <Container>
          <div className="grid gap-10 md:grid-cols-12 md:items-start">
            <div className="md:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300 ring-1 ring-inset ring-white/10">
                <span className="size-1.5 rounded-full bg-sky-400" />
                New pharmacy registration
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight">
                Register your pharmacy
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                Submit your pharmacy details. Your request is saved as{' '}
                <span className="font-medium text-slate-200">pending</span> until
                a Super Admin approves it.
              </p>

              <div className="mt-8 rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10">
                <div className="text-sm font-semibold">What you’ll need</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    Pharmacy name and owner name
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    Contact email and phone
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="size-1.5 rounded-full bg-sky-400" />
                    Business address and contact info
                  </li>
                </ul>
              </div>
            </div>

            <div className="md:col-span-7">
              <form
                onSubmit={onSubmit}
                className="rounded-3xl bg-white/5 p-6 ring-1 ring-inset ring-white/10 md:p-8"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <div className="text-sm font-semibold">Pharmacy details</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Status: <span className="text-slate-300">pending</span> →
                      approved / rejected by Super Admin.
                    </div>
                  </div>
                  {status === 'success' ? (
                    <div className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200 ring-1 ring-inset ring-emerald-400/20">
                      Submitted
                    </div>
                  ) : null}
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Field label="Pharmacy name">
                    <TextInput
                      value={form.pharmacyName}
                      onChange={(e) => onChange('pharmacyName', e.target.value)}
                      placeholder="ABC Pharmacy"
                      required
                    />
                  </Field>
                  <Field label="Owner name">
                    <TextInput
                      value={form.ownerName}
                      onChange={(e) => onChange('ownerName', e.target.value)}
                      placeholder="Owner full name"
                      required
                    />
                  </Field>
                  <Field label="Email">
                    <TextInput
                      value={form.email}
                      onChange={(e) => onChange('email', e.target.value)}
                      placeholder="name@pharmacy.com"
                      type="email"
                      required
                    />
                  </Field>
                  <Field label="Phone">
                    <TextInput
                      value={form.phone}
                      onChange={(e) => onChange('phone', e.target.value)}
                      placeholder="Phone"
                      inputMode="tel"
                      required
                    />
                  </Field>
                </div>

                <div className="mt-8">
                  <Field label="Address">
                    <TextInput
                      value={form.address}
                      onChange={(e) => onChange('address', e.target.value)}
                      placeholder="Full address"
                      required
                    />
                  </Field>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500">
                    {status === 'error' && error ? (
                      <span className="text-rose-300">{error}</span>
                    ) : (
                      'We will review and activate your tenant portal after approval.'
                    )}
                  </div>
                  <Button type="submit" disabled={status === 'submitting'}>
                    {status === 'submitting' ? 'Submitting…' : 'Submit registration'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </Container>
      </main>

      <SiteFooter />
    </div>
  )
}

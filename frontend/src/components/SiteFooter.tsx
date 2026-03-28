import Container from './Container'

export default function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <Container>
        <div className="grid gap-10 py-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="text-sm font-semibold">Pharmacy SAS Portal</div>
            <p className="mt-3 text-sm text-slate-400">
              A modern MERN starter frontend with an enterprise-style homepage.
              Hook it up to your Node/Express + MongoDB backend when you’re
              ready.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 md:col-span-7 md:grid-cols-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Product
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <a className="hover:text-slate-200" href="#platform">
                    Platform
                  </a>
                </li>
                <li>
                  <a className="hover:text-slate-200" href="#solutions">
                    Solutions
                  </a>
                </li>
                <li>
                  <a className="hover:text-slate-200" href="#insights">
                    Insights
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Company
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <a className="hover:text-slate-200" href="#about">
                    About
                  </a>
                </li>
                <li>
                  <a className="hover:text-slate-200" href="#contact">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                Legal
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-400">
                <li>
                  <a className="hover:text-slate-200" href="#">
                    Privacy
                  </a>
                </li>
                <li>
                  <a className="hover:text-slate-200" href="#">
                    Terms
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
          <div>© {new Date().getFullYear()} Pharmacy SAS Portal</div>
          <div>Built with React + Tailwind (MERN-ready)</div>
        </div>
      </Container>
    </footer>
  )
}


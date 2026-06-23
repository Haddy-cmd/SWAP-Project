import Link from 'next/link'
import { ChevronRight, MessageCircle, Check, MapPin, Mail, Clock } from 'lucide-react'
import { AskChatbotButton } from '@/components/chatbot/AskChatbotButton'

// Landing page for SWAP Portal
const STEPS = [
  { title: 'Submit Application', desc: 'Complete the application form and upload the required documents.' },
  { title: 'Review & Interview', desc: 'The SWAP office screens applications and schedules a qualifying interview.' },
  { title: 'Render Service', desc: 'Serve in your assigned office and track hours via QR and geofencing.' },
  { title: 'Receive Stipend', desc: 'The stipend is disbursed upon verification of rendered hours each semester.' },
]

const ELIGIBILITY = [
  'Regular MSU Marawi undergraduate student',
  'GWA of 2.25 or better, with no incomplete grades',
  'Family income below the poverty threshold',
  'Certificate of indigency and income documents',
  'Endorsement and good moral certification',
  'Re-application required every semester',
]

const GLANCE: [string, string][] = [
  ['Monthly Stipend', '₱1,000.00'],
  ['Required Service', '200 hours / semester'],
  ['Governing Office', 'Division of Students Affairs'],
]

const FAQS = [
  { q: 'Who is eligible for SWAP?', a: 'Regular MSU Marawi students with a GWA of 2.25 or better, no incomplete grades, and a monthly family income below the poverty threshold.' },
  { q: 'How many hours must I render per semester?', a: 'Recipients must complete 200 hours of service per semester across different university offices.' },
  { q: 'How is the stipend computed and released?', a: 'The stipend is based on verified service hours. The standard monthly allowance is ₱1,000 and is released upon verification of rendered hours.' },
  { q: 'Can I apply every semester?', a: 'Yes. You must re-apply every semester and meet the eligibility requirements each time.' },
]

function Seal({ size = 88 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 88 88" aria-hidden="true">
      <circle cx="44" cy="44" r="42" fill="#531010" />
      <circle cx="44" cy="44" r="42" fill="none" stroke="#D8B65A" strokeWidth="2.5" />
      <circle cx="44" cy="44" r="34" fill="none" stroke="#D8B65A" strokeOpacity="0.4" />
      <path d="M22 42 l22 -11 l22 11 l-22 11 z" fill="#D8B65A" />
      <path d="M44 53 v11 M56 47 v10" stroke="#D8B65A" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#2B2522]">
      {/* Utility bar */}
      <div className="bg-[#531010] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2 text-[11px] sm:px-6 sm:text-[11.5px]">
          <span className="text-white/85">Mindanao State University — Marawi City, Lanao del Sur</span>
          <span className="hidden text-[#D8B65A] sm:inline">Division of Students Affairs · dsa@msumain.edu.ph</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-[#E5DCD2] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Seal size={42} />
            <div className="min-w-0">
              <p className="font-serif text-[17px] font-bold leading-tight text-[#7D1A1A]">SWAP Portal</p>
              <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[#7A6E68]">Student Welfare Assistantship Program</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-3 sm:gap-5">
            <div className="hidden items-center gap-5 text-sm text-[#4A3F3A] md:flex">
              <a href="#about" className="hover:text-[#7D1A1A] transition-colors">About</a>
              <a href="#eligibility" className="hover:text-[#7D1A1A] transition-colors">Eligibility</a>
              <a href="#process" className="hover:text-[#7D1A1A] transition-colors">Process</a>
              <a href="#faq" className="hover:text-[#7D1A1A] transition-colors">FAQ</a>
            </div>
            <Link href="/login" className="hidden text-sm font-medium text-[#7D1A1A] hover:underline sm:inline">Sign In</Link>
            <Link href="/register" className="rounded-md bg-[#7D1A1A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5C1010] transition-colors">
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="px-4 py-14 text-center text-white sm:px-6 sm:py-20"
        style={{ background: 'linear-gradient(180deg, #7A1717 0%, #531010 100%)' }}
      >
        <div className="mx-auto max-w-4xl rounded-sm border border-[#D8B65A]/25 px-4 py-10 sm:px-8 sm:py-12">
          <div className="flex justify-center">
            <Seal size={88} />
          </div>
          <p className="mt-6 text-[11px] font-medium uppercase tracking-[0.22em] text-[#D8B65A] sm:text-xs sm:tracking-[0.28em]">
            Division of Students Affairs
          </p>
          <h1 className="mt-4 break-words font-serif text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            Student Welfare Assistantship Program
          </h1>
          <div className="mx-auto mt-5 h-px w-20 bg-[#D8B65A]" />
          <p className="mx-auto mt-6 max-w-2xl leading-relaxed text-white/80">
            An institutional financial-assistance program providing deserving students a monthly
            stipend of ₱1,000 in exchange for 200 hours of service per semester across different university offices.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-md bg-gradient-to-br from-[#D8B65A] to-[#B8901F] px-7 py-3.5 text-sm font-bold text-[#531010] shadow-md hover:brightness-105 transition"
            >
              Apply for Assistance
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-white/40 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="px-6 py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8901F]">About the Program</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#2B2522]">A mandate of student welfare</h2>
            <p className="mt-5 leading-relaxed text-[#6E5F5A]">
              The Student Welfare Assistantship Program (SWAP) is administered by the Division of Students
              Affairs to support academically deserving and financially challenged students. Beneficiaries
              render service across different university offices and receive a monthly stipend upon verification
              of their rendered hours.
            </p>
            <p className="mt-4 leading-relaxed text-[#6E5F5A]">
              The program upholds the University&apos;s commitment to accessible, quality education and to the
              holistic development of its students.
            </p>
          </div>
          <div className="rounded-xl border border-[#E5DCD2] bg-[#F7F3EC] p-7 shadow-sm">
            <h3 className="font-serif text-lg font-bold text-[#7D1A1A]">Program at a Glance</h3>
            <div className="mt-3 divide-y divide-[#ECE4D9] border-t border-[#E5DCD2]">
              {GLANCE.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between py-3.5 text-sm">
                  <span className="text-[#6E5F5A]">{label}</span>
                  <span className="font-semibold text-[#2B2522]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Eligibility */}
      <section id="eligibility" className="bg-[#F7F3EC] px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8901F]">Qualifications</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#2B2522]">Eligibility Requirements</h2>
          </div>
          <div className="mx-auto mt-10 grid max-w-3xl gap-x-12 gap-y-5 sm:grid-cols-2">
            {ELIGIBILITY.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#D8B65A] to-[#B8901F]">
                  <Check className="h-3.5 w-3.5 text-[#531010]" strokeWidth={3} />
                </span>
                <span className="text-[15px] text-[#3A322E]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#B8901F]">How to Proceed</p>
            <h2 className="mt-3 font-serif text-3xl font-bold text-[#2B2522]">Application Process</h2>
          </div>
          <div className="relative mt-14">
            {/* connector line (desktop) */}
            <div className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-[#E5DCD2] lg:block" />
            <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <div key={step.title} className="relative text-center">
                  <div className="relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#7D1A1A] font-serif text-lg font-bold text-white ring-2 ring-[#D8B65A]">
                    {i + 1}
                  </div>
                  <h3 className="mt-5 font-semibold text-[#2B2522]">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#6E5F5A]">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-[#F7F3EC] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center font-serif text-3xl font-bold text-[#2B2522]">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {FAQS.map((faq) => (
              <details key={faq.q} className="group rounded-lg border border-[#E5DCD2] bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-[#2B2522]">
                  {faq.q}
                  <span className="text-lg text-[#7A6E68] transition-transform group-open:rotate-45">+</span>
                </summary>
                <div className="border-t border-[#ECE4D9] px-5 py-4 text-sm leading-relaxed text-[#6E5F5A]">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <AskChatbotButton className="inline-flex items-center gap-2 text-sm font-medium text-[#7D1A1A] hover:text-[#5C1010] transition-colors">
              <MessageCircle className="h-4 w-4" />
              More questions? Ask our assistant
            </AskChatbotButton>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-[#7A1717] px-6 py-12 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          <div>
            <div className="flex items-center gap-2 text-[#D8B65A]">
              <MapPin className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Visit</span>
            </div>
            <p className="mt-2 text-sm text-white/90">Ground Floor, Domocao Alonto Hall, 1st Street, Mindanao State University, Marawi City, Philippines</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-[#D8B65A]">
              <Mail className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Contact</span>
            </div>
            <p className="mt-2 text-sm text-white/90">dsa@msumain.edu.ph · +63 919 246 2209</p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-[#D8B65A]">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.15em]">Office Hours</span>
            </div>
            <p className="mt-2 text-sm text-white/90">Mon – Fri 8:00 A.M. – 5:00 P.M.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#3E0C0C] px-6 py-8 text-center">
        <div className="flex justify-center">
          <Seal size={36} />
        </div>
        <p className="mt-3 font-serif text-sm font-semibold text-white">SWAP Portal — MSU Marawi</p>
        <p className="mt-1 text-xs text-white/55">
          © {new Date().getFullYear()} Mindanao State University — Marawi · In coordination with CHED
        </p>
      </footer>
    </div>
  )
}

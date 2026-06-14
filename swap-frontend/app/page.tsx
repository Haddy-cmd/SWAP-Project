import Link from 'next/link'
import { CheckCircle, Clock, FileText, BarChart2, ChevronRight, MessageCircle } from 'lucide-react'

const STEPS = [
  {
    icon: <FileText className="h-6 w-6 text-[#7D1A1A]" />,
    title: 'Submit Application',
    desc: 'Fill out the application form and upload required documents online.',
  },
  {
    icon: <Clock className="h-6 w-6 text-[#7D1A1A]" />,
    title: 'Review & Interview',
    desc: 'The SWAP office reviews your application and schedules an interview if qualified.',
  },
  {
    icon: <CheckCircle className="h-6 w-6 text-[#7D1A1A]" />,
    title: 'Serve & Track Hours',
    desc: 'Once approved, render service hours and track attendance via QR code.',
  },
  {
    icon: <BarChart2 className="h-6 w-6 text-[#7D1A1A]" />,
    title: 'Receive Stipend',
    desc: 'Stipend is released upon completion of verified service hours each semester.',
  },
]

const FAQS = [
  {
    q: 'Who is eligible for SWAP?',
    a: 'Regular MSU Marawi students with a GWA of 2.25 or better, no incomplete grades, and a monthly family income below the poverty threshold.',
  },
  {
    q: 'How many hours must I render per semester?',
    a: 'Recipients must complete the required service hours assigned to their office, typically 240 hours per semester.',
  },
  {
    q: 'How is the stipend computed?',
    a: 'Stipend is based on verified service hours. The standard monthly allowance is ₱1,500 subject to CHED guidelines.',
  },
  {
    q: 'Can I apply every semester?',
    a: 'Yes, but you must re-apply every semester and meet the eligibility requirements each time.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-[#EAD9D9] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-[3px] rounded-full bg-[#7D1A1A]" />
            <div>
              <p className="text-base font-bold text-[#7D1A1A]">SWAP Portal</p>
              <p className="text-xs text-[#8A6A6A]">MSU Marawi</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-[#7D1A1A] hover:bg-[#FEF0F0] transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-[#7D1A1A] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A52020] transition-colors"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="px-6 py-24 text-center text-white"
        style={{ background: 'linear-gradient(135deg, #8B1A1A 0%, #5C1010 60%, #7D1A1A 100%)' }}
      >
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-white/55">
            Mindanao State University — Marawi
          </p>
          <h1 className="text-4xl font-black leading-tight sm:text-5xl">
            Student Welfare Assistantship Program
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/75">
            A financial assistance program that helps deserving MSU Marawi students
            by providing a monthly stipend in exchange for rendering service hours
            in university offices.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-sm font-bold text-[#7D1A1A] shadow-lg hover:bg-[#FEF0F0] transition-colors"
            >
              Apply Now
              <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              href="/chatbot"
              className="flex items-center gap-2 rounded-xl border border-white/30 px-7 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              Ask the Chatbot
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#FAF7F7] py-12">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 sm:grid-cols-4">
          {[
            { label: 'Active Recipients', value: '500+' },
            { label: 'Partner Offices', value: '20+' },
            { label: 'Years of Service', value: '10+' },
            { label: 'Total Graduates', value: '2,000+' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black text-[#7D1A1A]">{s.value}</p>
              <p className="mt-1 text-sm text-[#8A6A6A]">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-3xl font-bold text-[#1E293B]">How It Works</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <div key={i} className="rounded-2xl border border-[#EAD9D9] bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FEF0F0]">
                  {step.icon}
                </div>
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-[#A52020]">
                  Step {i + 1}
                </div>
                <h3 className="mb-2 font-bold text-[#1E293B]">{step.title}</h3>
                <p className="text-sm leading-relaxed text-[#8A6A6A]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-[#FAF7F7] px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-10 text-center text-3xl font-bold text-[#1E293B]">
            Frequently Asked Questions
          </h2>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group rounded-xl border border-[#EAD9D9] bg-white shadow-sm"
              >
                <summary className="flex cursor-pointer items-center justify-between px-5 py-4 text-sm font-semibold text-[#1E293B] list-none">
                  {faq.q}
                  <ChevronRight className="h-4 w-4 text-[#8A6A6A] transition-transform group-open:rotate-90" />
                </summary>
                <div className="border-t border-[#EAD9D9] px-5 py-4 text-sm leading-relaxed text-[#8A6A6A]">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link
              href="/chatbot"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#7D1A1A] hover:text-[#A52020] transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              More questions? Ask our chatbot
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#EAD9D9] bg-white px-6 py-8">
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-semibold text-[#7D1A1A]">SWAP Portal</p>
          <p className="mt-1 text-xs text-[#B09A9A]">
            Mindanao State University — Marawi City, Lanao del Sur
          </p>
          <p className="mt-3 text-xs text-[#DCC5C5]">
            © {new Date().getFullYear()} MSU Marawi. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MessageCircle } from 'lucide-react'
import { AskChatbotButton } from '@/components/chatbot/AskChatbotButton'
import { Reveal } from '@/components/landing/Reveal'
import { HeroSlideshow, type HeroPhoto } from '@/components/landing/HeroSlideshow'
import { FaqAccordion } from '@/components/landing/FaqAccordion'

// Hero slideshow — files live in /public; captions describe what each photo shows.
const HERO_PHOTOS: HeroPhoto[] = [
  { src: '/campus.jpg', caption: 'DSA Mental Health Celebration, 2025' },
  { src: '/campus-2.jpg', caption: 'Office of Admissions, waiting area' },
  { src: '/campus-3.jpg', caption: 'Preparing event materials at the DSA office' },
  { src: '/campus-4.jpg', caption: 'Mental Health Celebration, on stage' },
  { src: '/campus-5.jpg', caption: 'Mental Health Celebration, awarding' },
]

const STATS: [string, string][] = [
  ['Monthly', 'allowance, released after hours are verified'],
  ['200 hours', 'of office service per semester'],
  ['500+', 'students supported to date'],
  ['Each semester', 'applications re-open'],
]

// Mirrors the DSA's SWAP application poster (BOR Res. No. 6, s. 1992).
const REQUIREMENTS = [
  { title: '3rd, 4th or 5th year college student', note: 'Freshmen and sophomores are still eligible to apply but are given the least priority.' },
  { title: 'At least 15 units this semester', note: 'Graduating students may carry fewer if it is their last load.' },
  { title: 'Qualified and financially in need', note: 'SWAP is for capable students who need financial support to stay in school.' },
  { title: 'Ready for work related to your field', note: 'Under BOR Res. No. 6, s. 1992, assistantships are academic, in instruction or research, and tied to your major.' },
]

const STEPS = [
  { title: 'Apply online', body: 'Fill out the form and upload your documents through this portal.' },
  { title: 'Screening & interview', body: 'The SWAP office reviews your file and schedules a short interview.' },
  { title: 'Serve in your office', body: 'Report to your assigned office. Clock in with QR; hours are geofenced.' },
  { title: 'Claim your stipend', body: 'Once your supervisor verifies your hours, claim at the Banking Office.' },
]

const FAQS = [
  { q: 'Who is eligible for SWAP?', a: '3rd, 4th and 5th year MSU Marawi students who are qualified and financially in need, carrying at least 15 units. Graduating students on their last load may carry fewer.' },
  { q: 'How many hours must I render per semester?', a: '200 hours, spread across the semester in your assigned office. Your supervisor verifies each logged session.' },
  { q: 'How is the allowance released?', a: 'Beneficiaries receive a monthly allowance once their rendered hours are verified. A claim stub is issued and collected at the Banking Office. Beneficiaries are assigned to an office or college and also receive free dormitory accommodation.' },
  { q: 'Can I apply every semester?', a: 'Yes. Applications re-open every semester.' },
]

/** Small roman-numeral section label in the brand red. */
function Eyebrow({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="mb-[22px] flex items-center gap-3 text-[13px] text-maroon-600">
      <span className="font-serif text-[15px] italic">{n}</span>
      {children}
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-50 text-ink-900">
      {/* ── Hero ── */}
      <section className="relative h-[100svh] max-h-[980px] min-h-[640px] overflow-hidden bg-brand-950">
        <HeroSlideshow photos={HERO_PHOTOS} intervalSec={6}>
          {/* Nav */}
          <div className="absolute inset-x-0 top-0 z-[3] flex items-center justify-between gap-6 px-5 py-5 sm:px-14 sm:py-[26px]">
            <a href="#" className="flex min-w-0 items-center gap-3 text-ink-25 [text-shadow:0_1px_8px_rgba(0,0,0,.45)]">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink-25/10">
                <Image src="/dsa-logo.png" alt="DSA seal" width={40} height={40} className="rounded-full" />
              </span>
              <span className="min-w-0 leading-[1.2]">
                <span className="block font-serif text-lg text-ink-25">SWAP</span>
                <span className="block truncate text-[11px] text-ink-25/60">MSU Marawi · Division of Students Affairs</span>
              </span>
            </a>
            <nav className="flex flex-none items-center gap-3 text-[13.5px]">
              {/* Frosted pill keeps the links readable over any photo. */}
              <div className="hidden items-center gap-[clamp(14px,2vw,26px)] rounded-full border border-ink-25/15 bg-brand-950/35 px-5 py-2 backdrop-blur-md md:flex">
                {[
                  ['#about', 'About'],
                  ['#eligibility', 'Eligibility'],
                  ['#process', 'Process'],
                  ['#faq', 'FAQ'],
                ].map(([href, label]) => (
                  <a
                    key={href}
                    href={href}
                    className="font-medium text-ink-25 transition-colors [text-shadow:0_1px_8px_rgba(0,0,0,.45)] hover:text-gold-400"
                  >
                    {label}
                  </a>
                ))}
              </div>
              <Link
                href="/login"
                className="whitespace-nowrap rounded-full bg-ink-25 px-[18px] py-[9px] font-semibold text-brand-800 shadow-[0_4px_14px_rgba(0,0,0,.25)] transition-colors hover:bg-white hover:text-brand-800"
              >
                Sign in
              </Link>
            </nav>
          </div>

          {/* Headline */}
          <div className="pointer-events-none absolute inset-x-5 bottom-[110px] z-[2] max-w-[720px] sm:inset-x-14 sm:bottom-[120px]">
            <div className="mb-[22px] flex items-center gap-3 text-[13px] text-gold-400 animate-fade-up">
              <span className="h-px w-7 bg-gold-400" />
              Student Welfare Assistantship Program
            </div>
            <h1
              className="mb-[26px] font-serif text-[clamp(46px,6.4vw,92px)] font-light leading-[.98] tracking-[-0.02em] text-ink-25 text-balance animate-fade-up"
              style={{ animationDelay: '80ms' }}
            >
              Serve the university.
              <br />
              <span className="italic text-gold-400">It serves you back.</span>
            </h1>
            <p
              className="mb-[34px] max-w-[48ch] text-base leading-[1.65] text-ink-25/80 text-pretty animate-fade-up"
              style={{ animationDelay: '160ms' }}
            >
              Complete a semester-long campus office placement to receive a monthly allowance — helping MSU Marawi students get the financial support they need to finish their degrees.
            </p>
            <div className="pointer-events-auto flex flex-wrap items-center gap-[22px] animate-fade-up" style={{ animationDelay: '240ms' }}>
              <Link
                href="/register"
                className="inline-flex h-[52px] flex-none items-center gap-2.5 whitespace-nowrap rounded-full bg-gold-400 px-[26px] text-[14.5px] font-bold text-brand-950 transition hover:brightness-105"
              >
                Apply this semester <ArrowRight className="h-[19px] w-[19px]" />
              </Link>
              <a
                href="#eligibility"
                className="border-b border-ink-25/45 pb-[3px] text-sm font-semibold text-ink-25 transition-colors hover:border-ink-25"
              >
                Check if you qualify
              </a>
            </div>
          </div>
        </HeroSlideshow>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-b border-ink-200 bg-ink-50">
        <div className="mx-auto grid max-w-[1240px] grid-cols-2 px-5 sm:px-14 lg:grid-cols-4">
          {STATS.map(([value, label], i) => (
            <div
              key={value}
              className={[
                'py-[30px]',
                i % 2 === 0 ? 'pr-5 max-lg:border-r max-lg:border-ink-200' : 'pl-5 lg:pl-0',
                i >= 2 ? 'max-lg:border-t max-lg:border-ink-200' : '',
                i < 3 ? 'lg:border-r lg:border-ink-200 lg:pr-7' : '',
                i > 0 ? 'lg:pl-7' : '',
              ].join(' ')}
            >
              <div className="font-serif text-[clamp(26px,3vw,34px)] text-brand-700">{value}</div>
              <div className="mt-1 text-[13px] text-ink-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── i. About ── */}
      <section
        id="about"
        className="mx-auto grid max-w-[1240px] items-start gap-8 px-5 py-20 sm:px-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-[72px] lg:pb-[110px] lg:pt-[120px]"
      >
        <Reveal>
          <Eyebrow n="i.">About the program</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <p className="mb-[34px] font-serif text-[clamp(28px,3vw,40px)] font-light leading-[1.25] text-ink-950 text-pretty">
            SWAP is how the Division of Students Affairs keeps capable students in the classroom —{' '}
            <span className="italic text-maroon-600">by paying them fairly for real work on campus.</span>
          </p>
          <div className="grid gap-7 text-[14.5px] leading-[1.75] text-ink-600 sm:grid-cols-2">
            <p className="text-pretty">
              Beneficiaries are placed in university offices and colleges, where they render
              service alongside staff. Hours are logged by QR and geofence, then verified by the office supervisor.
            </p>
            <p className="text-pretty">
              Once verified, the stipend is released as a claim stub and collected at the Banking Office.
              Beneficiaries also receive free dormitory accommodation. The program
              reflects the University&apos;s commitment to accessible education and the whole development of its students.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── ii. Eligibility ── */}
      <section id="eligibility" className="bg-ink-100">
        <div className="mx-auto grid max-w-[1240px] items-start gap-10 px-5 py-20 sm:px-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-[72px] lg:py-[110px]">
          <div className="lg:sticky lg:top-10">
            <Eyebrow n="ii.">Who can apply</Eyebrow>
            <h2 className="mb-5 font-serif text-[clamp(34px,3.6vw,50px)] font-normal leading-[1.05] tracking-[-0.01em] text-ink-950">
              Four things to check.
            </h2>
            <p className="max-w-[36ch] text-[14.5px] leading-[1.7] text-ink-600">
              If every line applies to you, you can apply this semester.
            </p>
          </div>
          <div>
            {REQUIREMENTS.map((r, i) => (
              <Reveal key={r.title} delay={i * 60}>
                <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-2.5 border-t border-ink-300 py-6">
                  <div className="font-serif text-[17px] tabular-nums text-maroon-600">{String(i + 1).padStart(2, '0')}</div>
                  <div>
                    <div className="mb-1 text-base font-semibold text-ink-950">{r.title}</div>
                    <div className="text-[13.5px] leading-[1.6] text-ink-500">{r.note}</div>
                  </div>
                </div>
              </Reveal>
            ))}
            <div className="border-t border-ink-300" />
          </div>
        </div>
      </section>

      {/* ── iii. Process ── */}
      <section id="process" className="mx-auto max-w-[1240px] px-5 py-20 sm:px-14 lg:py-[120px]">
        <div className="mb-[60px] flex flex-wrap items-end justify-between gap-10">
          <div>
            <Eyebrow n="iii.">How it works</Eyebrow>
            <h2 className="font-serif text-[clamp(34px,3.6vw,50px)] font-normal leading-[1.05] tracking-[-0.01em] text-ink-950">
              From application to first stipend.
            </h2>
          </div>
          <div className="max-w-[32ch] text-[13.5px] leading-[1.6] text-ink-500">
            Most applicants hear back within two weeks of the filing deadline.
          </div>
        </div>
        <div className="grid gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 90}>
              <div className="h-full border-l border-ink-200 pl-6 pr-7">
                <div className="mb-[26px] font-serif text-[72px] font-light leading-none text-maroon-300">{i + 1}</div>
                <div className="mb-2 text-base font-semibold text-ink-950">{s.title}</div>
                <div className="text-[13.5px] leading-[1.65] text-ink-500 text-pretty">{s.body}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── iv. FAQ ── */}
      <section id="faq" className="border-t border-ink-200">
        <div className="mx-auto grid max-w-[1240px] items-start gap-10 px-5 py-20 sm:px-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-[72px] lg:py-[110px]">
          <div>
            <Eyebrow n="iv.">Questions</Eyebrow>
            <h2 className="mb-5 font-serif text-[clamp(34px,3.6vw,50px)] font-normal leading-[1.05] text-ink-950">Asked often.</h2>
            <p className="text-[14.5px] leading-[1.7] text-ink-600">
              Still unsure? Visit the DSA office or write to{' '}
              <a href="mailto:dsa@msumain.edu.ph" className="border-b border-brand-200 text-brand-700 hover:text-brand-600">
                dsa@msumain.edu.ph
              </a>
              .
            </p>
            <AskChatbotButton className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-600">
              <MessageCircle className="h-[18px] w-[18px]" />
              Or ask our assistant
            </AskChatbotButton>
          </div>
          <FaqAccordion items={FAQS} />
        </div>
      </section>

      {/* ── Footer / closing CTA ── */}
      <div className="grid h-1.5 grid-cols-[6fr_1fr_2fr]">
        <div className="bg-brand-700" />
        <div className="bg-gold-400" />
        <div className="bg-maroon-600" />
      </div>
      <footer className="bg-brand-800 text-ink-25">
        <div className="mx-auto max-w-[1240px] px-5 pb-10 pt-[90px] sm:px-14">
          <div className="flex flex-wrap items-end justify-between gap-10 border-b border-ink-25/15 pb-[70px]">
            <h2 className="max-w-[14ch] font-serif text-[clamp(36px,4.4vw,64px)] font-light leading-[1.02] text-ink-25">
              Applications are open for <span className="italic text-gold-400">this semester.</span>
            </h2>
            <Link
              href="/register"
              className="inline-flex h-[54px] flex-none items-center gap-2.5 whitespace-nowrap rounded-full bg-gold-400 px-7 text-[14.5px] font-bold text-brand-950 transition hover:brightness-105"
            >
              Start your application <ArrowRight className="h-[19px] w-[19px]" />
            </Link>
          </div>
          <div className="grid gap-9 pb-14 pt-11 text-[13.5px] leading-[1.7] text-ink-25/80 sm:grid-cols-3">
            <div>
              <div className="mb-2 text-gold-400">Visit</div>
              Ground Floor, Domocao Alonto Hall, 1st Street, Mindanao State University, Marawi City
            </div>
            <div>
              <div className="mb-2 text-gold-400">Contact</div>
              dsa@msumain.edu.ph
              <br />
              +63 919 246 2209
            </div>
            <div>
              <div className="mb-2 text-gold-400">Office hours</div>
              Monday – Friday
              <br />
              8:00 A.M. – 5:00 P.M.
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-5 text-xs text-ink-25/50">
            <span>© {new Date().getFullYear()} Mindanao State University — Marawi</span>
            <span>Built by the College of Information and Computing Sciences</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

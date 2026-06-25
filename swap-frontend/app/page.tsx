import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, MessageCircle, Check, MapPin, Mail, Clock } from 'lucide-react'
import { AskChatbotButton } from '@/components/chatbot/AskChatbotButton'
import { Reveal } from '@/components/landing/Reveal'
import { HeroCarousel } from '@/components/landing/HeroCarousel'

// Hero slideshow images — drop these into /public. Missing files are skipped
// automatically, so add as many or as few as you like (extend this list).
const HERO_IMAGES = [
  '/campus.jpg',
  '/campus-2.jpg',
  '/campus-3.jpg',
  '/campus-4.jpg',
  '/campus-5.jpg',
  '/campus-6.jpg',
  '/campus-7.jpg',
  '/campus-8.jpg',
  '/campus-9.jpg',
  '/campus-10.jpg',
  '/campus-11.jpg',
  '/campus-12.jpg',
  '/campus-13.jpg',
  '/campus-14.jpg',
  '/campus-15.jpg',
  '/campus-16.jpg',
  '/campus-17.jpg'
];


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
  ['Eligibility Cycle', 'Every semester'],
]

const HERO_STATS: [string, string][] = [
  ['₱1,000', 'Monthly Stipend'],
  ['200 hrs', 'Per Semester'],
  ['500+', 'Recipients'],
]

const FAQS = [
  { q: 'Who is eligible for SWAP?', a: 'Regular MSU Marawi students with a GWA of 2.25 or better, no incomplete grades, and a monthly family income below the poverty threshold.' },
  { q: 'How many hours must I render per semester?', a: 'Recipients must complete 200 hours of service per semester across different university offices.' },
  { q: 'How is the stipend computed and released?', a: 'The stipend is based on verified service hours. The standard monthly allowance is ₱1,000 and is released upon verification of rendered hours.' },
  { q: 'Can I apply every semester?', a: 'Yes. You must re-apply every semester and meet the eligibility requirements each time.' },
]

/** DSA logo used in the nav and footer. */
function Logo({ size = 38 }: { size?: number }) {
  return <Image src="/dsa-logo.png" alt="DSA Logo" width={size} height={size} />
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FAF5EF] text-[#241715]">
      {/* Utility bar */}
      <div className="bg-[#651420] text-[#E7C9A0]">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-5 py-2.5 text-[11px] sm:px-8 sm:text-xs">
          <span>Mindanao State University — Marawi · Main Campus</span>
          <span className="hidden sm:inline">Division of Students Affairs · dsa@msumain.edu.ph</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-[#ECE1D6] bg-[#FAF5EF]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={38} />
            <div className="min-w-0">
              <p className="font-serif text-[17px] font-semibold leading-tight text-[#2B1E1B]">SWAP Portal</p>
              <p className="truncate text-[9px] font-semibold uppercase tracking-[0.15em] text-[#A38A82]">Student Welfare Assistantship Program</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-5 sm:gap-7">
            <div className="hidden items-center gap-7 text-sm font-medium text-[#5A4A45] md:flex">
              <a href="#about" className="transition-colors hover:text-[#7C1B26]">About</a>
              <a href="#eligibility" className="transition-colors hover:text-[#7C1B26]">Eligibility</a>
              <a href="#process" className="transition-colors hover:text-[#7C1B26]">Process</a>
              <a href="#faq" className="transition-colors hover:text-[#7C1B26]">FAQ</a>
            </div>
            <Link href="/login" className="hidden text-sm font-semibold text-[#7C1B26] hover:underline sm:inline">Sign In</Link>
            <Link
              href="/register"
              className="rounded-[10px] bg-gradient-to-b from-[#86202E] to-[#6C1620] px-5 py-2.5 text-sm font-semibold text-[#FFF8F2] shadow-[0_8px_18px_rgba(108,22,32,0.24)] transition hover:brightness-110"
            >
              Apply Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-20">
        <div>
          <Reveal delay={0}>
            <div className="mb-5 inline-flex items-center gap-2.5 text-[11.5px] font-bold uppercase tracking-[0.2em] text-[#A9823C]">
              <span className="h-[7px] w-[7px] rotate-45 rounded-[2px] bg-[#A9823C]" />
              Division of Students Affairs
            </div>
          </Reveal>
          <Reveal delay={60}>
            <h1 className="font-serif text-[clamp(40px,6vw,58px)] font-medium leading-[1.04] tracking-tight text-[#241715]">
              Student Welfare<br />Assistantship<br />Program
            </h1>
          </Reveal>
          <Reveal delay={120}>
            <p className="mt-6 max-w-[480px] text-[16.5px] leading-relaxed text-[#7A6A63]">
              An institutional financial-assistance program providing deserving students a monthly stipend of{' '}
              <strong className="font-semibold text-[#5A4A45]">₱1,000</strong> in exchange for 200 hours of service per
              semester across university offices.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-col items-start gap-3.5 sm:flex-row sm:items-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-[#86202E] to-[#6C1620] px-6 py-3.5 text-[15px] font-semibold text-[#FFF8F2] shadow-[0_14px_28px_rgba(108,22,32,0.26)] transition hover:-translate-y-0.5 hover:brightness-110"
              >
                Apply for Assistance <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center rounded-xl border border-[#E7D9C9] bg-white px-6 py-3.5 text-[15px] font-semibold text-[#7C1B26] transition-colors hover:bg-[#FBF7F2]"
              >
                Sign In
              </Link>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-9 flex gap-10 border-t border-[#ECE1D6] pt-7">
              {HERO_STATS.map(([value, label]) => (
                <div key={label}>
                  <div className="font-serif text-[28px] font-semibold leading-none text-[#7C1B26]">{value}</div>
                  <div className="mt-1.5 text-[11.5px] uppercase tracking-[0.08em] text-[#A38A82]">{label}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>

        {/* Hero slideshow — cycles the campus photos every 2.5s. */}
        <Reveal delay={120}>
          <div className="relative h-[440px] overflow-hidden rounded-[20px] shadow-[0_26px_60px_rgba(58,24,20,0.22)] sm:h-[520px]">
            <HeroCarousel images={HERO_IMAGES} interval={2300} />
            <div className="pointer-events-none absolute inset-0 rounded-[20px] shadow-[inset_0_0_0_1px_rgba(124,27,38,0.10)]" />
          </div>
        </Reveal>
      </section>

      {/* About */}
      <section id="about" className="border-y border-[#EFE5DA] bg-white">
        <div className="mx-auto grid max-w-[1200px] items-start gap-16 px-5 py-20 sm:px-8 lg:grid-cols-[1.1fr_.9fr]">
          <Reveal>
            <div className="mb-3.5 text-[11.5px] font-bold uppercase tracking-[0.2em] text-[#A9823C]">About the Program</div>
            <h2 className="font-serif text-[40px] font-medium leading-tight tracking-tight text-[#241715]">A mandate of student welfare</h2>
            <p className="mt-6 text-base leading-relaxed text-[#7A6A63]">
              The Student Welfare Assistantship Program (SWAP) is administered by the Division of Students Affairs to
              support academically deserving and financially challenged students. Beneficiaries render service across
              different university offices and receive a monthly stipend upon verification of their rendered hours.
            </p>
            <p className="mt-4 text-base leading-relaxed text-[#7A6A63]">
              The program upholds the University&apos;s commitment to accessible, quality education and to the holistic
              development of its students.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-[18px] border border-[#EEE2D5] bg-gradient-to-b from-[#FBF6EF] to-[#F6EDE2] p-8">
              <div className="mb-5 font-serif text-xl font-semibold text-[#7C1B26]">Program at a Glance</div>
              {GLANCE.map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-t border-[#ECE0D3] py-4 text-sm">
                  <span className="text-[#8A7A73]">{label}</span>
                  <span className="font-bold text-[#2B1E1B]">{value}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Eligibility */}
      <section id="eligibility" className="bg-[#F4ECE1]">
        <div className="mx-auto max-w-[1100px] px-5 py-20 text-center sm:px-8">
          <Reveal>
            <div className="mb-3.5 text-[11.5px] font-bold uppercase tracking-[0.2em] text-[#A9823C]">Qualifications</div>
            <h2 className="font-serif text-[40px] font-medium tracking-tight text-[#241715]">Eligibility Requirements</h2>
          </Reveal>
          <div className="mt-12 grid gap-4 text-left sm:grid-cols-2">
            {ELIGIBILITY.map((item, i) => (
              <Reveal key={item} delay={i * 70}>
                <div className="flex h-full items-center gap-4 rounded-[14px] border border-[#EBDED0] bg-white px-6 py-5 transition-shadow hover:shadow-md">
                  <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-gradient-to-br from-[#B89150] to-[#9A7330]">
                    <Check className="h-5 w-5 text-white" strokeWidth={3} />
                  </span>
                  <span className="text-[15px] leading-snug text-[#3F2F2A]">{item}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="process" className="bg-white">
        <div className="mx-auto max-w-[1140px] px-5 py-[88px] text-center sm:px-8">
          <Reveal>
            <div className="mb-3.5 text-[11.5px] font-bold uppercase tracking-[0.2em] text-[#A9823C]">How to Proceed</div>
            <h2 className="font-serif text-[40px] font-medium tracking-tight text-[#241715]">Application Process</h2>
          </Reveal>
          <div className="relative mt-14">
            <div className="absolute left-[13%] right-[13%] top-[29px] hidden h-0.5 bg-gradient-to-r from-[#E3CFC0] via-[#D9B98E] to-[#E3CFC0] lg:block" />
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step, i) => (
                <Reveal key={step.title} delay={i * 100} className="group relative">
                  <div className="relative z-10 mx-auto flex h-[58px] w-[58px] items-center justify-center rounded-full bg-gradient-to-br from-[#8A2230] to-[#651420] font-serif text-[22px] font-semibold text-[#F3D9A0] shadow-[0_10px_22px_rgba(108,22,32,0.28)] transition-transform duration-300 group-hover:scale-110">
                    {i + 1}
                  </div>
                  <h3 className="mt-6 font-bold text-[#2B1E1B]">{step.title}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-[#8A7A73]">{step.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-[#F4ECE1]">
        <div className="mx-auto max-w-[820px] px-5 py-[88px] text-center sm:px-8">
          <Reveal>
            <h2 className="mb-11 font-serif text-[40px] font-medium tracking-tight text-[#241715]">Frequently Asked Questions</h2>
          </Reveal>
          <div className="space-y-3.5 text-left">
            {FAQS.map((faq, i) => (
              <Reveal key={faq.q} delay={i * 70}>
                <details className="group overflow-hidden rounded-[14px] border border-[#EBDED0] bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[15.5px] font-semibold text-[#2B1E1B]">
                    {faq.q}
                    <span className="flex-none text-2xl font-light leading-none text-[#7C1B26] transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-6 pb-6 text-[14.5px] leading-relaxed text-[#7A6A63]">{faq.a}</div>
                </details>
              </Reveal>
            ))}
          </div>
          <div className="mt-8">
            <AskChatbotButton className="inline-flex items-center gap-2 text-sm font-semibold text-[#7C1B26] transition-colors hover:text-[#A52020]">
              <MessageCircle className="h-[18px] w-[18px]" />
              More questions? Ask our assistant
            </AskChatbotButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-b from-[#7C1B26] to-[#5C1118] text-[#F3E6D6]">
        <div className="mx-auto max-w-[1200px] px-5 pb-7 pt-16 sm:px-8">
          <div className="grid gap-12 border-b border-[#F3D9A0]/20 pb-12 sm:grid-cols-3">
            <Reveal>
              <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#E9C77F]">
                <MapPin className="h-[18px] w-[18px]" /> Visit
              </div>
              <p className="text-sm leading-relaxed text-[#F3E6D6]/80">
                Ground Floor, Domocao Alonto Hall, 1st Street, Mindanao State University, Marawi City, Philippines
              </p>
            </Reveal>
            <Reveal delay={100}>
              <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#E9C77F]">
                <Mail className="h-[18px] w-[18px]" /> Contact
              </div>
              <p className="mb-1.5 text-sm text-[#F3E6D6]/80">dsa@msumain.edu.ph</p>
              <p className="text-sm text-[#F3E6D6]/80">+63 919 246 2209</p>
            </Reveal>
            <Reveal delay={200}>
              <div className="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#E9C77F]">
                <Clock className="h-[18px] w-[18px]" /> Office Hours
              </div>
              <p className="text-sm text-[#F3E6D6]/80">Monday – Friday<br />8:00 A.M. – 5:00 P.M.</p>
            </Reveal>
          </div>
          <div className="flex flex-col items-center gap-3 pt-9">
            <Logo size={34} />
            <p className="text-xs text-[#F3E6D6]/60">
              © {new Date().getFullYear()} Mindanao State University — Marawi · In coordination with CHED
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

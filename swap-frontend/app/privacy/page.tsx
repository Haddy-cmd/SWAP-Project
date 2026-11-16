import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'

export const metadata: Metadata = { title: 'Privacy Notice · SWAP Portal' }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="font-serif text-lg font-semibold text-ink-950">{title}</h2>
      <div className="mt-2 space-y-2 text-[14.5px] leading-relaxed text-ink-700">{children}</div>
    </section>
  )
}

/**
 * Public (outside the middleware matcher): linked from registration, the staff invitation
 * page and sign-in, so it can be read before an account exists.
 */
export default function PrivacyPage() {
  return (
    <div className="min-h-app bg-ink-50 px-4 py-10 sm:py-14">
      <div className="fixed right-4 top-4 z-40 print:hidden"><ThemeToggle /></div>
      <article className="mx-auto max-w-2xl rounded-2xl border border-ink-200 bg-surface px-5 py-8 shadow-sm sm:px-9">
        <Link href="/" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 hover:text-brand-600">
          <ArrowLeft className="h-4 w-4" /> SWAP Portal
        </Link>
        <div className="mt-5 flex items-center gap-3">
          <Image src="/dsa-logo.png" alt="DSA Logo" width={44} height={44} />
          <h1 className="font-serif text-2xl font-semibold text-ink-950">Privacy Notice</h1>
        </div>

        <p className="mt-6 text-[14.5px] leading-relaxed text-ink-700">
          This notice explains what personal information the SWAP Portal collects, why, who can see it, and your
          rights under the Data Privacy Act of 2012 (Republic Act No. 10173). You are asked to agree to it when you
          create your account.
        </p>

        <Section title="Who we are">
          <p>
            The SWAP Portal is run by the Division of Student Affairs (DSA), Mindanao State University – Main Campus,
            Marawi City, for the Student Welfare Assistantship Program (SWAP).
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-1.5 pl-5">
            <li><b>Account and profile:</b> name, student ID or employee ID, email, college, program, year level and contact number.</li>
            <li><b>Application documents</b> you upload, such as your certificate of registration, grades, income certificate and ID photo.</li>
            <li>
              <b>Attendance:</b> the office QR code you scan, your GPS location when you clock in and out and while you
              are clocked in with the Attendance page open, and a clock-in selfie when your office requires one.
            </li>
            <li><b>Your work:</b> task descriptions, end-of-term reports and promissory notes.</li>
            <li><b>Signatures and stipend records:</b> your saved signature and the stubs and receipts it signs.</li>
            <li><b>Sign-in details:</b> the device, browser and IP address used to sign in, to protect your account.</li>
          </ul>
          <p>Your location is not tracked at any other time.</p>
        </Section>

        <Section title="Why we collect it">
          <p>
            To process applications and interviews, assign recipients to offices, record and verify service hours,
            release stipends, and send you notices and announcements about the program.
          </p>
        </Section>

        <Section title="Who can see it">
          <p>
            Only you, the office supervisor assigned to you, and DSA administrators. Other students cannot see your
            information or open your files.
          </p>
          <p>
            The portal runs on service providers that store or process data for it: Vercel (website), Render (server
            and database), Cloudflare R2 (file storage), Brevo (email) and Google Gemini (answers to chatbot
            questions — only the text of the question is sent).
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            For as long as you take part in the program, and afterwards as long as university records rules require.
          </p>
          <p className="mt-2">
            If your application is not approved, the files you uploaded with it (such as your COR and grades) are deleted
            when the next semester starts, or five months after the decision, whichever comes first. We keep only the
            record that you applied and the decision.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            Under RA 10173 you have the right to be informed, to access your data, to have it corrected, to object, to
            have it erased or blocked, to data portability, and to file a complaint with the National Privacy
            Commission.
          </p>
        </Section>

        <Section title="Contact us">
          <p>
            For questions or requests about your data, contact the Division of Student Affairs at{' '}
            <a href="mailto:dsa@msumain.edu.ph" className="font-semibold text-brand-700 hover:text-brand-600">dsa@msumain.edu.ph</a>.
          </p>
        </Section>
      </article>
    </div>
  )
}

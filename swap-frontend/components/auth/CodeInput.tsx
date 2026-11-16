'use client'

/**
 * The emailed 6-digit code. One field (not six boxes) so phones can autofill it
 * (autocomplete="one-time-code") and pasting "123 456" just works; digits only.
 */
export function CodeInput({ value, onChange, autoFocus = true, disabled, invalid }: {
  value: string
  onChange: (v: string) => void
  autoFocus?: boolean
  disabled?: boolean
  invalid?: boolean
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      inputMode="numeric"
      data-keep-size
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      autoFocus={autoFocus}
      disabled={disabled}
      aria-label="6-digit code"
      aria-invalid={invalid || undefined}
      placeholder="••••••"
      className={`h-14 w-full rounded-xl border bg-surface text-center font-mono text-[26px] font-bold tracking-[0.5em] text-ink-950 placeholder-ink-300 shadow-[0_1px_2px_rgba(19,36,26,0.04)] focus:outline-none disabled:opacity-60 ${
        invalid ? 'border-danger-400 focus:border-danger-600' : 'border-ink-200 focus:border-brand-700'}`}
    />
  )
}

/** "Send a new code" with a countdown (the API allows one a minute). */
export function ResendButton({ onResend, pending, seconds }: { onResend: () => void; pending: boolean; seconds: number }) {
  return (
    <button type="button" onClick={onResend} disabled={pending || seconds > 0}
      className="text-[13px] font-semibold text-brand-700 hover:text-brand-600 disabled:cursor-not-allowed disabled:text-ink-400">
      {pending ? 'Sending…' : seconds > 0 ? `Send a new code in ${seconds}s` : 'Send a new code'}
    </button>
  )
}

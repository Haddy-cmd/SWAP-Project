import { z } from 'zod'

// Mirrors the backend rule (App\Support\PasswordPolicy: Password::min(8)->mixedCase()->numbers()),
// with the same messages, so a weak password is caught on the form, not after submitting.
export const PASSWORD_MESSAGES = {
  min: 'Password must be at least 8 characters.',
  mixed: 'Password must have at least one uppercase and one lowercase letter.',
  numbers: 'Password must have at least one number.',
}

// Unicode classes like Laravel's (\p{Lu}, \p{Ll}, \p{N}); built at runtime because the
// ES2017 compile target doesn't accept \p{…} in regex literals.
const UPPER = new RegExp('\\p{Lu}', 'u')
const LOWER = new RegExp('\\p{Ll}', 'u')
const NUMBER = new RegExp('\\p{N}', 'u')

/** The requirements, in the order the checklist shows them. */
export const PASSWORD_CHECKS: { label: string; test: (p: string) => boolean }[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'An uppercase letter (A–Z)', test: (p) => UPPER.test(p) },
  { label: 'A lowercase letter (a–z)', test: (p) => LOWER.test(p) },
  { label: 'A number (0–9)', test: (p) => NUMBER.test(p) },
]

/** A new password: 8+ characters with upper- and lowercase letters and a number. */
export const strongPassword = z
  .string()
  .min(8, PASSWORD_MESSAGES.min)
  .refine((p) => UPPER.test(p) && LOWER.test(p), PASSWORD_MESSAGES.mixed)
  .refine((p) => NUMBER.test(p), PASSWORD_MESSAGES.numbers)

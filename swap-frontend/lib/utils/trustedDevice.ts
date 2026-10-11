// "Trust this browser for 30 days": the token the API gave after a sign-in code, sent with the next
// sign-in so it can skip the code. Storage can be unavailable (private window): then a code is asked.
const KEY = 'swap-device'

export function getDeviceToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setDeviceToken(token: string | null | undefined): void {
  try {
    if (token) localStorage.setItem(KEY, token)
  } catch {
    // ignore: the next sign-in simply asks for a code again
  }
}

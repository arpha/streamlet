/**
 * Normalizes email addresses to prevent multi-account creation via aliases.
 * - For Gmail: removes dots and anything after '+' sign.
 * - For Outlook/Hotmail/Live: removes anything after '+' sign.
 */
export function normalizeEmail(email: string): string {
  const parts = email.trim().toLowerCase().split("@")
  if (parts.length !== 2) return email.trim().toLowerCase()

  let [local, domain] = parts

  // Gmail & Googlemail normalization
  if (domain === "gmail.com" || domain === "googlemail.com") {
    // Remove dots
    local = local.replace(/\./g, "")
    // Remove everything after '+'
    const plusIdx = local.indexOf("+")
    if (plusIdx !== -1) {
      local = local.substring(0, plusIdx)
    }
    return `${local}@gmail.com`
  }

  // Outlook, Hotmail, Live normalization
  if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com") {
    // Remove everything after '+'
    const plusIdx = local.indexOf("+")
    if (plusIdx !== -1) {
      local = local.substring(0, plusIdx)
    }
    return `${local}@${domain}`
  }

  return `${local}@${domain}`
}

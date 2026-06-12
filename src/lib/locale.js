export const LS_LOCALE = 'skywindow:locale'

/** Top Android smart-telescope markets + English default. */
export const SUPPORTED_LOCALES = [
  { code: 'en', labelKey: 'language.en', native: 'English' },
  { code: 'de', labelKey: 'language.de', native: 'Deutsch' },
  { code: 'fr', labelKey: 'language.fr', native: 'Français' },
  { code: 'es', labelKey: 'language.es', native: 'Español' },
  { code: 'ja', labelKey: 'language.ja', native: '日本語' },
]

const SUPPORTED_CODES = new Set(SUPPORTED_LOCALES.map((l) => l.code))

/** Map browser language to a supported locale code. */
export function resolveLocale(raw) {
  const tag = String(raw || '').trim().toLowerCase()
  if (!tag) return 'en'
  if (SUPPORTED_CODES.has(tag)) return tag
  const base = tag.split('-')[0]
  if (SUPPORTED_CODES.has(base)) return base
  return 'en'
}

export function readStoredLocale() {
  try {
    return localStorage.getItem(LS_LOCALE)
  } catch {
    return null
  }
}

export function storeLocale(code) {
  try {
    localStorage.setItem(LS_LOCALE, code)
  } catch {
    /* ignore */
  }
}

export function detectInitialLocale() {
  const stored = readStoredLocale()
  if (stored && SUPPORTED_CODES.has(stored)) return stored
  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language]
    for (const lang of langs) {
      const resolved = resolveLocale(lang)
      if (resolved !== 'en' || String(lang).toLowerCase().startsWith('en')) return resolved
    }
  }
  return 'en'
}

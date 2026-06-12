import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { detectInitialLocale, storeLocale } from './lib/locale.js'
import en from './locales/en.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import es from './locales/es.json'
import ja from './locales/ja.json'

const initialLng = detectInitialLocale()

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    de: { translation: de },
    fr: { translation: fr },
    es: { translation: es },
    ja: { translation: ja },
  },
  lng: initialLng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

document.documentElement.lang = initialLng

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  storeLocale(lng)
})

export default i18n

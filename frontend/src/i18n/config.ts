import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import ar from './ar.json'

let initialLang = 'en'
if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
  try {
    const saved = localStorage.getItem('nxtpak-store')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (parsed.state?.language) {
        initialLang = parsed.state.language
      }
    }
  } catch {
    // fallback
  }
}

if (typeof document !== 'undefined') {
  document.documentElement.dir = initialLang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = initialLang
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n

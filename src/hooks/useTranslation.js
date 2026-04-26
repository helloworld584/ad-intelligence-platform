import { useLanguage } from '../contexts/LanguageContext'
import ko from '../i18n/ko'
import en from '../i18n/en'

const translations = { ko, en }

export const useTranslation = () => {
  const { lang } = useLanguage()

  const t = (key) => {
    const keys = key.split('.')
    let value = translations[lang]
    
    for (const k of keys) {
      if (value && value[k] !== undefined) {
        value = value[k]
      } else {
        return key
      }
    }
    
    return value
  }

  return { t, lang }
}

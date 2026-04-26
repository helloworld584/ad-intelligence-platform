import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('lang') || 'ko'
  })

  useEffect(() => {
    localStorage.setItem('lang', lang)
    
    // Apply font based on language
    if (lang === 'ko') {
      document.body.style.fontFamily = "'Noto Sans KR', sans-serif"
    } else {
      document.body.style.fontFamily = "'Inter', sans-serif"
    }
  }, [lang])

  const changeLanguage = (newLang) => {
    setLang(newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

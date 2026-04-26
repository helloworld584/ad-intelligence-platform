import { Link } from 'react-router-dom'
import { useTranslation } from '../hooks/useTranslation'
import { useFadeIn } from '../hooks/useFadeIn'
import { useState, useEffect, useRef } from 'react'

function Landing() {
  const { t } = useTranslation()
  const heroRef = useFadeIn()
  const featuresRef = useFadeIn()
  const statsRef = useFadeIn()
  const ctaRef = useFadeIn()

  const [count1, setCount1] = useState(0)
  const [count2, setCount2] = useState(0)
  const [count3, setCount3] = useState(0)
  const statsVisibleRef = useRef(false)

  const animateCount = (target, setter) => {
    let current = 0
    const duration = 1500
    const step = target / (duration / 16)
    
    const timer = setInterval(() => {
      current += step
      if (current >= target) {
        setter(target)
        clearInterval(timer)
      } else {
        setter(Math.floor(current))
      }
    }, 16)
  }

  useEffect(() => {
    if (statsRef.isVisible && !statsVisibleRef.current) {
      statsVisibleRef.current = true
      animateCount(10, setCount1)
      animateCount(3, setCount2)
      animateCount(180, setCount3)
    }
  }, [statsRef.isVisible])

  return (
    <div className="min-h-screen bg-[#0a0d14]">
      {/* Hero Section */}
      <div className="min-h-screen flex items-center relative overflow-hidden">
        {/* Background orb */}
        <div className="absolute top-0 right-0 w-[700px] h-[700px] bg-purple-600/10 rounded-full blur-3xl pointer-events-none -z-0" />
        
        <div className="max-w-7xl mx-auto px-8 w-full">
          <div className="grid grid-cols-2 gap-20 items-center">
            {/* Left side */}
            <div className={`${heroRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out`}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 border border-gray-700 rounded-full text-sm text-gray-400">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                {t('landing.badge')}
              </div>
              
              <h1 className="mt-8 text-6xl font-bold text-white leading-tight">
                {t('landing.title1')}
              </h1>
              <h1 className="text-6xl font-bold leading-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {t('landing.title2')}
              </h1>
              
              <p className="mt-6 text-lg text-gray-400 leading-relaxed max-w-lg">
                {t('landing.subtitle')}
              </p>
              
              <Link
                to="/benchmarks"
                className="mt-10 inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3.5 rounded-xl font-semibold hover:opacity-90 transition-all duration-200"
              >
                {t('landing.cta')}
              </Link>
            </div>
            
            {/* Right side - Dashboard mockup */}
            <div className="animate-float">
              <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-500 text-sm ml-2">Ad Intelligence</span>
                </div>
                
                <div className="border-t border-[#1f2937]" />
                
                <div className="divide-y divide-[#1f2937]">
                  <div className="py-4 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest">CTR</div>
                      <div className="text-2xl font-bold text-white mt-1">2.5%</div>
                    </div>
                    <div className="text-gray-600 text-xs">{t('landing.card_avg')}</div>
                  </div>
                  <div className="py-4 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest">CPC</div>
                      <div className="text-2xl font-bold text-white mt-1">$2.0</div>
                    </div>
                    <div className="text-gray-600 text-xs">{t('landing.card_avg')}</div>
                  </div>
                  <div className="py-4 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-widest">ROAS</div>
                      <div className="text-2xl font-bold text-white mt-1">3.0x</div>
                    </div>
                    <div className="text-gray-600 text-xs">{t('landing.card_avg')}</div>
                  </div>
                </div>
                
                <div className="text-gray-600 text-xs mt-2 text-right">
                  {t('landing.card_footer')}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-24">
        <div ref={featuresRef.ref} className={`${featuresRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out`}>
          <h2 className="text-center text-3xl font-bold text-white mb-16">{t('landing.feat_title')}</h2>
          <div className="grid grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-8 hover:border-blue-600/50 transition-colors duration-300">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-blue-900/50">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{t('landing.feat1_title')}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{t('landing.feat1_desc')}</p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-8 hover:border-blue-600/50 transition-colors duration-300">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-purple-900/50">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{t('landing.feat2_title')}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{t('landing.feat2_desc')}</p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-[#111827] border border-[#1f2937] rounded-2xl p-8 hover:border-blue-600/50 transition-colors duration-300">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-indigo-900/50">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-white mb-3">{t('landing.feat3_title')}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{t('landing.feat3_desc')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div ref={statsRef.ref} className="py-20 bg-[#111827]/50 border-y border-[#1f2937]">
        <div className="max-w-7xl mx-auto px-8">
          <div className={`grid grid-cols-3 divide-x divide-[#1f2937] ${statsRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out`}>
            <div className="text-center py-4">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {count1}
              </div>
              <div className="text-gray-400 text-base mt-3">{t('landing.stat1_label')}</div>
            </div>
            <div className="text-center py-4">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {count2}
              </div>
              <div className="text-gray-400 text-base mt-3">{t('landing.stat2_label')}</div>
            </div>
            <div className="text-center py-4">
              <div className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                {count3}
              </div>
              <div className="text-gray-400 text-base mt-3">{t('landing.stat3_label')}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Section */}
      <div ref={ctaRef.ref} className="py-28 text-center">
        <div className={`${ctaRef.isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} transition-all duration-700 ease-out`}>
          <h2 className="text-4xl font-bold text-white mb-4">{t('landing.cta2_title')}</h2>
          <p className="text-gray-400 text-lg mb-10">{t('landing.cta2_sub')}</p>
          <Link
            to="/benchmarks"
            className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            {t('landing.cta')}
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing

import { useState, useRef } from 'react'
import { supabase } from '../utils/supabase'
import ErrorState from '../components/ErrorState'
import { useTranslation } from '../hooks/useTranslation'

const PLATFORMS = ['Meta', 'Google Search', 'Google Display']
const platformMap = {
  'Meta': 'meta',
  'Google Search': 'google_search',
  'Google Display': 'google_display'
}

function Creative() {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    image: null,
    adText: '',
    platform: '',
    industry: ''
  })
  const [dragActive, setDragActive] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFile = (file) => {
    if (file.type.startsWith('image/')) {
      setFormData({ ...formData, image: file })
    }
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const analyze = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${import.meta.env.VITE_API_URL}/analyze-creative`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          copy_text: formData.adText,
          platform: platformMap[formData.platform],
          industry: formData.industry,
          has_image: !!formData.image
        })
      })
      
      if (response.status === 401) {
        throw new Error(t('common.login_required'))
      }
      if (response.status === 429) {
        throw new Error(t('common.daily_limit'))
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data = await response.json()
      setResult(data)
      setAnalyzed(true)
    } catch (err) {
      setError(err.message || t('page.analyze.error'))
    } finally {
      setLoading(false)
    }
  }

  const getScoreColor = (score) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 60) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('page.creative.title')}</h1>
      <p className="text-gray-400 mb-6">
        {t('page.creative.subtitle')}
      </p>

      {/* Error Banner */}
      {error && (
        <ErrorState message={error} onRetry={analyze} />
      )}

      {/* Upload Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">{t('page.creative.title')}</h2>
        
        {/* Image Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">{t('page.creative.image_note')}</label>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-blue-500 bg-gray-700' : 'border-gray-600 hover:border-gray-500'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => e.target.files && handleFile(e.target.files[0])}
              className="hidden"
            />
            {formData.image ? (
              <div>
                <p className="text-green-400 mb-2">{formData.image.name}</p>
                <img
                  src={URL.createObjectURL(formData.image)}
                  alt="Preview"
                  className="max-h-40 mx-auto rounded"
                />
              </div>
            ) : (
              <div>
                <p className="text-gray-400 mb-2">{t('page.creative.upload_image')}</p>
                <p className="text-sm text-gray-500">{t('page.creative.image_formats')}</p>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">{t('page.creative.image_note')}</p>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('page.creative.industry')}</label>
            <input
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder={t('page.creative.industry_example')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">{t('page.creative.platform')}</label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="">{t('page.creative.platform')}</option>
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">{t('page.creative.ad_text')}</label>
          <textarea
            name="adText"
            value={formData.adText}
            onChange={handleChange}
            rows={4}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            placeholder={t('page.creative.ad_text')}
          />
        </div>

        <button
          onClick={analyze}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold px-6 py-2 rounded"
        >
          {loading ? t('page.creative.loading') : t('page.creative.submit')}
        </button>
      </div>

      {/* Analysis Results */}
      {analyzed && result && (
        <>
          {/* Overall Score Gauge */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.creative.score')}</h2>
            <div className="flex items-center gap-8">
              <div className="flex-1">
                <div className="h-8 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getScoreColor(result.overall_score)} transition-all`}
                    style={{ width: `${result.overall_score}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-sm text-gray-400">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold">{result.overall_score}</p>
                <p className={`text-sm ${result.overall_score >= 80 ? 'text-green-400' : result.overall_score >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {result.overall_score >= 80 ? t('page.creative.score_excellent') : result.overall_score >= 60 ? t('page.creative.score_good') : t('page.creative.score_poor')}
                </p>
              </div>
            </div>
          </div>

          {/* Item Scores */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.creative.item_scores')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {result.item_scores.map((item, index) => (
                <div key={index} className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{item.name}</h3>
                  <p className={`text-2xl font-bold mb-1 ${getScoreColor(item.score).replace('bg-', 'text-')}`}>
                    {item.score}
                  </p>
                  <p className="text-sm text-gray-400">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.creative.strengths')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {result.strengths.map((strength, index) => (
                <div key={index} className="bg-green-900 border border-green-700 rounded-lg p-4">
                  <p className="text-green-100">{strength}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Improvements */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">{t('page.creative.suggestions')}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {result.improvements.map((improvement, index) => (
                <div key={index} className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
                  <p className="text-yellow-100">{improvement}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Creative

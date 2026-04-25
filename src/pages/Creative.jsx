import { useState } from 'react'
import { supabase } from '../utils/supabase'
import ErrorState from '../components/ErrorState'

const PLATFORMS = ['Meta', 'Google Search', 'Google Display']
const platformMap = {
  'Meta': 'meta',
  'Google Search': 'google_search',
  'Google Display': 'google_display'
}

function Creative() {
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
        throw new Error('로그인이 필요합니다.')
      }
      if (response.status === 429) {
        throw new Error('일일 AI 분석 한도(5회)를 초과했습니다. 내일 다시 시도해주세요.')
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data = await response.json()
      setResult(data)
      setAnalyzed(true)
    } catch (err) {
      setError(err.message || '분석에 실패했습니다. 다시 시도해주세요.')
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
      <h1 className="text-3xl font-bold mb-2">Creative</h1>
      <p className="text-gray-400 mb-6">
        광고 카피의 품질을 AI가 분석합니다. 참고용 지표이며 실제 CTR과의 상관관계는 검증 중입니다.
      </p>

      {/* Error Banner */}
      {error && (
        <ErrorState message={error} onRetry={analyze} />
      )}

      {/* Upload Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">소재 업로드</h2>
        
        {/* Image Upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">이미지</label>
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
                <p className="text-gray-400 mb-2">이미지를 드래그하거나 클릭하여 업로드</p>
                <p className="text-sm text-gray-500">PNG, JPG, GIF 지원</p>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">이미지는 현재 텍스트 분석을 보조하는 용도입니다</p>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">업종</label>
            <input
              type="text"
              name="industry"
              value={formData.industry}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="예: 이커머스, SaaS/테크"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">플랫폼</label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="">플랫폼 선택</option>
              {PLATFORMS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">광고 텍스트</label>
          <textarea
            name="adText"
            value={formData.adText}
            onChange={handleChange}
            rows={4}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            placeholder="광고 텍스트 입력"
          />
        </div>

        <button
          onClick={analyze}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-semibold px-6 py-2 rounded"
        >
          {loading ? 'AI 분석 중...' : '분석하기'}
        </button>
      </div>

      {/* Analysis Results */}
      {analyzed && result && (
        <>
          {/* Overall Score Gauge */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">카피 품질 점수</h2>
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
                  {result.overall_score >= 80 ? '우수' : result.overall_score >= 60 ? '보통' : '개선 필요'}
                </p>
              </div>
            </div>
          </div>

          {/* Item Scores */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">항목별 점수</h2>
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
            <h2 className="text-xl font-bold mb-4">강점 분석</h2>
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
            <h2 className="text-xl font-bold mb-4">개선 제안</h2>
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

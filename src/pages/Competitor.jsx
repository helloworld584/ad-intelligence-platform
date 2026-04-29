import { useState } from 'react'
import { supabase } from '../utils/supabase'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter } from 'recharts'
import ErrorState from '../components/ErrorState'
import { useTranslation } from '../hooks/useTranslation'

const CTA_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

function Competitor() {
  const { t } = useTranslation()
  const [brandName, setBrandName] = useState('')
  const [inputMode, setInputMode] = useState('bulk') // 'bulk' or 'single'
  const [bulkText, setBulkText] = useState('')
  const [singleText, setSingleText] = useState('')
  const [textList, setTextList] = useState([])
  const [myCopies, setMyCopies] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [semanticGapLoading, setSemanticGapLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [semanticGapResult, setSemanticGapResult] = useState(null)
  const [error, setError] = useState(null)

  const handleBulkTextChange = (e) => {
    const text = e.target.value
    setBulkText(text)
    const lines = text.split('\n').filter(line => line.trim())
    setTextList(lines)
  }

  const handleAddSingleText = () => {
    if (singleText.trim()) {
      setTextList([...textList, singleText.trim()])
      setSingleText('')
    }
  }

  const handleRemoveText = (index) => {
    setTextList(textList.filter((_, i) => i !== index))
  }

  const handleAnalyze = async () => {
    if (textList.length < 10) {
      setError(t('page.competitor.count_min'))
      return
    }

    setAnalyzing(true)
    setSemanticGapLoading(true)
    setError(null)
    setResults(null)
    setSemanticGapResult(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/analyze-competitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          texts: textList,
          brand_name: brandName || undefined
        })
      })

      if (response.status === 401) {
        throw new Error(t('common.login_required'))
      }
      if (response.status === 429) {
        throw new Error(t('common.daily_limit'))
      }
      if (!response.ok) {
        throw new Error(t('common.analysis_failed'))
      }

      const data = await response.json()
      console.log('API Response:', data)
      setResults(data)

      // Call semantic gap API if my_copies is provided
      if (myCopies.trim()) {
        const myCopiesArray = myCopies.split('\n').filter(line => line.trim())
        if (myCopiesArray.length > 0) {
          try {
            const semanticResponse = await fetch(`${apiUrl}/analyze-semantic-gap`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                my_copies: myCopiesArray,
                competitor_copies: textList
              })
            })
            if (semanticResponse.ok) {
              const semanticData = await semanticResponse.json()
              setSemanticGapResult(semanticData)
            }
          } catch (err) {
            console.error('Semantic gap analysis error:', err)
            // Silent failure - don't show error to user
          }
        }
      }
    } catch (err) {
      setError(err.message || t('page.competitor.analyze_error'))
    } finally {
      setAnalyzing(false)
      setSemanticGapLoading(false)
    }
  }

  const getCTAChartData = () => {
    if (!results?.cta_distribution) return []
    return Object.entries(results.cta_distribution).map(([name, value]) => ({
      name,
      value
    }))
  }

  const getLengthChartData = () => {
    if (!results?.linguistic_features?.length_distribution) return []
    return [
      { name: t('page.competitor.length_short'), value: results.linguistic_features.length_distribution.short || 0 },
      { name: t('page.competitor.length_medium'), value: results.linguistic_features.length_distribution.medium || 0 },
      { name: t('page.competitor.length_long'), value: results.linguistic_features.length_distribution.long || 0 }
    ]
  }

  const getKeywordChartData = () => {
    if (!results?.top_keywords) return []
    return results.top_keywords
      .slice(0, 10)
      .map(({ word, count }) => ({ name: word, value: count }))
  }

  const cleanMarkdown = (text) => {
    if (!text) return ''
    return text
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/>\s/g, '')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('page.competitor.title')}</h1>
      <p className="text-sm text-gray-400 mb-6">{t('page.competitor.subtitle')}</p>

      {/* Input Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">광고 텍스트 (빈 줄로 구분)</h2>
        
        {/* Brand Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">{t('page.competitor.brand')}</label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder={t('page.competitor.brand')}
            className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* My Ad Copies (Optional) */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">내 광고 카피 (선택)</label>
          <textarea
            value={myCopies}
            onChange={(e) => setMyCopies(e.target.value)}
            rows={4}
            placeholder="내 광고 카피를 입력하면 경쟁사와의 의미론적 차이를 분석합니다"
            className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Input Mode Tabs */}
        <div className="mb-4">
          <div className="flex space-x-2 mb-4">
            <button
              onClick={() => setInputMode('bulk')}
              className={`px-4 py-2 rounded font-medium ${
                inputMode === 'bulk'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('page.competitor.tab_direct')}
            </button>
            <button
              onClick={() => setInputMode('single')}
              className={`px-4 py-2 rounded font-medium ${
                inputMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {t('page.competitor.tab_add')}
            </button>
          </div>

          {inputMode === 'bulk' ? (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                광고 텍스트 (빈 줄로 구분)
              </label>
              <textarea
                value={bulkText}
                onChange={handleBulkTextChange}
                rows={10}
                placeholder="광고 텍스트를 입력하세요 (빈 줄로 구분)"
                className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                광고 텍스트 (빈 줄로 구분)
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={singleText}
                  onChange={(e) => setSingleText(e.target.value)}
                  placeholder="광고 텍스트를 입력하세요"
                  className="flex-1 bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSingleText()}
                />
                <button
                  onClick={handleAddSingleText}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                >
                  {t('page.competitor.tab_add')}
                </button>
              </div>
              
              {/* Text List */}
              {textList.length > 0 && (
                <div className="bg-gray-700 rounded p-4 max-h-60 overflow-y-auto">
                  <div className="space-y-2">
                    {textList.map((text, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-gray-600 rounded px-3 py-2"
                      >
                        <span className="text-sm text-gray-300 truncate flex-1">{text}</span>
                        <button
                          onClick={() => handleRemoveText(index)}
                          className="ml-2 text-red-400 hover:text-red-300"
                        >
                          {t('page.competitor.delete')}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Count and Analyze Button */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {textList.length}{t('page.competitor.count_ok')}
            {textList.length < 10 && (
              <span className="text-red-400 ml-2">{t('page.competitor.count_min')}</span>
            )}
          </p>
          <button
            onClick={handleAnalyze}
            disabled={textList.length < 10 || analyzing}
            className={`px-6 py-2 rounded font-medium ${
              textList.length < 10 || analyzing
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {analyzing ? t('page.analyze.loading') : t('page.competitor.submit')}
          </button>
        </div>
      </div>

      {error && (
        <ErrorState message={error} onRetry={handleAnalyze} />
      )}

      {/* Analysis Results */}
      {results && (
        <>
          {/* CTA Distribution */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.competitor.cta_dist')}</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getCTAChartData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getCTAChartData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CTA_COLORS[index % CTA_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  itemStyle={{ color: '#F3F4F6' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Language Characteristics */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.competitor.lang_feat')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {results.linguistic_features && (
                <>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-2">{t('page.competitor.question_ratio')}</h3>
                    <p className="text-2xl font-bold text-blue-400">
                      {((results.linguistic_features.has_question_ratio || 0) * 100).toFixed(1)}%
                    </p>
                    <div className="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${(results.linguistic_features.has_question_ratio || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-2">{t('page.competitor.number_ratio')}</h3>
                    <p className="text-2xl font-bold text-green-400">
                      {((results.linguistic_features.has_number_ratio || 0) * 100).toFixed(1)}%
                    </p>
                    <div className="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${(results.linguistic_features.has_number_ratio || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-2">{t('page.competitor.urgency_ratio')}</h3>
                    <p className="text-2xl font-bold text-yellow-400">
                      {((results.linguistic_features.has_urgency_ratio || 0) * 100).toFixed(1)}%
                    </p>
                    <div className="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-500"
                        style={{ width: `${(results.linguistic_features.has_urgency_ratio || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-2">{t('page.competitor.emoji_ratio')}</h3>
                    <p className="text-2xl font-bold text-purple-400">
                      {((results.linguistic_features.has_emoji_ratio || 0) * 100).toFixed(1)}%
                    </p>
                    <div className="mt-2 h-2 bg-gray-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${(results.linguistic_features.has_emoji_ratio || 0) * 100}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Text Length Distribution */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.competitor.length_dist')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getLengthChartData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="name" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  itemStyle={{ color: '#F3F4F6' }}
                />
                <Bar dataKey="value" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Keyword Frequency */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.competitor.keywords')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getKeywordChartData()} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis type="number" stroke="#9CA3AF" />
                <YAxis dataKey="name" type="category" width={100} stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  itemStyle={{ color: '#F3F4F6' }}
                />
                <Bar dataKey="value" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* AI Insights */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">{t('page.competitor.insight')}</h2>
            {analyzing ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <div className="bg-gray-700 rounded-lg p-4">
                <p className="text-gray-300 whitespace-pre-wrap">
                  {cleanMarkdown(results.interpretation) || '인사이트가 없습니다.'}
                </p>
              </div>
            )}
          </div>

          {/* Semantic Gap Analysis */}
          {semanticGapResult && (
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-1">의미론적 광고 갭 분석</h2>
              <p className="text-sm text-gray-400 mb-4">내 광고와 경쟁사 광고의 메시지 포지셔닝 비교</p>

              {semanticGapLoading ? (
                <div className="flex items-center gap-3 py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                  <span className="text-gray-300">의미론적 분석 중...</span>
                </div>
              ) : (
                <>
                  {/* Similarity Metrics Cards */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-sm text-gray-400 mb-2">평균 유사도</h3>
                      <p className={`text-2xl font-bold ${
                        semanticGapResult.avg_similarity >= 0.7
                          ? 'text-red-400'
                          : semanticGapResult.avg_similarity >= 0.4
                          ? 'text-yellow-400'
                          : 'text-green-400'
                      }`}>
                        {(semanticGapResult.avg_similarity * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {semanticGapResult.avg_similarity >= 0.7
                          ? '경쟁사와 유사'
                          : semanticGapResult.avg_similarity >= 0.4
                          ? '부분 차별화'
                          : '차별화됨'}
                      </p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-sm text-gray-400 mb-2">내 광고 다양성</h3>
                      <p className="text-2xl font-bold text-blue-400">
                        {(semanticGapResult.my_diversity * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">높을수록 다양한 메시지</p>
                    </div>
                    <div className="bg-gray-700 rounded-lg p-4">
                      <h3 className="text-sm text-gray-400 mb-2">경쟁사 다양성</h3>
                      <p className="text-2xl font-bold text-purple-400">
                        {(semanticGapResult.competitor_diversity * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">경쟁사 메시지 다양성</p>
                    </div>
                  </div>

                  {/* Most Similar Competitor Copies */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-200">내 광고와 가장 유사한 경쟁사 카피</h3>
                    <div className="space-y-2">
                      {semanticGapResult.most_similar_competitors.map((item, idx) => (
                        <div key={idx} className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-blue-900 border border-blue-700 text-blue-300 px-2 py-0.5 rounded text-xs font-medium">
                              {(item.similarity * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">{item.copy}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Gap Copies */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3 text-gray-200">경쟁사가 쓰고 있지만 내가 놓친 메시지</h3>
                    <p className="text-xs text-gray-500 mb-3">유사도가 낮은 경쟁사 카피 → 차별화 기회 또는 진입 고려</p>
                    <div className="space-y-2">
                      {semanticGapResult.gap_copies.map((item, idx) => (
                        <div key={idx} className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-green-900 border border-green-700 text-green-300 px-2 py-0.5 rounded text-xs font-medium">
                              {(item.similarity * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-sm text-gray-300">{item.copy}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insight */}
                  <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4 mb-6">
                    <p className="text-gray-300">{semanticGapResult.insight}</p>
                  </div>

                  {/* Positioning Map */}
                  {semanticGapResult.positioning_map && semanticGapResult.positioning_map.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-200">Ad Positioning Map</h3>
                      <ResponsiveContainer width="100%" height={350}>
                        <ScatterChart>
                          <XAxis hide />
                          <YAxis hide />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                            itemStyle={{ color: '#E5E7EB' }}
                            cursor={{ strokeDasharray: '3 3' }}
                            formatter={(value, name, props) => {
                              if (name === 'text') {
                                const text = props.payload.text || ''
                                return [text.length > 50 ? text.substring(0, 50) + '...' : text, '']
                              }
                              return [value, name]
                            }}
                          />
                          <Scatter
                            data={semanticGapResult.positioning_map.filter(p => p.is_mine)}
                            fill="#3B82F6"
                            shape="circle"
                            r={50}
                          />
                          <Scatter
                            data={semanticGapResult.positioning_map.filter(p => !p.is_mine)}
                            fill="#6B7280"
                            shape="circle"
                            r={30}
                          />
                        </ScatterChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center gap-6 mt-4 text-sm text-gray-400">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          <span>내 광고</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                          <span>경쟁사 광고</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Meta Ad Library Integration (Coming Soon) */}
      <div className="bg-gray-800 rounded-lg p-6 mt-8 opacity-60">
        <h2 className="text-xl font-bold mb-2">{t('page.competitor.meta_title')}</h2>
        <p className="text-sm text-gray-400">{t('page.competitor.meta_sub')}</p>
      </div>
    </div>
  )
}

export default Competitor

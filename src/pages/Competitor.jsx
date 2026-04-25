import { useState } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const CTA_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

function Competitor() {
  const [brandName, setBrandName] = useState('')
  const [inputMode, setInputMode] = useState('bulk') // 'bulk' or 'single'
  const [bulkText, setBulkText] = useState('')
  const [singleText, setSingleText] = useState('')
  const [textList, setTextList] = useState([])
  const [analyzing, setAnalyzing] = useState(false)
  const [results, setResults] = useState(null)
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
      setError('최소 10건 이상 입력해주세요.')
      return
    }

    setAnalyzing(true)
    setError(null)
    setResults(null)

    try {
      const apiUrl = import.meta.env.VITE_API_URL
      const response = await fetch(`${apiUrl}/analyze-competitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texts: textList,
          brand_name: brandName || undefined
        })
      })

      if (!response.ok) {
        throw new Error('분석 요청 실패')
      }

      const data = await response.json()
      console.log('API Response:', data)
      setResults(data)
    } catch (err) {
      setError(err.message || '분석 중 오류가 발생했습니다.')
    } finally {
      setAnalyzing(false)
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
      { name: 'Short (≤30자)', value: results.linguistic_features.length_distribution.short || 0 },
      { name: 'Medium (31~80자)', value: results.linguistic_features.length_distribution.medium || 0 },
      { name: 'Long (>80자)', value: results.linguistic_features.length_distribution.long || 0 }
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
      <h1 className="text-3xl font-bold mb-2">Competitor</h1>
      <p className="text-sm text-gray-400 mb-6">경쟁사 광고 텍스트 패턴 분석 도구</p>

      {/* Input Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">광고 텍스트 입력</h2>
        
        {/* Brand Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-1">브랜드명 (선택)</label>
          <input
            type="text"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="브랜드명 입력"
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
              직접 입력
            </button>
            <button
              onClick={() => setInputMode('single')}
              className={`px-4 py-2 rounded font-medium ${
                inputMode === 'single'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              한 건씩 추가
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
                placeholder="광고 텍스트를 입력하세요. 각 광고는 빈 줄로 구분됩니다."
                className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                광고 텍스트
              </label>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={singleText}
                  onChange={(e) => setSingleText(e.target.value)}
                  placeholder="광고 텍스트 입력"
                  className="flex-1 bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddSingleText()}
                />
                <button
                  onClick={handleAddSingleText}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
                >
                  추가
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
                          삭제
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
            {textList.length}건 입력됨
            {textList.length < 10 && (
              <span className="text-red-400 ml-2">(최소 10건 이상 필요)</span>
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
            {analyzing ? '분석 중...' : '분석하기'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-8">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Analysis Results */}
      {results && (
        <>
          {/* CTA Distribution */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">CTA 분포</h2>
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
            <h2 className="text-xl font-bold mb-4">언어 특성</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {results.linguistic_features && (
                <>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <h3 className="text-sm text-gray-400 mb-2">질문형 비율</h3>
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
                    <h3 className="text-sm text-gray-400 mb-2">수치 포함 비율</h3>
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
                    <h3 className="text-sm text-gray-400 mb-2">긴급성 키워드 비율</h3>
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
                    <h3 className="text-sm text-gray-400 mb-2">이모지 포함 비율</h3>
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
            <h2 className="text-xl font-bold mb-4">텍스트 길이 분포</h2>
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
            <h2 className="text-xl font-bold mb-4">키워드 빈도 (상위 10개)</h2>
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
            <h2 className="text-xl font-bold mb-4">AI 인사이트</h2>
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
        </>
      )}

      {/* Meta Ad Library Integration (Coming Soon) */}
      <div className="bg-gray-800 rounded-lg p-6 mt-8 opacity-60">
        <h2 className="text-xl font-bold mb-2">Meta Ad Library 연동</h2>
        <p className="text-sm text-gray-400">준비 중입니다. 현재는 토큰 만료로 인해 비활성화되어 있습니다.</p>
      </div>
    </div>
  )
}

export default Competitor

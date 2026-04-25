import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { toDbPlatform } from '../lib/mappings'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

const PLATFORMS = [
  { value: 'google_search', label: 'Google Search' },
  { value: 'google_display', label: 'Google Display' },
  { value: 'meta', label: 'Meta' }
]
const METRICS = ['CTR', 'CPC', 'CPM', 'ROAS', 'CVR', 'CPA']
const METRIC_NAMES = {
  CTR: 'CTR',
  CPC: 'CPC',
  CPM: 'CPM',
  ROAS: 'ROAS',
  CVR: 'CVR',
  CPA: 'CPA'
}

function Benchmarks() {
  const [benchmarks, setBenchmarks] = useState([])
  const [industries, setIndustries] = useState([])
  const [selectedIndustry, setSelectedIndustry] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState('google_search')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [userMetrics, setUserMetrics] = useState({
    CTR: '',
    CPC: '',
    CPM: '',
    ROAS: '',
    CVR: '',
    CPA: ''
  })
  const [selectedMetricForChart, setSelectedMetricForChart] = useState('CTR')
  const [config, setConfig] = useState({
    topPercentileThreshold: 0.25
  })

  useEffect(() => {
    fetchBenchmarks()
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('v_config')
        .select('key, value')

      if (error) throw error
      
      const configMap = {}
      data.forEach(item => {
        configMap[item.key] = item.value
      })
      
      setConfig({
        topPercentileThreshold: configMap['top_percentile_threshold'] || 0.25
      })
    } catch (error) {
      console.error('Error fetching config:', error)
    }
  }

  const fetchBenchmarks = async () => {
    try {
      const { data, error } = await supabase
        .from('v_benchmarks')
        .select('*')

      if (error) throw error

      console.log('Fetched data:', data)
      console.log('Data length:', data?.length)
      if (data && data.length > 0) {
        console.log('Sample data:', data[0])
      }

      setBenchmarks(data || [])
      
      const uniqueIndustries = [...new Set(data?.map(b => b.industry) || [])]
      console.log('Unique industries:', uniqueIndustries)
      setIndustries(uniqueIndustries)
      if (uniqueIndustries.length > 0) {
        setSelectedIndustry(uniqueIndustries[0])
      }
    } catch (error) {
      console.error('Error fetching benchmarks:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getFilteredData = () => {
    const filtered = benchmarks.filter(
      b => b.industry === selectedIndustry && b.platform === toDbPlatform(selectedPlatform)
    )
    console.log('getFilteredData - selectedIndustry:', selectedIndustry)
    console.log('getFilteredData - selectedPlatform:', selectedPlatform)
    console.log('getFilteredData - filtered count:', filtered.length)
    console.log('getFilteredData - filtered data:', filtered)
    return filtered
  }

  const getMetricStats = (metric) => {
    const filtered = getFilteredData()
    
    console.log(`getMetricStats - metric: ${metric}`)
    console.log('getMetricStats - filtered length:', filtered.length)
    console.log('getMetricStats - filtered data:', filtered)
    
    // Filter by metric_name and extract metric_value
    const metricData = filtered.filter(b => b.metric_name === metric)
    console.log(`getMetricStats - metricData for ${metric}:`, metricData)
    
    const values = metricData.map(item => item.metric_value).filter(v => v !== null && v !== undefined)
    console.log('getMetricStats - values:', values)
    console.log('getMetricStats - values length:', values.length)
    
    if (values.length === 0) {
      return { avg: null, top25: null }
    }

    const sorted = [...values].sort((a, b) => b - a)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length
    const top25Index = Math.floor(values.length * config.topPercentileThreshold)
    const top25 = sorted[top25Index] || sorted[sorted.length - 1]

    return { avg, top25 }
  }

  const calculatePercentile = (userValue, metric) => {
    const stats = getMetricStats(metric)
    if (!userValue || stats.avg === null) return null

    // 높을수록 좋은 지표 (CTR, CVR, ROAS)
    const higherIsBetter = ['CTR', 'CVR', 'ROAS'].includes(metric)
    
    // p25, p75가 있는 경우
    if (stats.p25 !== null && stats.p75 !== null) {
      if (higherIsBetter) {
        if (userValue >= stats.p75) return 100  // 상위 25% 이내
        if (userValue >= stats.avg) return 75   // 상위 50% 이내
        if (userValue >= stats.p25) return 50   // 상위 75% 이내
        return 25  // 하위 25%
      } else {
        // 낮을수록 좋은 지표 (CPC, CPA, CPM)
        if (userValue <= stats.p25) return 100  // 상위 25% 이내
        if (userValue <= stats.avg) return 75   // 상위 50% 이내
        if (userValue <= stats.p75) return 50   // 상위 75% 이내
        return 25  // 하위 25%
      }
    }
    
    // p25/p75가 없는 경우 (평균만 있는 경우)
    if (higherIsBetter) {
      return userValue >= stats.avg ? 75 : 25
    } else {
      return userValue <= stats.avg ? 75 : 25
    }
  }

  const getChartData = () => {
    const platformData = benchmarks.filter(b => b.platform === toDbPlatform(selectedPlatform))
    const industryAverages = {}

    industries.forEach(industry => {
      const industryData = platformData.filter(b => b.industry === industry)
      const metricData = industryData.filter(b => b.metric_name === selectedMetricForChart)
      const values = metricData.map(item => item.metric_value).filter(v => v !== null && v !== undefined)
      if (values.length > 0) {
        industryAverages[industry] = values.reduce((sum, v) => sum + v, 0) / values.length
      }
    })

    return Object.entries(industryAverages).map(([industry, value]) => ({
      industry,
      value,
      isSelected: industry === selectedIndustry
    }))
  }

  const formatMetricValue = (metric, value) => {
    if (value === null || value === undefined) return '데이터 없음'
    
    switch (metric) {
      case 'CTR':
      case 'CVR':
        return `${value.toFixed(2)}%`
      case 'CPC':
      case 'CPM':
      case 'CPA':
        return `$${value.toLocaleString()}`
      case 'ROAS':
        return value.toFixed(2)
      default:
        return value.toFixed(2)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Benchmarks</h1>
        <p className="text-gray-400">로딩 중...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Benchmarks</h1>
        <ErrorState message={error} onRetry={fetchBenchmarks} />
      </div>
    )
  }

  const filteredData = getFilteredData()
  const hasData = filteredData.length > 0

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Benchmarks</h1>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-sm text-gray-400 mb-1">업종</label>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            {industries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">플랫폼</label>
          <div className="flex gap-2">
            {PLATFORMS.map(platform => (
              <button
                key={platform.value}
                onClick={() => setSelectedPlatform(platform.value)}
                className={`px-4 py-2 rounded ${
                  selectedPlatform === platform.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {platform.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <EmptyState
          icon="📊"
          title="데이터가 없습니다"
          description="해당 업종/플랫폼 조합의 벤치마크 데이터가 아직 준비 중입니다."
        />
      ) : (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {METRICS.map(metric => {
              const stats = getMetricStats(metric)
              const hasMetricData = stats.avg !== null
              
              return (
                <div
                  key={metric}
                  className={`rounded-lg p-4 ${
                    hasMetricData ? 'bg-blue-900' : 'bg-gray-800'
                  }`}
                >
                  <h3 className="text-lg font-semibold mb-2">{METRIC_NAMES[metric]}</h3>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">평균: {formatMetricValue(metric, stats.avg)}</p>
                    <p className="text-sm text-gray-400">상위 25%: {formatMetricValue(metric, stats.top25)}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* User Comparison */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">내 수치 비교</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {METRICS.map(metric => {
                const stats = getMetricStats(metric)
                const percentile = calculatePercentile(parseFloat(userMetrics[metric]), metric)
                
                return (
                  <div key={metric} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">
                      {METRIC_NAMES[metric]}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={userMetrics[metric]}
                      onChange={(e) => setUserMetrics({ ...userMetrics, [metric]: e.target.value })}
                      placeholder="값 입력"
                      className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
                    />
                    {percentile !== null && (
                      <div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${percentile}%` }}
                          />
                        </div>
                        <p className="text-sm text-gray-400 mt-1">상위 {100 - percentile}% 수준</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Industry Comparison Chart */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h2 className="text-xl font-bold">업종 간 비교</h2>
              <select
                value={selectedMetricForChart}
                onChange={(e) => setSelectedMetricForChart(e.target.value)}
                className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              >
                {METRICS.map(metric => (
                  <option key={metric} value={metric}>{METRIC_NAMES[metric]}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <ResponsiveContainer width="100%" height={400} minWidth={600}>
                <BarChart data={getChartData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="industry" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    itemStyle={{ color: '#F3F4F6' }}
                  />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Benchmarks

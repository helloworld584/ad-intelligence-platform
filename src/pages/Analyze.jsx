import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useSession } from '../contexts/AuthContext'
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { toDbPlatform } from '../lib/mappings'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

const INDUSTRIES = ['이커머스', '교육', 'SaaS/테크', '금융/보험', '헬스케어', '여행/숙박', '부동산', '리테일', 'B2B', '미디어/엔터']
const PLATFORMS = ['Google Search', 'Google Display', 'Meta']

function Analyze() {
  const { session } = useSession()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    campaignName: '',
    industry: '',
    platform: '',
    budget: '',
    impressions: '',
    clicks: '',
    conversions: '',
    revenue: ''
  })
  const [benchmarks, setBenchmarks] = useState([])
  const [analyzed, setAnalyzed] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [budgetAllocation, setBudgetAllocation] = useState({
    'Google Search': { value: 50, locked: false },
    'Google Display': { value: 25, locked: false },
    'Meta': { value: 25, locked: false }
  })
  const [optimizationData, setOptimizationData] = useState({
    totalBudget: '',
    goal: '',
    optimized: false,
    allocation: null,
    performance: null
  })
  const [config, setConfig] = useState({
    simulatorDisclaimer: '',
    topPercentileThreshold: 0.25
  })
  const [aiDiagnosis, setAiDiagnosis] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState(null)

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSliderChange = (platform, value) => {
    const newValue = parseInt(value)
    const oldValue = budgetAllocation[platform].value
    
    if (budgetAllocation[platform].locked) return
    
    const lockedPlatforms = PLATFORMS.filter(p => budgetAllocation[p].locked)
    const unlockedPlatforms = PLATFORMS.filter(p => !budgetAllocation[p].locked && p !== platform)
    
    const lockedTotal = lockedPlatforms.reduce((sum, p) => sum + budgetAllocation[p].value, 0)
    const unlockedTotal = unlockedPlatforms.reduce((sum, p) => sum + budgetAllocation[p].value, 0)
    
    if (unlockedPlatforms.length === 0) {
      return
    }
    
    const remainingForUnlocked = 100 - lockedTotal - newValue
    if (remainingForUnlocked < 0) return
    
    const newAllocation = { ...budgetAllocation }
    newAllocation[platform] = { ...newAllocation[platform], value: newValue }
    
    if (unlockedPlatforms.length === 1) {
      const otherPlatform = unlockedPlatforms[0]
      newAllocation[otherPlatform] = { ...newAllocation[otherPlatform], value: remainingForUnlocked }
    } else {
      const otherUnlockedTotal = unlockedPlatforms.reduce((sum, p) => sum + budgetAllocation[p].value, 0)
      if (otherUnlockedTotal === 0) {
        unlockedPlatforms.forEach(p => {
          newAllocation[p] = { ...newAllocation[p], value: remainingForUnlocked / unlockedPlatforms.length }
        })
      } else {
        unlockedPlatforms.forEach(otherPlatform => {
          const proportion = budgetAllocation[otherPlatform].value / otherUnlockedTotal
          newAllocation[otherPlatform] = { ...newAllocation[otherPlatform], value: Math.round(remainingForUnlocked * proportion) }
        })
      }
    }
    
    setBudgetAllocation(newAllocation)
  }

  const toggleLock = (platform) => {
    setBudgetAllocation({
      ...budgetAllocation,
      [platform]: { ...budgetAllocation[platform], locked: !budgetAllocation[platform].locked }
    })
  }

  const calculateMetrics = () => {
    const budget = parseFloat(formData.budget)
    const impressions = parseFloat(formData.impressions)
    const clicks = parseFloat(formData.clicks)
    const conversions = parseFloat(formData.conversions)
    const revenue = parseFloat(formData.revenue)

    const ctr = clicks > 0 && impressions > 0 ? (clicks / impressions) * 100 : 0
    const cpc = clicks > 0 ? budget / clicks : 0
    const cvr = clicks > 0 && conversions > 0 ? (conversions / clicks) * 100 : 0
    const cpa = conversions > 0 ? budget / conversions : 0
    const roas = budget > 0 ? revenue / budget : 0

    return { ctr, cpc, cvr, cpa, roas }
  }

  const fetchBenchmarks = async () => {
    try {
      const { data, error } = await supabase
        .from('v_benchmarks')
        .select('*')

      if (error) throw error
      const result = data || []
      setBenchmarks(result)
      return result
    } catch (error) {
      console.error('Error fetching benchmarks:', error)
      return []
    }
  }

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
        simulatorDisclaimer: configMap['simulator_disclaimer'] || '수확체감 미반영. 단순 벤치마크 기반 선형 추정치이며 실제 성과와 다를 수 있습니다.',
        topPercentileThreshold: configMap['top_percentile_threshold'] || 0.25
      })
    } catch (error) {
      console.error('Error fetching config:', error)
    }
  }

  const getBenchmarkMetrics = () => {
    const filtered = benchmarks.filter(
      b => b.industry === formData.industry && b.platform === toDbPlatform(formData.platform)
    )

    const result = {}
    const metricNames = ['CTR', 'CPC', 'CVR', 'CPA', 'ROAS']
    
    metricNames.forEach(metric => {
      const metricData = filtered.filter(b => b.metric_name === metric)
      const values = metricData.map(item => item.metric_value).filter(v => v !== null && v !== undefined)
      if (values.length > 0) {
        result[metric.toLowerCase()] = values.reduce((sum, v) => sum + v, 0) / values.length
      }
    })

    return result
  }

  const getBenchmarkPercentiles = () => {
    const filtered = benchmarks.filter(
      b => b.industry === formData.industry && b.platform === toDbPlatform(formData.platform)
    )

    const result = {}
    const metricNames = ['CTR', 'CPC', 'CVR', 'CPA', 'ROAS']
    
    metricNames.forEach(metric => {
      const metricData = filtered.filter(b => b.metric_name === metric)
      const p25Data = metricData.find(item => item.percentile_25 !== null && item.percentile_25 !== undefined)
      const p75Data = metricData.find(item => item.percentile_75 !== null && item.percentile_75 !== undefined)
      
      if (p25Data || p75Data) {
        result[metric.toLowerCase()] = {
          p25: p25Data?.percentile_25 || null,
          p75: p75Data?.percentile_75 || null
        }
      }
    })

    return result
  }

  const analyze = async () => {
    if (!session) {
      alert('AI 진단 리포트를 사용하려면 로그인이 필요합니다.')
      navigate('/login')
      return
    }

    const calculatedMetrics = calculateMetrics()
    setMetrics(calculatedMetrics)
    setAiDiagnosis(null)
    setAiError(null)
    setAiLoading(true)

    const fetchedBenchmarks = await fetchBenchmarks()
    await fetchConfig()
    setAnalyzed(true)

    // 벤치마크 데이터 구성 (state race condition 방지를 위해 직접 계산)
    const dbPlatform = toDbPlatform(formData.platform)
    const filtered = fetchedBenchmarks.filter(
      b => b.industry === formData.industry && b.platform === dbPlatform
    )

    const buildBenchmarkMetric = (metricName) => {
      const rows = filtered.filter(b => b.metric_name === metricName)
      const values = rows.map(r => r.metric_value).filter(v => v != null)
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
      const p25Row = rows.find(r => r.percentile_25 != null)
      const p75Row = rows.find(r => r.percentile_75 != null)
      return { avg, p25: p25Row?.percentile_25 ?? 0, p75: p75Row?.percentile_75 ?? 0 }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${import.meta.env.VITE_API_URL}/diagnose`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          campaign: {
            industry: formData.industry,
            platform: dbPlatform,
            budget: parseFloat(formData.budget),
            impressions: parseInt(formData.impressions),
            clicks: parseInt(formData.clicks),
            conversions: parseInt(formData.conversions),
            revenue: parseFloat(formData.revenue)
          },
          metrics: {
            ctr: calculatedMetrics.ctr,
            cpc: calculatedMetrics.cpc,
            cvr: calculatedMetrics.cvr,
            cpa: calculatedMetrics.cpa,
            roas: calculatedMetrics.roas
          },
          benchmarks: {
            ctr:  buildBenchmarkMetric('CTR'),
            cpc:  buildBenchmarkMetric('CPC'),
            cvr:  buildBenchmarkMetric('CVR'),
            cpa:  buildBenchmarkMetric('CPA'),
            roas: buildBenchmarkMetric('ROAS')
          }
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
      setAiDiagnosis(data)
    } catch (err) {
      console.error('Diagnose error:', err)
      setAiError(err.message || '분석에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setAiLoading(false)
    }
  }

  const getDiagnostic = (userMetric, metricName) => {
    const percentiles = getBenchmarkPercentiles()
    const metricPercentiles = percentiles[metricName.toLowerCase()]
    
    if (!metricPercentiles || metricPercentiles.p25 === null || metricPercentiles.p75 === null) {
      return { status: 'neutral', message: '기준 데이터 없음' }
    }
    
    const p25 = metricPercentiles.p25
    const p75 = metricPercentiles.p75
    
    const lowerIsBetter = ['cpc', 'cpa'].includes(metricName.toLowerCase())
    
    if (lowerIsBetter) {
      if (userMetric <= p25) {
        return { status: 'good', message: '✓ 잘하고 있음' }
      } else if (userMetric >= p75) {
        return { status: 'bad', message: '⚠ 개선 필요' }
      } else {
        return { status: 'neutral', message: '→ 평균 수준' }
      }
    } else {
      if (userMetric >= p75) {
        return { status: 'good', message: '✓ 잘하고 있음' }
      } else if (userMetric <= p25) {
        return { status: 'bad', message: '⚠ 개선 필요' }
      } else {
        return { status: 'neutral', message: '→ 평균 수준' }
      }
    }
  }

  const getActionItems = (userMetrics, benchmarkMetrics) => {
    const actions = []
    
    if (benchmarkMetrics.ctr && userMetrics.ctr < benchmarkMetrics.ctr * 0.9) {
      actions.push('광고 헤드라인을 질문형으로 변경해보세요')
    }
    if (benchmarkMetrics.cvr && userMetrics.cvr < benchmarkMetrics.cvr * 0.9) {
      actions.push('랜딩 페이지 CTA 버튼 위치를 최적화하세요')
    }
    if (benchmarkMetrics.cpa && userMetrics.cpa > benchmarkMetrics.cpa * 1.1) {
      actions.push('키워드 품질 점수를 높여 CPA를 낮추세요')
    }
    if (benchmarkMetrics.cpc && userMetrics.cpc > benchmarkMetrics.cpc * 1.1) {
      actions.push('부정 키워드를 추가하여 불필요한 클릭을 줄이세요')
    }
    if (benchmarkMetrics.roas && userMetrics.roas < benchmarkMetrics.roas * 0.9) {
      actions.push('ROAS가 낮은 캠페인은 예산을 줄이세요')
    }
    
    if (actions.length === 0) {
      actions.push('현재 성과가 양호합니다. 유지 관리에 집중하세요')
    }
    
    return actions.slice(0, 3)
  }

  const getRadarData = () => {
    if (!metrics) return []
    
    const benchmarkMetrics = getBenchmarkMetrics()
    
    const normalize = (user, benchmark, lowerIsBetter = false) => {
      if (!benchmark || benchmark === 0) return 1
      let normalized
      if (lowerIsBetter) {
        normalized = benchmark / user
      } else {
        normalized = user / benchmark
      }
      return Math.min(normalized, 2.0)
    }
    
    return [
      {
        metric: 'CTR',
        user: normalize(metrics.ctr, benchmarkMetrics.ctr),
        benchmark: 1
      },
      {
        metric: 'CVR',
        user: normalize(metrics.cvr, benchmarkMetrics.cvr),
        benchmark: 1
      },
      {
        metric: 'ROAS',
        user: normalize(metrics.roas, benchmarkMetrics.roas),
        benchmark: 1
      },
      {
        metric: 'CPA',
        user: normalize(metrics.cpa, benchmarkMetrics.cpa, true),
        benchmark: 1
      },
      {
        metric: 'CPC',
        user: normalize(metrics.cpc, benchmarkMetrics.cpc, true),
        benchmark: 1
      }
    ]
  }

  const calculateExpectedROAS = () => {
    const industry = formData.industry
    const platformROAS = {}
    
    PLATFORMS.forEach(platform => {
      const dbPlatform = toDbPlatform(platform)
      const filtered = benchmarks.filter(
        b => b.industry === industry && b.platform === dbPlatform && b.metric_name === 'ROAS'
      )
      const values = filtered.map(item => item.metric_value).filter(v => v !== null && v !== undefined)
      if (values.length > 0) {
        platformROAS[platform] = values.reduce((sum, v) => sum + v, 0) / values.length
      } else {
        platformROAS[platform] = null
      }
    })
    
    const weightedROAS = Object.entries(budgetAllocation).reduce((sum, [platform, data]) => {
      const roas = platformROAS[platform]
      if (roas === null || data.value === 0) return sum
      return sum + roas * (data.value / 100)
    }, 0)
    
    return weightedROAS.toFixed(2)
  }

  const getPlatformROASMap = () => {
    const industry = formData.industry
    const roasMap = {}
    
    PLATFORMS.forEach(platform => {
      const dbPlatform = toDbPlatform(platform)
      const filtered = benchmarks.filter(
        b => b.industry === industry && b.platform === dbPlatform && b.metric_name === 'ROAS'
      )
      const values = filtered.map(item => item.metric_value).filter(v => v !== null && v !== undefined)
      if (values.length > 0) {
        roasMap[dbPlatform] = values.reduce((sum, v) => sum + v, 0) / values.length
      } else {
        roasMap[dbPlatform] = null
      }
    })
    
    return roasMap
  }

  const getAllPlatformBenchmarks = (industry) => {
    const result = {}
    
    const defaultValues = {
      cpc: 1.5,
      cpm: 5.0,
      cvr: 3.5,
      roas: 2.0
    }
    
    PLATFORMS.forEach(platform => {
      const dbPlatform = toDbPlatform(platform)
      const filtered = benchmarks.filter(
        b => b.industry === industry && b.platform === dbPlatform
      )
      
      const metrics = {}
      const metricNames = ['CTR', 'CPC', 'CPM', 'CVR', 'ROAS']
      
      metricNames.forEach(metric => {
        const metricData = filtered.filter(b => b.metric_name === metric)
        const values = metricData.map(item => item.metric_value).filter(v => v !== null && v !== undefined)
        if (values.length > 0) {
          metrics[metric.toLowerCase()] = values.reduce((sum, v) => sum + v, 0) / values.length
        } else {
          metrics[metric.toLowerCase()] = defaultValues[metric.toLowerCase()]
        }
      })
      
      result[platform] = metrics
    })
    
    return result
  }

  const calculateOptimization = async () => {
    if (!session) {
      alert('예산 최적화 엔진을 사용하려면 로그인이 필요합니다.')
      navigate('/login')
      return
    }

    const totalBudget = parseFloat(optimizationData.totalBudget)
    const goal = optimizationData.goal
    const industry = formData.industry
    
    if (!totalBudget || !goal || !industry) {
      alert('총 예산, 목표, 업종을 모두 선택해주세요.')
      return
    }
    
    const platformBenchmarks = getAllPlatformBenchmarks(industry)
    
    const platformWeights = {}
    PLATFORMS.forEach(platform => {
      const metrics = platformBenchmarks[platform]
      const cpc = metrics.cpc || 1
      const cvr = metrics.cvr || 1
      const roas = metrics.roas || 1
      
      switch (goal) {
        case '클릭 최대화':
          platformWeights[platform] = 1 / cpc
          break
        case '전환 최대화':
          platformWeights[platform] = (cvr / 100) / cpc
          break
        case 'ROAS 최대화':
          platformWeights[platform] = roas
          break
        default:
          platformWeights[platform] = 1
      }
    })
    
    const totalWeight = Object.values(platformWeights).reduce((sum, w) => sum + w, 0)
    const allocation = {}
    
    PLATFORMS.forEach(platform => {
      allocation[platform] = (platformWeights[platform] / totalWeight) * 100
    })
    
    const performance = {}
    let totalClicks = 0
    let totalConversions = 0
    let totalImpressions = 0
    let weightedROAS = 0
    
    PLATFORMS.forEach(platform => {
      const budget = totalBudget * (allocation[platform] / 100)
      const metrics = platformBenchmarks[platform]
      const cpc = metrics.cpc || 1
      const cpm = metrics.cpm || 1
      const cvr = metrics.cvr / 100 || 0.01
      const roas = metrics.roas || 1
      
      const clicks = budget / cpc
      const impressions = budget / cpm * 1000
      const conversions = clicks * cvr
      
      totalClicks += clicks
      totalConversions += conversions
      totalImpressions += impressions
      weightedROAS += roas * (allocation[platform] / 100)
      
      performance[platform] = {
        budget: budget,
        clicks: clicks,
        impressions: impressions,
        conversions: conversions,
        roas: roas,
        usedMetrics: {
          cpc: metrics.cpc,
          cpm: metrics.cpm,
          cvr: metrics.cvr,
          roas: metrics.roas
        }
      }
    })
    
    setOptimizationData({
      ...optimizationData,
      optimized: true,
      allocation,
      performance: {
        ...performance,
        total: {
          clicks: totalClicks,
          conversions: totalConversions,
          impressions: totalImpressions,
          roas: weightedROAS
        }
      }
    })
  }

  const handleOptimizationChange = (e) => {
    setOptimizationData({
      ...optimizationData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">캠페인 분석</h1>

      {/* Data Input Section */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">데이터 입력</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">캠페인명</label>
            <input
              type="text"
              name="campaignName"
              value={formData.campaignName}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="캠페인명 입력"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">업종</label>
            <select
              name="industry"
              value={formData.industry}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="">업종 선택</option>
              {INDUSTRIES.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">플랫폼</label>
            <select
              name="platform"
              value={formData.platform}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
            >
              <option value="">플랫폼 선택</option>
              {PLATFORMS.map(platform => (
                <option key={platform} value={platform}>{platform}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">예산 ($)</label>
            <input
              type="number"
              name="budget"
              value={formData.budget}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="예산 입력"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">노출수</label>
            <input
              type="number"
              name="impressions"
              value={formData.impressions}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="노출수 입력"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">클릭수</label>
            <input
              type="number"
              name="clicks"
              value={formData.clicks}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="클릭수 입력"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">전환수</label>
            <input
              type="number"
              name="conversions"
              value={formData.conversions}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="전환수 입력"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">매출 ($)</label>
            <input
              type="number"
              name="revenue"
              value={formData.revenue}
              onChange={handleInputChange}
              className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
              placeholder="매출 입력"
            />
          </div>
        </div>
        <button
          onClick={analyze}
          className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2 rounded"
        >
          분석하기
        </button>
      </div>

      {/* Analysis Results Section */}
      {analyzed && metrics && (
        <>
          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-1">CTR</h3>
              <p className="text-2xl font-bold">{metrics.ctr.toFixed(2)}%</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-1">CPC</h3>
              <p className="text-2xl font-bold">${metrics.cpc.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-1">CVR</h3>
              <p className="text-2xl font-bold">{metrics.cvr.toFixed(2)}%</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-1">CPA</h3>
              <p className="text-2xl font-bold">${metrics.cpa.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-sm text-gray-400 mb-1">ROAS</h3>
              <p className="text-2xl font-bold">{metrics.roas.toFixed(2)}</p>
            </div>
          </div>

          {/* Radar Chart */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">업종 평균 대비 비교</h2>
            {getBenchmarkMetrics().ctr === undefined && getBenchmarkMetrics().cpc === undefined ? (
              <EmptyState
                icon="📈"
                title="벤치마크 데이터 없음"
                description="해당 업종/플랫폼의 비교 데이터가 없습니다."
              />
            ) : (
              <ResponsiveContainer width="100%" height={250} smHeight={400}>
                <RadarChart data={getRadarData()}>
                  <PolarGrid stroke="#374151" />
                  <PolarAngleAxis dataKey="metric" stroke="#9CA3AF" />
                  <PolarRadiusAxis 
                    stroke="#9CA3AF" 
                    domain={[0, 2]}
                    tickFormatter={(value) => value === 1 ? '평균' : value}
                  />
                  <Radar name="내 수치" dataKey="user" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
                  <Radar name="업종 평균" dataKey="benchmark" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* AI Diagnostic Report */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-6">AI 진단 리포트</h2>

            {/* 로딩 */}
            {aiLoading && (
              <div className="flex items-center gap-3 text-gray-400 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span>AI 분석 중...</span>
              </div>
            )}

            {/* 에러 */}
            {aiError && (
              <ErrorState message={aiError} onRetry={analyze} />
            )}

            {/* 결과 5개 블록 */}
            {aiDiagnosis && (
              <>
                {/* ① 지표별 심층 진단 */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 text-gray-200">① 지표별 심층 진단</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {aiDiagnosis.per_metric_analysis.map((item) => {
                      const isBelow = item.status === 'below_average'
                      const isAbove = item.status === 'above_average'
                      return (
                        <div
                          key={item.metric}
                          className={`p-4 rounded-lg border ${
                            isBelow ? 'bg-red-950 border-red-700'
                            : isAbove ? 'bg-green-950 border-green-700'
                            : 'bg-gray-700 border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-bold text-base">{item.metric.toUpperCase()}</h4>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              isBelow ? 'bg-red-600'
                              : isAbove ? 'bg-green-600'
                              : 'bg-gray-500'
                            }`}>
                              {isBelow ? '개선 필요' : isAbove ? '우수' : '평균'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 mb-2">
                            <span className="font-medium text-gray-100">원인 추정: </span>
                            {item.cause_estimate}
                          </p>
                          <p className="text-xs text-gray-400">
                            <span className="font-medium">연쇄 효과: </span>
                            {item.cascade_effect}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ② 지표 간 관계 분석 */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 text-gray-200">② 지표 간 관계 분석</h3>
                  <div className="space-y-3">
                    {aiDiagnosis.metric_relationships.map((rel, i) => (
                      <div key={i} className="bg-gray-700 rounded-lg p-4">
                        <p className="font-medium text-blue-300 mb-1">{rel.pattern}</p>
                        <p className="text-sm text-gray-300">{rel.interpretation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ③ 업종/플랫폼 특성 */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 text-gray-200">③ 업종/플랫폼 특성</h3>
                  <div className="bg-gray-700 rounded-lg p-4">
                    <p className="font-medium text-yellow-300 mb-2">
                      핵심 지표: {aiDiagnosis.industry_platform_context.key_metric}
                    </p>
                    <p className="text-sm text-gray-300">{aiDiagnosis.industry_platform_context.insight}</p>
                  </div>
                </div>

                {/* ④ 우선순위별 액션 아이템 */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-3 text-gray-200">④ 우선순위별 액션 아이템</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { key: 'immediate',  label: '지금 당장',  border: 'border-red-500' },
                      { key: 'next_cycle', label: '다음 주기',  border: 'border-yellow-500' },
                      { key: 'long_term',  label: '장기 고려',  border: 'border-blue-500' }
                    ].map(({ key, label, border }) => (
                      <div key={key} className={`bg-gray-700 rounded-lg p-4 border-l-4 ${border}`}>
                        <h4 className="font-semibold mb-3">{label}</h4>
                        <ul className="space-y-3">
                          {aiDiagnosis.action_items[key].map((item, i) => (
                            <li key={i}>
                              <p className="text-sm text-white">{item.action}</p>
                              <p className="text-xs text-gray-400 mt-0.5">→ {item.expected_impact}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ⑤ 예산 효율성 진단 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-gray-200">⑤ 예산 효율성 진단</h3>
                  {(() => {
                    const VERDICT_CONFIG = {
                      increase:   { icon: '↑', colorText: 'text-green-400', bg: 'bg-green-950 border-green-700', label: '증액 권장' },
                      decrease:   { icon: '↓', colorText: 'text-red-400',   bg: 'bg-red-950 border-red-700',   label: '감액 권장' },
                      reallocate: { icon: '↔', colorText: 'text-blue-400',  bg: 'bg-blue-950 border-blue-700', label: '재배분 권장' },
                      maintain:   { icon: '=', colorText: 'text-gray-400',  bg: 'bg-gray-700 border-gray-600', label: '현상 유지' }
                    }
                    const cfg = VERDICT_CONFIG[aiDiagnosis.budget_efficiency.verdict] || VERDICT_CONFIG.maintain
                    return (
                      <div className={`rounded-lg p-5 border ${cfg.bg}`}>
                        <div className="flex items-center gap-3 mb-3">
                          <span className={`text-3xl font-bold ${cfg.colorText}`}>{cfg.icon}</span>
                          <span className={`text-lg font-semibold ${cfg.colorText}`}>{cfg.label}</span>
                        </div>
                        <p className="text-sm text-gray-300 mb-2">{aiDiagnosis.budget_efficiency.reasoning}</p>
                        <p className="text-sm text-gray-400">{aiDiagnosis.budget_efficiency.suggestion}</p>
                      </div>
                    )
                  })()}
                </div>
              </>
            )}
          </div>

          {/* Budget Reallocation Simulator */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">예산 재배분 시뮬레이터</h2>
            {config.simulatorDisclaimer && (
              <div className="bg-yellow-900 border border-yellow-600 rounded-lg p-3 mb-6">
                <p className="text-yellow-200 text-sm">{config.simulatorDisclaimer}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {PLATFORMS.map(platform => {
                const roasMap = getPlatformROASMap()
                const dbPlatform = toDbPlatform(platform)
                const roasAvailable = roasMap[dbPlatform] !== null
                return (
                  <div key={platform} className={!roasAvailable ? 'opacity-50' : ''}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium text-gray-300">
                        {platform}
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white">{budgetAllocation[platform].value}%</span>
                        <button
                          onClick={() => toggleLock(platform)}
                          className="text-lg cursor-pointer hover:opacity-70"
                        >
                          {budgetAllocation[platform].locked ? '🔒' : '🔓'}
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={budgetAllocation[platform].value}
                      onChange={(e) => handleSliderChange(platform, parseInt(e.target.value))}
                      className="w-full"
                      disabled={budgetAllocation[platform].locked || !roasAvailable}
                      title={!roasAvailable ? '이 업종은 해당 플랫폼의 ROAS 벤치마크가 없습니다' : ''}
                    />
                    {!roasAvailable && (
                      <p className="text-xs text-gray-400 mt-1">이 업종은 해당 플랫폼의 ROAS 벤치마크가 없습니다</p>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-300">
                벤치마크 기반 선형 추정치: <span className="text-2xl font-bold text-green-400">
                  {Object.values(budgetAllocation).reduce((sum, data) => sum + data.value, 0) === 100 
                    ? calculateExpectedROAS() 
                    : '-'}
                </span>
              </p>
              <p className={`text-sm mt-2 ${
                Object.values(budgetAllocation).reduce((sum, data) => sum + data.value, 0) === 100
                  ? 'text-green-400'
                  : 'text-red-400'
              }`}>
                {Object.values(budgetAllocation).reduce((sum, data) => sum + data.value, 0) === 100 
                  ? '✓ 합계 100%' 
                  : `현재 배분 합계: ${Object.values(budgetAllocation).reduce((sum, data) => sum + data.value, 0)}% (100%로 맞춰주세요)`}
              </p>
            </div>
          </div>

          {/* Budget Optimization Engine */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-2">예산 최적화 엔진</h2>
            <p className="text-xs text-gray-400 mb-4">업종별 실제 벤치마크 데이터 기반 계산</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">총 예산 ($)</label>
                <input
                  type="number"
                  name="totalBudget"
                  value={optimizationData.totalBudget}
                  onChange={handleOptimizationChange}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
                  placeholder="총 예산 입력"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">목표</label>
                <select
                  name="goal"
                  value={optimizationData.goal}
                  onChange={handleOptimizationChange}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-blue-500"
                >
                  <option value="">목표 선택</option>
                  <option value="클릭 최대화">클릭 최대화</option>
                  <option value="전환 최대화">전환 최대화</option>
                  <option value="ROAS 최대화">ROAS 최대화</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={calculateOptimization}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded"
                >
                  최적화 계산
                </button>
              </div>
            </div>

            {optimizationData.optimized && optimizationData.allocation && (
              <>
                {/* Budget Allocation Chart */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">권장 예산 배분</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(optimizationData.allocation).map(([name, value]) => ({ name, value }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="name" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" tickFormatter={(value) => `${value.toFixed(1)}%`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                        itemStyle={{ color: '#F3F4F6' }}
                        formatter={(value) => `${value.toFixed(1)}%`}
                      />
                      <Bar dataKey="value" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Platform Performance Cards */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold mb-4">플랫폼별 예상 성과</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PLATFORMS.map(platform => {
                      const perf = optimizationData.performance[platform]
                      const isEstimated = perf.usedMetrics.cpc === 1.5 || perf.usedMetrics.cpm === 5.0 || perf.usedMetrics.cvr === 3.5 || perf.usedMetrics.roas === 2.0
                      return (
                        <div key={platform} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start mb-3">
                            <h4 className="font-semibold text-blue-400">{platform}</h4>
                            {isEstimated && <span className="text-xs text-gray-400">* 추정값 포함</span>}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-400">예산:</span>
                              <span className="text-white">${perf.budget.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">예상 클릭:</span>
                              <span className="text-white">{perf.clicks.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">예상 노출:</span>
                              <span className="text-white">{perf.impressions.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">예상 전환:</span>
                              <span className="text-white">{perf.conversions.toFixed(0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400">예상 ROAS:</span>
                              <span className="text-green-400">{perf.roas.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Total Summary */}
                <div className="bg-gray-700 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold mb-3">총 예상 성과</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">총 예상 클릭</p>
                      <p className="text-2xl font-bold text-white">{optimizationData.performance.total.clicks.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">총 예상 전환</p>
                      <p className="text-2xl font-bold text-white">{optimizationData.performance.total.conversions.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">총 예상 노출</p>
                      <p className="text-2xl font-bold text-white">{optimizationData.performance.total.impressions.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400 mb-1">가중 ROAS</p>
                      <p className="text-2xl font-bold text-green-400">{optimizationData.performance.total.roas.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Calculation Criteria */}
                <div className="bg-gray-700 rounded-lg p-4">
                  <h3 className="font-semibold mb-3 text-sm">계산 기준</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    {PLATFORMS.map(platform => {
                      const metrics = optimizationData.performance[platform].usedMetrics
                      const isEstimatedCPC = metrics.cpc === 1.5
                      const isEstimatedCPM = metrics.cpm === 5.0
                      const isEstimatedCVR = metrics.cvr === 3.5
                      const isEstimatedROAS = metrics.roas === 2.0
                      return (
                        <div key={platform} className="space-y-1">
                          <p className="font-semibold text-blue-400">{platform}</p>
                          <div className="flex justify-between">
                            <span className="text-gray-400">CPC:</span>
                            <span className={isEstimatedCPC ? 'text-gray-500' : 'text-white'}>${metrics.cpc.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">CPM:</span>
                            <span className={isEstimatedCPM ? 'text-gray-500' : 'text-white'}>${metrics.cpm.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">CVR:</span>
                            <span className={isEstimatedCVR ? 'text-gray-500' : 'text-white'}>{metrics.cvr.toFixed(2)}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">ROAS:</span>
                            <span className={isEstimatedROAS ? 'text-gray-500' : 'text-white'}>{metrics.roas.toFixed(2)}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default Analyze

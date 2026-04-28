import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useSession } from '../contexts/AuthContext'
import { useTranslation } from '../hooks/useTranslation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import EmptyState from '../components/EmptyState'

function Dashboard() {
  const { session } = useSession()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)
  const [selectedGroup, setSelectedGroup] = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          navigate('/login')
          return
        }
        const response = await fetch(`${import.meta.env.VITE_API_URL}/campaigns`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        })

        if (response.status === 401) {
          navigate('/login')
          return
        }

        if (!response.ok) throw new Error('Failed to fetch campaigns')

        const data = await response.json()
        setCampaigns(data || [])
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const deleteCampaign = async (id) => {
    if (!window.confirm(t('page.dashboard.delete_confirm'))) return

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${import.meta.env.VITE_API_URL}/campaigns/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) throw new Error('Failed to delete campaign')

      setCampaigns(campaigns.filter(c => c.id !== id))
      setSelectedCampaign(null)
    } catch (err) {
      setError(err.message)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }

  const getCampaignName = (campaign, index) => {
    return campaign.campaign_name || `${t('page.dashboard.campaign_n')} ${index + 1}`
  }

  // Get unique industry+platform combinations
  const getUniqueGroups = () => {
    const groups = new Set()
    campaigns.forEach(c => {
      const key = `${c.industry} · ${c.platform}`
      groups.add(key)
    })
    return Array.from(groups)
  }

  // Filter campaigns by selected group
  const filteredCampaigns = selectedGroup
    ? campaigns.filter(c => `${c.industry} · ${c.platform}` === selectedGroup)
    : campaigns

  // Calculate summary stats (filtered by selected group)
  const totalCampaigns = filteredCampaigns.length
  const avgRoas = filteredCampaigns
    .filter(c => c.roas != null)
    .reduce((sum, c) => sum + c.roas, 0) / filteredCampaigns.filter(c => c.roas != null).length || 0
  const avgCtr = filteredCampaigns
    .filter(c => c.ctr != null)
    .reduce((sum, c) => sum + c.ctr, 0) / filteredCampaigns.filter(c => c.ctr != null).length || 0
  const aiDiagnosisCount = filteredCampaigns.filter(c => c.ai_diagnosis).length

  // Prepare chart data (filtered by selected group)
  const chartData = filteredCampaigns
    .map(c => ({
      date: formatDate(c.recorded_at),
      CTR: c.ctr ? (c.ctr * 100) : 0,
      ROAS: c.roas || 0
    }))
    .reverse()

  const uniqueGroups = getUniqueGroups()
  const showDropdown = uniqueGroups.length > 1

  // Calculate max values for y-axis domains
  const ctrs = chartData.map(d => d.CTR)
  const roases = chartData.map(d => d.ROAS)
  const maxCtr = Math.max(...ctrs, 0)
  const maxRoas = Math.max(...roases, 0)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">{t('page.dashboard.title')}</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">{t('page.dashboard.title')}</h1>
        <div className="bg-red-900 border border-red-700 text-red-100 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2">{t('page.dashboard.title')}</h1>
      <p className="text-gray-400 mb-6">{t('page.dashboard.subtitle')}</p>

      {campaigns.length === 0 ? (
        <EmptyState
          icon="📊"
          title={t('page.dashboard.no_campaigns')}
          description={t('page.dashboard.no_campaigns_desc')}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-1">{t('page.dashboard.total_campaigns')}</p>
              <p className="text-3xl font-bold">{totalCampaigns}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-1">{t('page.dashboard.avg_roas')}</p>
              <p className="text-3xl font-bold">{avgRoas.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-1">{t('page.dashboard.avg_ctr')}</p>
              <p className="text-3xl font-bold">{(avgCtr * 100).toFixed(2)}%</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <p className="text-gray-400 text-sm mb-1">AI 진단 완료</p>
              <p className="text-3xl font-bold">{aiDiagnosisCount}</p>
            </div>
          </div>

          {/* Time Series Chart */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">CTR & ROAS Trend</h2>
              {showDropdown && (
                <select
                  value={selectedGroup || ''}
                  onChange={(e) => setSelectedGroup(e.target.value || null)}
                  className="bg-gray-700 text-white px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                >
                  <option value="">전체</option>
                  {uniqueGroups.map(group => (
                    <option key={group} value={group}>{group}</option>
                  ))}
                </select>
              )}
            </div>
            {chartData.length < 2 ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                시계열 분석을 위해 동일 업종·플랫폼 캠페인을 2개 이상 저장하세요
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis yAxisId="left" stroke="#9CA3AF" orientation="left" domain={[0, maxCtr * 1.2]} />
                  <YAxis yAxisId="right" stroke="#9CA3AF" orientation="right" domain={[0, maxRoas * 1.2]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                    itemStyle={{ color: '#E5E7EB' }}
                    formatter={(value, name) => {
                      if (name === 'CTR') return [value.toFixed(2) + '%', 'CTR']
                      if (name === 'ROAS') return [value.toFixed(2) + 'x', 'ROAS']
                      return [value, name]
                    }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="CTR" stroke="#4D71F1" strokeWidth={2} dot={false} name="CTR" />
                  <Line yAxisId="right" type="monotone" dataKey="ROAS" stroke="#7C3AED" strokeWidth={2} dot={false} name="ROAS" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Campaign Table */}
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('page.dashboard.date')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('page.dashboard.campaign_name')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('page.dashboard.industry')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">{t('page.dashboard.platform')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">CTR</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">CPC</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">CVR</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">CPA</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">ROAS</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">상태</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">{t('page.dashboard.delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredCampaigns.map((campaign, index) => (
                    <tr
                      key={campaign.id}
                      className="hover:bg-gray-800 cursor-pointer"
                      onClick={() => setSelectedCampaign(campaign)}
                    >
                      <td className="px-4 py-3 text-sm text-gray-300">{formatDate(campaign.recorded_at)}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{getCampaignName(campaign, index)}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{campaign.industry}</td>
                      <td className="px-4 py-3 text-sm text-gray-300">{campaign.platform}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-right">{campaign.ctr ? (campaign.ctr * 100).toFixed(2) + '%' : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-right">{campaign.cpc ? campaign.cpc.toFixed(2) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-right">{campaign.cvr ? (campaign.cvr * 100).toFixed(2) + '%' : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-right">{campaign.cpa ? campaign.cpa.toFixed(2) : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-300 text-right">{campaign.roas ? campaign.roas.toFixed(2) : '-'}</td>
                      <td className="px-4 py-3 text-center">
                        {campaign.ai_diagnosis ? (
                          <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">AI 진단</span>
                        ) : (
                          <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded text-xs font-medium">수치만</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteCampaign(campaign.id)
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          {t('page.dashboard.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Diagnosis Side Panel */}
          {selectedCampaign && (
            <div className="fixed right-0 top-0 h-full w-[480px] bg-gray-900 border-l border-gray-800 shadow-xl overflow-y-auto z-50 transform transition-transform">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-white">{getCampaignName(selectedCampaign, 0)}</h2>
                    <p className="text-sm text-gray-400">{formatDate(selectedCampaign.recorded_at)}</p>
                  </div>
                  <button
                    onClick={() => setSelectedCampaign(null)}
                    className="text-gray-400 hover:text-white text-2xl"
                  >
                    ×
                  </button>
                </div>

                {selectedCampaign.ai_diagnosis ? (
                  <div className="space-y-6">
                    {/* ① 지표별 심층 진단 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-200">① 지표별 심층 진단</h3>
                      <div className="space-y-3">
                        {selectedCampaign.ai_diagnosis.per_metric_analysis?.map((item) => {
                          const isBelow = item.status === 'below_average'
                          const isAbove = item.status === 'above_average'
                          return (
                            <div
                              key={item.metric}
                              className={`p-4 rounded-lg border ${
                                isBelow ? 'bg-red-950 border-red-700'
                                : isAbove ? 'bg-green-950 border-green-700'
                                : 'bg-gray-800 border-gray-700'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-bold text-sm">{item.metric.toUpperCase()}</h4>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  isBelow ? 'bg-red-600'
                                  : isAbove ? 'bg-green-600'
                                  : 'bg-gray-600'
                                }`}>
                                  {isBelow ? '미달' : isAbove ? '초과' : '평균'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-300 mb-2">{item.cause_estimate}</p>
                              <p className="text-xs text-gray-400 italic">
                                → {item.cascade_effect}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="border-t border-gray-800"></div>

                    {/* ② 지표 간 관계 분석 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-200">② 지표 간 관계 분석</h3>
                      <div className="space-y-3">
                        {selectedCampaign.ai_diagnosis.metric_relationships?.map((rel, i) => (
                          <div key={i} className="bg-gray-800 rounded-lg p-4">
                            <p className="font-bold text-blue-300 mb-1">{rel.pattern}</p>
                            <p className="text-sm text-gray-300">{rel.interpretation}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-800"></div>

                    {/* ③ 업종/플랫폼 특성 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-200">③ 업종/플랫폼 특성</h3>
                      <div className="bg-gray-800 rounded-lg p-4">
                        <p className="font-bold text-yellow-300 mb-2">
                          핵심 지표: {selectedCampaign.ai_diagnosis.industry_platform_context?.key_metric}
                        </p>
                        <p className="text-sm text-gray-300">{selectedCampaign.ai_diagnosis.industry_platform_context?.insight}</p>
                      </div>
                    </div>

                    <div className="border-t border-gray-800"></div>

                    {/* ④ 액션 아이템 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-200">④ 우선순위별 액션 아이템</h3>
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { key: 'immediate',  label: '지금 당장',  border: 'border-red-500' },
                          { key: 'next_cycle', label: '다음 주기',  border: 'border-yellow-500' },
                          { key: 'long_term',  label: '장기 고려',  border: 'border-blue-500' }
                        ].map(({ key, label, border }) => (
                          <div key={key} className={`bg-gray-800 rounded-lg p-4 border-l-4 ${border}`}>
                            <h4 className="font-semibold mb-2 text-sm">{label}</h4>
                            <ul className="space-y-2">
                              {selectedCampaign.ai_diagnosis.action_items?.[key]?.map((item, i) => (
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

                    <div className="border-t border-gray-800"></div>

                    {/* ⑤ 예산 효율성 */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3 text-gray-200">⑤ 예산 효율성 진단</h3>
                      {(() => {
                        const VERDICT_CONFIG = {
                          increase:   { icon: '↑', colorText: 'text-green-400', bg: 'bg-green-950 border-green-700', label: '예산 증액' },
                          decrease:   { icon: '↓', colorText: 'text-red-400',   bg: 'bg-red-950 border-red-700',   label: '예산 감축' },
                          reallocate: { icon: '↔', colorText: 'text-blue-400',  bg: 'bg-blue-950 border-blue-700', label: '재배분' },
                          maintain:   { icon: '=', colorText: 'text-gray-400',  bg: 'bg-gray-800 border-gray-700', label: '현상 유지' }
                        }
                        const cfg = VERDICT_CONFIG[selectedCampaign.ai_diagnosis.budget_efficiency?.verdict] || VERDICT_CONFIG.maintain
                        return (
                          <div className={`rounded-lg p-4 border ${cfg.bg}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-2xl font-bold ${cfg.colorText}`}>{cfg.icon}</span>
                              <span className={`text-sm font-semibold ${cfg.colorText}`}>{cfg.label}</span>
                            </div>
                            <p className="text-sm text-gray-300 mb-1">{selectedCampaign.ai_diagnosis.budget_efficiency?.reasoning}</p>
                            <p className="text-sm text-gray-400">{selectedCampaign.ai_diagnosis.budget_efficiency?.suggestion}</p>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-gray-800 rounded-lg p-4">
                      <h3 className="font-semibold mb-3 text-gray-200">저장된 수치</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs text-gray-400">CTR</p>
                          <p className="text-lg font-bold">{selectedCampaign.ctr ? (selectedCampaign.ctr * 100).toFixed(2) + '%' : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">CPC</p>
                          <p className="text-lg font-bold">{selectedCampaign.cpc ? selectedCampaign.cpc.toFixed(2) : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">CVR</p>
                          <p className="text-lg font-bold">{selectedCampaign.cvr ? (selectedCampaign.cvr * 100).toFixed(2) + '%' : '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">CPA</p>
                          <p className="text-lg font-bold">{selectedCampaign.cpa ? selectedCampaign.cpa.toFixed(2) : '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-xs text-gray-400">ROAS</p>
                          <p className="text-lg font-bold">{selectedCampaign.roas ? selectedCampaign.roas.toFixed(2) : '-'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-800 rounded-lg p-4">
                      <p className="text-sm text-gray-400">AI 진단이 없습니다. <Link to="/analyze" className="text-blue-400 hover:underline">Analyze 페이지에서 분석 후 저장하세요</Link>.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Dashboard

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../utils/supabase'
import { useSession } from '../contexts/AuthContext'
import { useTranslation } from '../hooks/useTranslation'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import EmptyState from '../components/EmptyState'

function Dashboard() {
  const { session } = useSession()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedCampaign, setSelectedCampaign] = useState(null)

  useEffect(() => {
    if (!session) {
      navigate('/login')
      return
    }
    fetchCampaigns()
  }, [session, navigate])

  const fetchCampaigns = async () => {
    try {
      setLoading(true)
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const response = await fetch(`${import.meta.env.VITE_API_URL}/campaigns`, {
        headers: {
          'Authorization': `Bearer ${token}`
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

  // Calculate summary stats
  const totalCampaigns = campaigns.length
  const avgRoas = campaigns
    .filter(c => c.roas != null)
    .reduce((sum, c) => sum + c.roas, 0) / campaigns.filter(c => c.roas != null).length || 0
  const avgCtr = campaigns
    .filter(c => c.ctr != null)
    .reduce((sum, c) => sum + c.ctr, 0) / campaigns.filter(c => c.ctr != null).length || 0

  // Prepare chart data
  const chartData = campaigns
    .map(c => ({
      date: formatDate(c.recorded_at),
      CTR: c.ctr || 0,
      ROAS: c.roas || 0
    }))
    .reverse()

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
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
          </div>

          {/* Time Series Chart */}
          <div className="bg-gray-800 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold mb-4">CTR & ROAS Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                  itemStyle={{ color: '#E5E7EB' }}
                />
                <Line type="monotone" dataKey="CTR" stroke="#4D71F1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ROAS" stroke="#7C3AED" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
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
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">{t('page.dashboard.delete')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {campaigns.map((campaign, index) => (
                    <tr
                      key={campaign.id}
                      className="hover:bg-gray-800 cursor-pointer"
                      onClick={() => campaign.ai_diagnosis && setSelectedCampaign(campaign)}
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
          {selectedCampaign && selectedCampaign.ai_diagnosis && (
            <div className="fixed right-0 top-0 h-full w-96 bg-gray-800 shadow-xl overflow-y-auto p-6 z-50">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">{t('page.dashboard.ai_diagnosis')}</h2>
                <button
                  onClick={() => setSelectedCampaign(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                {typeof selectedCampaign.ai_diagnosis === 'string' ? (
                  <p className="text-gray-300 whitespace-pre-wrap">{selectedCampaign.ai_diagnosis}</p>
                ) : (
                  <pre className="text-gray-300 whitespace-pre-wrap text-sm">{JSON.stringify(selectedCampaign.ai_diagnosis, null, 2)}</pre>
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

import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabase'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import EmptyState from '../components/EmptyState'
import ErrorState from '../components/ErrorState'

const PLATFORM_COLORS = {
  'Google': '#3B82F6',
  'Meta': '#6366F1',
  'TikTok': '#EC4899',
  'YouTube': '#EF4444',
  'Amazon': '#F97316'
}

const TAGS = ['전체', '알고리즘변경', '새기능', '규제', '시장동향']

function Trends() {
  const [platformTrends, setPlatformTrends] = useState([])
  const [industryNews, setIndustryNews] = useState([])
  const [selectedTag, setSelectedTag] = useState('전체')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const [trendsResponse, newsResponse] = await Promise.all([
        supabase.from('v_platform_trends').select('*'),
        supabase.from('v_industry_news').select('*')
      ])

      if (trendsResponse.error) {
        console.error('Error fetching platform trends:', trendsResponse.error)
        throw trendsResponse.error
      }
      if (newsResponse.error) {
        console.error('Error fetching industry news:', newsResponse.error)
        throw newsResponse.error
      }

      setPlatformTrends(trendsResponse.data || [])
      
      // Deduplicate news by URL
      const uniqueNews = (newsResponse.data || []).filter((item, index, self) =>
        index === self.findIndex(n => n.url === item.url)
      )
      setIndustryNews(uniqueNews)
      
      // Debug: Log first news item's published_at
      if (newsResponse.data && newsResponse.data.length > 0) {
        console.log('First news item published_at:', newsResponse.data[0].published_at)
        console.log('Type of published_at:', typeof newsResponse.data[0].published_at)
      }
    } catch (error) {
      console.error('Error fetching trends data:', error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const getChartData = () => {
    const dateMap = {}
    
    platformTrends.forEach(trend => {
      if (!dateMap[trend.date]) {
        dateMap[trend.date] = { date: trend.date }
      }
      dateMap[trend.date][trend.platform] = trend.market_share
    })

    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  const getPlatformCards = () => {
    const platformMap = {}
    
    platformTrends.forEach(trend => {
      if (!platformMap[trend.platform]) {
        platformMap[trend.platform] = {
          platform: trend.platform,
          market_share: trend.market_share,
          ad_spend_growth: trend.ad_spend_growth || 0
        }
      }
    })

    return Object.values(platformMap)
  }

  const showChart = getChartData().length >= 5

  const filteredNews = selectedTag === '전체'
    ? industryNews
    : industryNews.filter(news => 
        Array.isArray(news.tags) 
          ? news.tags.includes(selectedTag)
          : news.tags === selectedTag
      )

  const formatDate = (dateStr) => {
    if (!dateStr) return '날짜 없음';
    const parts = String(dateStr).split(/[-T: ]/);
    if (parts.length >= 3) {
      return `${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
    }
    return String(dateStr).substring(0, 10);
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Trends</h1>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-4">Trends</h1>
        <ErrorState message={error} onRetry={fetchData} />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-6">Trends</h1>

      {/* Platform Market Share */}
      <div className="bg-gray-800 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">플랫폼 시장 점유율</h2>
        
        {showChart ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={getChartData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#9CA3AF"
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return `${date.getMonth() + 1}/${date.getDate()}`
                }}
              />
              <YAxis stroke="#9CA3AF" tickFormatter={(value) => `${value}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151' }}
                itemStyle={{ color: '#F3F4F6' }}
                labelFormatter={(value) => formatDate(value)}
                formatter={(value) => `${value.toFixed(1)}%`}
              />
              <Legend />
              {Object.keys(PLATFORM_COLORS).map(platform => (
                <Line
                  key={platform}
                  type="monotone"
                  dataKey={platform}
                  stroke={PLATFORM_COLORS[platform]}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {getPlatformCards().map((card, index) => (
              <div
                key={index}
                className="rounded-lg p-4 border-l-4"
                style={{ borderColor: PLATFORM_COLORS[card.platform] || '#3B82F6' }}
              >
                <h3 className="font-semibold text-lg mb-2">{card.platform}</h3>
                <p className="text-3xl font-bold mb-1">{card.market_share.toFixed(1)}%</p>
                {card.ad_spend_growth === null || card.ad_spend_growth === 0 || card.ad_spend_growth === undefined ? (
                  <p className="text-sm text-gray-400">광고비 성장: 데이터 없음</p>
                ) : (
                  <p className={`text-sm ${card.ad_spend_growth >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    광고비 성장: {card.ad_spend_growth >= 0 ? '+' : ''}{card.ad_spend_growth.toFixed(1)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Industry News */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">최신 업계 뉴스</h2>
          <div className="flex gap-2 flex-wrap">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-4 py-2 rounded ${
                  selectedTag === tag
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNews.map((news, index) => (
            <a
              key={index}
              href={news.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
            >
              <h3 className="font-semibold mb-2 text-blue-400 hover:text-blue-300">{news.title}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <span className="bg-gray-700 px-2 py-1 rounded text-xs">{Array.isArray(news.tags) ? news.tags[0] : news.tags}</span>
                <span>{news.source}</span>
                <span>•</span>
                <span>{formatDate(news.published_at)}</span>
              </div>
              <p className="text-sm text-gray-300 mb-2 line-clamp-2">{news.summary}</p>
              {news.impact_comment && (
                <p className="text-sm text-yellow-400 mt-2">💡 {news.impact_comment}</p>
              )}
            </a>
          ))}
        </div>

        {filteredNews.length === 0 && (
          <EmptyState
            icon="📰"
            title="뉴스가 없습니다"
            description="최신 뉴스를 불러오는 중입니다. 잠시 후 다시 확인해주세요."
          />
        )}
      </div>
    </div>
  )
}

export default Trends

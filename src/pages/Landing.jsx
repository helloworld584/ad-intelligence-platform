import { Link } from 'react-router-dom'

function Landing() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 py-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6">광고 성과를 데이터로 증명하세요</h1>
          <p className="text-xl text-gray-300 mb-10 max-w-3xl mx-auto">
            업종별 벤치마크 비교, AI 캠페인 진단, 경쟁사 광고 패턴 분석을 한 곳에서
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/benchmarks"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg text-lg"
            >
              무료로 시작하기
            </Link>
            <Link
              to="/analyze"
              className="bg-gray-700 hover:bg-gray-600 text-white font-semibold px-8 py-3 rounded-lg text-lg"
            >
              캠페인 분석하기
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gray-900 py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">주요 기능</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-800 rounded-lg p-8">
              <div className="text-blue-400 text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold mb-3">벤치마크 비교</h3>
              <p className="text-gray-300">
                10개 업종 × 3개 플랫폼 성과 데이터로 내 광고의 위치를 파악하세요
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-8">
              <div className="text-green-400 text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold mb-3">AI 캠페인 진단</h3>
              <p className="text-gray-300">
                CTR, CPC, ROAS 등 6개 지표를 AI가 심층 분석하고 액션 아이템을 제안합니다
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-8">
              <div className="text-purple-400 text-4xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-3">경쟁사 분석</h3>
              <p className="text-gray-300">
                경쟁사 광고 텍스트를 붙여넣으면 패턴과 전략을 자동으로 분석합니다
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-800 py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-5xl font-bold text-blue-400 mb-2">10</p>
              <p className="text-gray-300 text-lg">업종</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-green-400 mb-2">3</p>
              <p className="text-gray-300 text-lg">플랫폼</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-purple-400 mb-2">180</p>
              <p className="text-gray-300 text-lg">벤치마크 데이터</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA Section */}
      <div className="bg-gray-900 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">지금 바로 무료로 시작하세요</h2>
          <p className="text-gray-300 mb-8 text-lg">
            데이터 기반의 광고 성과 개선을 시작하세요
          </p>
          <Link
            to="/benchmarks"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-10 py-4 rounded-lg text-xl inline-block"
          >
            무료로 시작하기
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Landing

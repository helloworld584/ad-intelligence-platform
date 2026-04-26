"use client";

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#0f1219]">
      {/* Grid Background Pattern */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Animated Gradient Orb */}
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="relative h-[600px] w-[600px] animate-pulse">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#4D71F1]/30 to-[#7C3AED]/30 blur-[120px]" />
          <div className="absolute inset-20 rounded-full bg-gradient-to-tr from-[#7C3AED]/20 to-[#4D71F1]/20 blur-[80px]" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col items-center justify-center px-4 py-20 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        {/* Left Content */}
        <div className="max-w-2xl text-center lg:text-left">
          {/* Badge */}
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#2d3448] bg-[#1a1f2e]/80 px-4 py-1.5 backdrop-blur-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm text-[#8b95a5]">
              실시간 광고 성과 분석
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            광고 성과를
            <br />
            <span className="bg-gradient-to-r from-[#4D71F1] to-[#7C3AED] bg-clip-text text-transparent">
              데이터로 증명
            </span>
            하세요
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-pretty text-lg leading-relaxed text-[#8b95a5] sm:text-xl">
            업종별 벤치마크 비교, AI 캠페인 진단, 경쟁사 광고 패턴 분석으로
            마케팅 ROI를 극대화하세요.
          </p>

          {/* CTA Buttons */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start">
            <button className="group relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-[#4D71F1] to-[#5B7FF2] px-8 py-4 text-base font-semibold text-white shadow-lg shadow-[#4D71F1]/25 transition-all duration-300 hover:shadow-xl hover:shadow-[#4D71F1]/30 sm:w-auto">
              <span className="relative z-10">무료로 시작하기</span>
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-[#5B7FF2] to-[#7C3AED] transition-transform duration-300 group-hover:translate-x-0" />
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2d3448] bg-transparent px-8 py-4 text-base font-semibold text-white transition-all duration-300 hover:border-[#4D71F1]/50 hover:bg-[#1a1f2e] sm:w-auto">
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              데모 영상 보기
            </button>
          </div>

          {/* Trust Badges */}
          <div className="mt-12 flex flex-col items-center gap-4 lg:items-start">
            <p className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">
              1,000+ 기업이 신뢰합니다
            </p>
            <div className="flex items-center gap-6">
              {["NAVER", "Kakao", "LINE", "Coupang"].map((company) => (
                <span
                  key={company}
                  className="text-sm font-semibold text-[#4a5568] transition-colors hover:text-[#8b95a5]"
                >
                  {company}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Content - Dashboard Mockup */}
        <div className="relative mt-16 w-full max-w-xl lg:mt-0 lg:max-w-none lg:flex-1 lg:pl-16">
          <div className="relative">
            {/* Glow Effect */}
            <div className="absolute -inset-4 rounded-2xl bg-gradient-to-r from-[#4D71F1]/20 to-[#7C3AED]/20 blur-2xl" />

            {/* Dashboard Card */}
            <div className="relative rounded-2xl border border-[#2d3448] bg-[#1a1f2e]/90 p-6 shadow-2xl backdrop-blur-sm">
              {/* Window Controls */}
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#ef4444]" />
                <div className="h-3 w-3 rounded-full bg-[#eab308]" />
                <div className="h-3 w-3 rounded-full bg-[#22c55e]" />
                <div className="ml-4 h-6 flex-1 rounded bg-[#242938]" />
              </div>

              {/* Mock Dashboard Content */}
              <div className="space-y-4">
                {/* Top Stats Row */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "전환율", value: "4.32%", change: "+12.5%" },
                    { label: "ROAS", value: "285%", change: "+8.3%" },
                    { label: "CTR", value: "1.60%", change: "+5.7%" },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="rounded-lg border border-[#2d3448] bg-[#242938] p-3"
                    >
                      <p className="text-xs text-[#6b7280]">{stat.label}</p>
                      <p className="mt-1 text-lg font-bold text-white">
                        {stat.value}
                      </p>
                      <p className="text-xs text-emerald-500">{stat.change}</p>
                    </div>
                  ))}
                </div>

                {/* Chart Placeholder */}
                <div className="rounded-lg border border-[#2d3448] bg-[#242938] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-white">
                      캠페인 성과 추이
                    </span>
                    <span className="text-xs text-[#6b7280]">최근 7일</span>
                  </div>
                  <div className="flex h-32 items-end gap-2">
                    {[40, 65, 45, 80, 55, 90, 75].map((height, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t bg-gradient-to-t from-[#4D71F1] to-[#7C3AED]"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Bottom Row */}
                <div className="flex items-center justify-between rounded-lg border border-[#2d3448] bg-[#242938] p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-[#4D71F1] to-[#7C3AED]">
                      <svg
                        className="h-5 w-5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        AI 인사이트
                      </p>
                      <p className="text-xs text-[#6b7280]">
                        3개의 최적화 제안
                      </p>
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#4D71F1]/20">
                    <span className="text-sm font-bold text-[#4D71F1]">3</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <div className="absolute -right-4 -top-4 rounded-lg border border-[#2d3448] bg-[#1a1f2e] px-3 py-2 shadow-lg">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-xs font-medium text-white">
                  실시간 업데이트
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Gradient Fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0f1219] to-transparent" />
    </section>
  );
}

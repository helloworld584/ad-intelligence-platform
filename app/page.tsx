import { HeroSection } from "@/components/hero-section";
import { MetricCard } from "@/components/metric-card";

const metrics = [
  {
    name: "CTR",
    value: "1.60%",
    industryAverage: "0.95%",
    status: "top25" as const,
    progress: 85,
  },
  {
    name: "전환율",
    value: "4.32%",
    industryAverage: "2.80%",
    status: "top25" as const,
    progress: 78,
  },
  {
    name: "이탈률",
    value: "38.5%",
    industryAverage: "45.2%",
    status: "top50" as const,
    progress: 62,
  },
  {
    name: "평균 세션 시간",
    value: "3분 24초",
    industryAverage: "2분 45초",
    status: "top50" as const,
    progress: 55,
  },
  {
    name: "페이지 뷰",
    value: "2.8",
    industryAverage: "3.2",
    status: "top75" as const,
    progress: 40,
  },
  {
    name: "ROAS",
    value: "285%",
    industryAverage: "320%",
    status: "bottom25" as const,
    progress: 25,
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Dashboard Section */}
      <main className="bg-[#1a1f2e] px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Section Header */}
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              실시간 성과 지표
            </h2>
            <p className="mt-4 text-lg text-[#8b95a5]">
              업계 평균 대비 현재 캠페인 성과를 확인하세요
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metrics.map((metric) => (
              <MetricCard
                key={metric.name}
                name={metric.name}
                value={metric.value}
                industryAverage={metric.industryAverage}
                status={metric.status}
                progress={metric.progress}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 rounded-lg border border-[#2d3448] bg-[#242938]/50 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">
              범례:
            </span>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-xs text-[#8b95a5]">상위 25%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-xs text-[#8b95a5]">상위 50%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-500" />
              <span className="text-xs text-[#8b95a5]">상위 75%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="text-xs text-[#8b95a5]">하위 25%</span>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

"use client";

// Per-Metric Analysis Card
function MetricAnalysisCard({
  metric,
  value,
  trend,
  status,
  analysis,
}: {
  metric: string;
  value: string;
  trend: "up" | "down" | "neutral";
  status: "good" | "warning" | "critical";
  analysis: string;
}) {
  const statusColors = {
    good: "border-l-emerald-500",
    warning: "border-l-amber-500",
    critical: "border-l-red-500",
  };

  const statusBadgeColors = {
    good: "bg-emerald-500/10 text-emerald-400",
    warning: "bg-amber-500/10 text-amber-400",
    critical: "bg-red-500/10 text-red-400",
  };

  const statusLabels = {
    good: "양호",
    warning: "주의",
    critical: "위험",
  };

  const trendIcons = {
    up: (
      <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    down: (
      <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    neutral: (
      <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    ),
  };

  return (
    <div
      className={`rounded-lg border border-[#2d3448] border-l-4 bg-[#242938] p-5 ${statusColors[status]} transition-all hover:border-[#3d4458] hover:shadow-lg hover:shadow-black/20`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">{metric}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xl font-bold text-white">{value}</span>
            {trendIcons[trend]}
          </div>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${statusBadgeColors[status]}`}>
          {statusLabels[status]}
        </span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[#8b95a5]">{analysis}</p>
    </div>
  );
}

// Metric Relationship Pattern Card
function RelationshipPatternCard({
  fromMetric,
  toMetric,
  relationship,
  impact,
}: {
  fromMetric: string;
  toMetric: string;
  relationship: string;
  impact: "positive" | "negative" | "neutral";
}) {
  const impactColors = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-gray-400",
  };

  const arrowColors = {
    positive: "bg-emerald-500",
    negative: "bg-red-500",
    neutral: "bg-gray-500",
  };

  return (
    <div className="flex items-center gap-4 rounded-lg border border-[#2d3448] bg-[#242938] p-4 transition-all hover:border-[#3d4458]">
      <div className="flex-shrink-0 rounded-md bg-[#1a1f2e] px-3 py-2">
        <span className="text-sm font-semibold text-white">{fromMetric}</span>
      </div>
      <div className="flex flex-1 items-center gap-2">
        <div className={`h-0.5 flex-1 ${arrowColors[impact]}`} />
        <svg className={`h-4 w-4 ${impactColors[impact]}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
      <div className="flex-shrink-0 rounded-md bg-[#1a1f2e] px-3 py-2">
        <span className="text-sm font-semibold text-white">{toMetric}</span>
      </div>
      <p className={`ml-4 flex-1 text-sm ${impactColors[impact]}`}>{relationship}</p>
    </div>
  );
}

// Industry Context Highlight Box
function IndustryContextBox({
  title,
  context,
  highlights,
}: {
  title: string;
  context: string;
  highlights: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border border-[#4D71F1]/30 bg-gradient-to-br from-[#4D71F1]/10 to-[#7C3AED]/10 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4D71F1]/20">
          <svg className="h-5 w-5 text-[#4D71F1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-[#8b95a5]">{context}</p>
      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {highlights.map((item) => (
          <div key={item.label} className="rounded-md bg-[#1a1f2e]/50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">{item.label}</p>
            <p className="mt-1 text-lg font-bold text-white">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Action Item Card
function ActionItemCard({
  title,
  items,
  priority,
}: {
  title: string;
  items: string[];
  priority: "immediate" | "nextCycle" | "longTerm";
}) {
  const priorityStyles = {
    immediate: {
      border: "border-t-red-500",
      badge: "bg-red-500/10 text-red-400",
      icon: "text-red-400",
      label: "즉시 조치",
    },
    nextCycle: {
      border: "border-t-amber-500",
      badge: "bg-amber-500/10 text-amber-400",
      icon: "text-amber-400",
      label: "다음 사이클",
    },
    longTerm: {
      border: "border-t-blue-500",
      badge: "bg-blue-500/10 text-blue-400",
      icon: "text-blue-400",
      label: "장기 계획",
    },
  };

  const style = priorityStyles[priority];

  return (
    <div className={`rounded-lg border border-[#2d3448] border-t-4 bg-[#242938] p-5 ${style.border}`}>
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-white">{title}</h4>
        <span className={`rounded-md px-2 py-1 text-xs font-medium ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <ul className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[#1a1f2e] ${style.icon}`}>
              <span className="text-xs font-bold">{index + 1}</span>
            </div>
            <span className="text-sm leading-relaxed text-[#8b95a5]">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Budget Efficiency Verdict
function BudgetVerdictCard({
  verdict,
  score,
  reasoning,
  recommendations,
}: {
  verdict: "excellent" | "good" | "moderate" | "poor";
  score: number;
  reasoning: string;
  recommendations: string[];
}) {
  const verdictStyles = {
    excellent: {
      bg: "bg-emerald-500",
      text: "text-emerald-400",
      label: "우수",
      sublabel: "예산 효율 최적화",
    },
    good: {
      bg: "bg-blue-500",
      text: "text-blue-400",
      label: "양호",
      sublabel: "개선 여지 존재",
    },
    moderate: {
      bg: "bg-amber-500",
      text: "text-amber-400",
      label: "보통",
      sublabel: "최적화 필요",
    },
    poor: {
      bg: "bg-red-500",
      text: "text-red-400",
      label: "미흡",
      sublabel: "즉각 개선 필요",
    },
  };

  const style = verdictStyles[verdict];

  return (
    <div className="rounded-lg border border-[#2d3448] bg-[#242938] p-6">
      <div className="flex flex-col items-center gap-6 sm:flex-row">
        {/* Verdict Badge */}
        <div className="flex flex-col items-center">
          <div className={`flex h-24 w-24 items-center justify-center rounded-full ${style.bg}/20`}>
            <div className={`flex h-16 w-16 items-center justify-center rounded-full ${style.bg}`}>
              <span className="text-2xl font-bold text-white">{score}</span>
            </div>
          </div>
          <p className={`mt-3 text-lg font-bold ${style.text}`}>{style.label}</p>
          <p className="text-xs text-[#6b7280]">{style.sublabel}</p>
        </div>

        {/* Reasoning */}
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-white">예산 효율성 진단 결과</h4>
          <p className="mt-3 text-sm leading-relaxed text-[#8b95a5]">{reasoning}</p>
          
          <div className="mt-5">
            <p className="text-xs font-medium uppercase tracking-wider text-[#6b7280]">핵심 권고사항</p>
            <ul className="mt-2 space-y-2">
              {recommendations.map((rec, index) => (
                <li key={index} className="flex items-center gap-2">
                  <svg className={`h-4 w-4 ${style.text}`} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-white">{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Section Divider
function SectionDivider() {
  return <div className="my-10 h-px bg-gradient-to-r from-transparent via-[#2d3448] to-transparent" />;
}

// Section Header
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h3 className="text-xl font-bold text-white">{title}</h3>
      {subtitle && <p className="mt-1 text-sm text-[#6b7280]">{subtitle}</p>}
    </div>
  );
}

// Main AI Campaign Report Component
export function AICampaignReport() {
  const metricAnalysisData = [
    {
      metric: "CTR",
      value: "1.60%",
      trend: "up" as const,
      status: "good" as const,
      analysis: "클릭률이 업계 평균(0.95%) 대비 68% 높습니다. 크리에이티브 메시지와 타겟팅 설정이 효과적으로 작동하고 있습니다.",
    },
    {
      metric: "전환율",
      value: "4.32%",
      trend: "up" as const,
      status: "good" as const,
      analysis: "전환율이 벤치마크(2.80%) 대비 54% 상회합니다. 랜딩페이지 UX와 오퍼 매력도가 높은 수준입니다.",
    },
    {
      metric: "CPC",
      value: "₩850",
      trend: "neutral" as const,
      status: "warning" as const,
      analysis: "클릭당 비용이 목표(₩700)보다 21% 높습니다. 입찰가 조정 또는 타겟 범위 확대를 검토하세요.",
    },
    {
      metric: "ROAS",
      value: "285%",
      trend: "down" as const,
      status: "critical" as const,
      analysis: "광고 수익률이 목표(320%) 대비 11% 미달입니다. 전환 가치 최적화 및 고가치 오디언스 집중이 필요합니다.",
    },
    {
      metric: "노출빈도",
      value: "3.2회",
      trend: "up" as const,
      status: "warning" as const,
      analysis: "평균 노출 빈도가 권장 범위(2.5회)를 초과했습니다. 광고 피로도 증가 가능성이 있으니 크리에이티브 교체를 권장합니다.",
    },
  ];

  const relationshipPatterns = [
    { fromMetric: "CTR", toMetric: "CPC", relationship: "높은 CTR이 품질점수를 높여 CPC 최적화 여지 존재", impact: "positive" as const },
    { fromMetric: "노출빈도", toMetric: "CTR", relationship: "빈도 과다로 인한 CTR 하락 압력 감지", impact: "negative" as const },
    { fromMetric: "전환율", toMetric: "ROAS", relationship: "전환율 높으나 전환 가치가 ROAS에 미반영", impact: "neutral" as const },
  ];

  const industryContext = {
    title: "업종별 / 플랫폼별 컨텍스트",
    context: "이커머스(패션) 업종의 Q4 시즌 평균 대비 성과입니다. 블랙프라이데이 시즌 특수로 인해 전반적인 경쟁 강도가 높은 상황이며, 메타(인스타그램/페이스북) 플랫폼 기준 벤치마크입니다.",
    highlights: [
      { label: "업종", value: "이커머스(패션)" },
      { label: "플랫폼", value: "Meta Ads" },
      { label: "시즌", value: "Q4 성수기" },
      { label: "경쟁강도", value: "높음" },
    ],
  };

  const actionItems = {
    immediate: {
      title: "즉시 조치 필요",
      items: [
        "ROAS 미달 캠페인의 저효율 광고 세트 일시 중지",
        "노출 빈도 3.5회 초과 광고 크리에이티브 교체",
        "CPC 급등 키워드/관심사 타겟 입찰가 하향 조정",
      ],
    },
    nextCycle: {
      title: "다음 사이클 실행",
      items: [
        "고전환 오디언스 기반 유사 타겟 확장 테스트",
        "랜딩페이지 A/B 테스트 (CTA 문구 변경)",
        "리타겟팅 윈도우 7일→14일 확대 검토",
      ],
    },
    longTerm: {
      title: "장기 전략 과제",
      items: [
        "브랜드 캠페인과 퍼포먼스 캠페인 예산 비율 재설계",
        "오프라인 전환 데이터 연동으로 어트리뷰션 정확도 향상",
        "크리에이티브 자동화 파이프라인 구축",
      ],
    },
  };

  const budgetVerdict = {
    verdict: "moderate" as const,
    score: 68,
    reasoning: "현재 예산 대비 성과는 보통 수준입니다. CTR과 전환율은 우수하나, CPC 상승과 ROAS 미달로 인해 예산 효율성이 저하되고 있습니다. 특히 고빈도 노출로 인한 광고 피로도가 전체 효율성에 부정적 영향을 미치고 있어, 크리에이티브 순환 전략과 타겟 최적화가 우선 과제입니다.",
    recommendations: [
      "저효율 광고 세트 예산 재배분",
      "고가치 전환 오디언스 집중 투자",
      "크리에이티브 순환 주기 단축",
    ],
  };

  return (
    <div className="bg-[#1a1f2e] px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Report Header */}
        <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">AI 캠페인 진단 리포트</h2>
            <p className="mt-1 text-sm text-[#6b7280]">2024년 11월 1일 - 11월 30일 기준</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#242938] px-4 py-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-sm text-[#8b95a5]">AI 분석 완료</span>
          </div>
        </div>

        {/* Section 1: Per-Metric Analysis */}
        <SectionHeader 
          title="1. 지표별 상세 분석" 
          subtitle="각 핵심 지표의 현황과 AI 인사이트" 
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {metricAnalysisData.map((metric) => (
            <MetricAnalysisCard key={metric.metric} {...metric} />
          ))}
        </div>

        <SectionDivider />

        {/* Section 2: Metric Relationship Patterns */}
        <SectionHeader 
          title="2. 지표 간 연관관계 패턴" 
          subtitle="지표 상호 영향 분석 및 시사점" 
        />
        <div className="space-y-3">
          {relationshipPatterns.map((pattern, index) => (
            <RelationshipPatternCard key={index} {...pattern} />
          ))}
        </div>

        <SectionDivider />

        {/* Section 3: Industry/Platform Context */}
        <SectionHeader 
          title="3. 업종/플랫폼 컨텍스트" 
          subtitle="비교 기준 및 시장 상황" 
        />
        <IndustryContextBox {...industryContext} />

        <SectionDivider />

        {/* Section 4: Action Items */}
        <SectionHeader 
          title="4. 실행 과제" 
          subtitle="우선순위별 액션 아이템" 
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ActionItemCard priority="immediate" {...actionItems.immediate} />
          <ActionItemCard priority="nextCycle" {...actionItems.nextCycle} />
          <ActionItemCard priority="longTerm" {...actionItems.longTerm} />
        </div>

        <SectionDivider />

        {/* Section 5: Budget Efficiency Verdict */}
        <SectionHeader 
          title="5. 예산 효율성 종합 판정" 
          subtitle="AI 기반 예산 운영 효율성 평가" 
        />
        <BudgetVerdictCard {...budgetVerdict} />
      </div>
    </div>
  );
}

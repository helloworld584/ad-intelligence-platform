type StatusTier = "top25" | "top50" | "top75" | "bottom25";

interface MetricCardProps {
  name: string;
  value: string;
  industryAverage: string;
  status: StatusTier;
  progress: number; // 0-100
}

const statusConfig: Record<
  StatusTier,
  { label: string; bgColor: string; textColor: string; barColor: string }
> = {
  top25: {
    label: "상위 25% 이내",
    bgColor: "bg-emerald-500/15",
    textColor: "text-emerald-400",
    barColor: "bg-emerald-500",
  },
  top50: {
    label: "상위 50% 이내",
    bgColor: "bg-blue-500/15",
    textColor: "text-blue-400",
    barColor: "bg-blue-500",
  },
  top75: {
    label: "상위 75% 이내",
    bgColor: "bg-gray-500/15",
    textColor: "text-gray-400",
    barColor: "bg-gray-500",
  },
  bottom25: {
    label: "하위 25%",
    bgColor: "bg-red-500/15",
    textColor: "text-red-400",
    barColor: "bg-red-500",
  },
};

export function MetricCard({
  name,
  value,
  industryAverage,
  status,
  progress,
}: MetricCardProps) {
  const config = statusConfig[status];

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-[#2d3448] bg-[#242938] p-5 transition-all duration-200 hover:border-[#3d4458] hover:shadow-lg hover:shadow-black/20"
      style={{
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Metric Name */}
      <p className="text-xs font-semibold uppercase tracking-wider text-[#6b7280]">
        {name}
      </p>

      {/* Metric Value */}
      <p className="mt-2 text-[32px] font-bold leading-tight text-white">
        {value}
      </p>

      {/* Industry Average Comparison */}
      <p className="mt-2 text-sm text-[#8b95a5]">
        업계 평균: <span className="text-[#a1aab8]">{industryAverage}</span>
      </p>

      {/* Status Badge */}
      <div className="mt-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${config.bgColor} ${config.textColor}`}
        >
          {config.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-[#1a1f2e]">
        <div
          className={`h-full ${config.barColor} transition-all duration-500`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
